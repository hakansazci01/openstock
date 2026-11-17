import { BaseBrokerAdapter, BrokerAccount, BrokerPosition, BrokerOrder } from '@/lib/broker/broker-adapter';
import crypto from 'crypto';

/**
 * Binance Spot adapter.
 *
 * Notes that matter for real money:
 * - Signed endpoints use HMAC-SHA256 over the exact query string that is sent,
 *   with `timestamp` (and `recvWindow`) included before signing.
 * - Binance rejects quantities that do not respect the symbol's LOT_SIZE
 *   step and NOTIONAL minimum, so quantities are floored to the step size and
 *   validated before the request leaves the process.
 * - Spot stop orders are `STOP_LOSS` / `STOP_LOSS_LIMIT`, not `STOP`.
 * - `cancelOrder` and `getOrders` need a symbol, unlike Alpaca.
 */

const DEFAULT_API_URL = 'https://api.binance.com';
const RECV_WINDOW = 10_000;
const EXCHANGE_INFO_TTL_MS = 10 * 60 * 1000;
const SNAPSHOT_TTL_MS = 3_000;

const STABLE_ASSETS = new Set(['USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'USDP', 'DAI', 'BUSD']);

type BinanceFilter = Record<string, unknown>;

type SymbolInfo = {
    symbol: string;
    status: string;
    baseAsset: string;
    quoteAsset: string;
    isSpotTradingAllowed?: boolean;
    filters: BinanceFilter[];
};

type Balance = { asset: string; free: number; locked: number };

type AccountSnapshot = {
    balances: Balance[];
    prices: Map<string, number>;
};

function mapStatus(status: string): BrokerOrder['status'] {
    switch (status) {
        case 'FILLED':
            return 'filled';
        case 'PARTIALLY_FILLED':
            return 'partially_filled';
        case 'CANCELED':
        case 'EXPIRED':
        case 'EXPIRED_IN_MATCH':
        case 'PENDING_CANCEL':
            return 'cancelled';
        case 'REJECTED':
            return 'rejected';
        default:
            return 'pending';
    }
}

function mapOrderType(type: string): BrokerOrder['type'] {
    switch (type) {
        case 'LIMIT':
        case 'LIMIT_MAKER':
            return 'limit';
        case 'STOP_LOSS':
            return 'stop';
        case 'STOP_LOSS_LIMIT':
        case 'TAKE_PROFIT_LIMIT':
            return 'stop_limit';
        case 'TAKE_PROFIT':
            return 'stop';
        default:
            return 'market';
    }
}

function toNumber(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Binance yanıtında geçersiz ${field}`);
    return parsed;
}

function decimalPlaces(value: string): number {
    const idx = value.indexOf('.');
    return idx === -1 ? 0 : value.length - idx - 1;
}

function findFilter(info: SymbolInfo, filterType: string): BinanceFilter | undefined {
    return info.filters.find((f) => String(f.filterType) === filterType);
}

/** Volume-weighted average fill price from `fills`, or the quote/qty ratio. */
function averageFillPrice(record: Record<string, unknown>): number | undefined {
    const fills = Array.isArray(record.fills) ? record.fills : [];
    let quoteSum = 0;
    let qtySum = 0;
    for (const raw of fills) {
        const fill = raw as Record<string, unknown>;
        const price = Number(fill.price);
        const qty = Number(fill.qty);
        if (Number.isFinite(price) && Number.isFinite(qty) && price > 0 && qty > 0) {
            quoteSum += price * qty;
            qtySum += qty;
        }
    }
    if (qtySum > 0) return quoteSum / qtySum;

    const executed = Number(record.executedQty);
    const quote = Number(record.cummulativeQuoteQty);
    if (Number.isFinite(executed) && executed > 0 && Number.isFinite(quote) && quote > 0) {
        return quote / executed;
    }
    return undefined;
}

export class BinanceAdapter extends BaseBrokerAdapter {
    private exchangeInfo: Map<string, SymbolInfo> | null = null;
    private exchangeInfoAt = 0;
    private snapshotCache: { at: number; data: AccountSnapshot } | null = null;

    async connect(apiKey: string, apiSecret: string, apiUrl?: string): Promise<boolean> {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.apiUrl = (apiUrl || DEFAULT_API_URL).replace(/\/+$/, '');

        try {
            await this.getAccount();
            return true;
        } catch {
            return false;
        }
    }

    private signQuery(query: string): string {
        return crypto.createHmac('sha256', this.apiSecret).update(query).digest('hex');
    }

    private async signedRequest(
        path: string,
        params: Record<string, string | number> = {},
        method: 'GET' | 'POST' | 'DELETE' = 'GET',
    ): Promise<unknown> {
        if (!this.apiKey || !this.apiSecret) throw new Error('Binance API bilgileri eksik');

        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) query.append(key, String(value));
        query.append('recvWindow', String(RECV_WINDOW));
        query.append('timestamp', String(Date.now()));
        const payload = query.toString();
        const signature = this.signQuery(payload);

        const res = await fetch(`${this.apiUrl}${path}?${payload}&signature=${signature}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-MBX-APIKEY': this.apiKey,
            },
        });

        const text = await res.text();
        let data: unknown = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = text;
        }

        if (!res.ok) {
            const record = (data ?? {}) as Record<string, unknown>;
            const code = record.code !== undefined ? `[${record.code}] ` : '';
            const msg = record.msg !== undefined ? String(record.msg) : text.slice(0, 300);
            throw new Error(`Binance ${res.status} ${code}${msg}`.trim());
        }
        return data;
    }

    private async publicRequest(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) query.append(key, String(value));
        const suffix = query.toString() ? `?${query.toString()}` : '';
        const res = await fetch(`${this.apiUrl}${path}${suffix}`);
        const text = await res.text();
        if (!res.ok) throw new Error(`Binance ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
        return text ? JSON.parse(text) : null;
    }

    private async loadSymbolMap(force = false): Promise<Map<string, SymbolInfo>> {
        const fresh = Date.now() - this.exchangeInfoAt < EXCHANGE_INFO_TTL_MS;
        if (!force && this.exchangeInfo && fresh) return this.exchangeInfo;

        const data = (await this.publicRequest('/api/v3/exchangeInfo')) as { symbols?: SymbolInfo[] };
        if (!Array.isArray(data?.symbols)) throw new Error('Binance exchangeInfo yanıtı beklenmedik biçimde');

        this.exchangeInfo = new Map(data.symbols.map((s) => [s.symbol, s]));
        this.exchangeInfoAt = Date.now();
        return this.exchangeInfo;
    }

    private async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
        const map = await this.loadSymbolMap();
        const info = map.get(symbol);
        if (!info) throw new Error(`Binance sembolü bulunamadı: ${symbol}`);
        if (info.status !== 'TRADING') throw new Error(`Binance ${symbol} şu anda işleme kapalı (${info.status})`);
        if (info.isSpotTradingAllowed === false) throw new Error(`Binance ${symbol} spot işleme izin vermiyor`);
        return info;
    }

    /** Floors the quantity to the symbol step size and enforces min/max. */
    private normalizeQuantity(info: SymbolInfo, quantity: number): number {
        const lot = findFilter(info, 'LOT_SIZE');
        const stepSize = String(lot?.stepSize ?? '0.00000001');
        const minQty = Number(lot?.minQty ?? 0);
        const maxQty = Number(lot?.maxQty ?? Infinity);
        const step = Number(stepSize);
        if (!Number.isFinite(step) || step <= 0) throw new Error(`Binance ${info.symbol} adım boyutu okunamadı`);

        const decimals = decimalPlaces(stepSize);
        const floored = Number((Math.floor(quantity / step) * step).toFixed(decimals));
        if (!Number.isFinite(floored) || floored <= 0) throw new Error(`Binance emir adedi çok küçük: ${quantity}`);
        if (floored < minQty) throw new Error(`Binance ${info.symbol} minimum adet ${minQty}`);
        if (floored > maxQty) throw new Error(`Binance ${info.symbol} maksimum adet ${maxQty}`);
        return floored;
    }

    private assertNotional(info: SymbolInfo, quantity: number, price: number): void {
        const notionalFilter = findFilter(info, 'NOTIONAL') ?? findFilter(info, 'MIN_NOTIONAL');
        const minNotional = Number(notionalFilter?.minNotional ?? 0);
        if (Number.isFinite(minNotional) && minNotional > 0 && Number.isFinite(price) && price > 0) {
            if (quantity * price < minNotional) {
                throw new Error(
                    `Binance ${info.symbol} minimum işlem tutarı ${minNotional} ${info.quoteAsset} (hesaplanan: ${(quantity * price).toFixed(2)})`,
                );
            }
        }
    }

    private async loadSnapshot(force = false): Promise<AccountSnapshot> {
        if (!force && this.snapshotCache && Date.now() - this.snapshotCache.at < SNAPSHOT_TTL_MS) {
            return this.snapshotCache.data;
        }

        const [account, pricesRaw] = await Promise.all([
            this.signedRequest('/api/v3/account') as Promise<Record<string, unknown>>,
            this.publicRequest('/api/v3/ticker/price') as Promise<Array<Record<string, unknown>>>,
        ]);

        if (account?.canTrade === false) {
            throw new Error('Binance API anahtarı işlem yapmaya yetkili değil (canTrade=false)');
        }

        const prices = new Map<string, number>();
        for (const entry of Array.isArray(pricesRaw) ? pricesRaw : []) {
            const symbol = String(entry.symbol ?? '');
            const price = Number(entry.price);
            if (symbol && Number.isFinite(price) && price > 0) prices.set(symbol, price);
        }

        const balances: Balance[] = (Array.isArray(account?.balances) ? account.balances : [])
            .map((raw) => {
                const b = raw as Record<string, unknown>;
                return {
                    asset: String(b.asset ?? ''),
                    free: Number(b.free ?? 0),
                    locked: Number(b.locked ?? 0),
                };
            })
            .filter((b) => b.asset && (b.free > 0 || b.locked > 0));

        const data: AccountSnapshot = { balances, prices };
        this.snapshotCache = { at: Date.now(), data };
        return data;
    }

    private assetPriceUsdt(asset: string, prices: Map<string, number>): number | null {
        if (STABLE_ASSETS.has(asset)) return 1;
        const direct = prices.get(`${asset}USDT`);
        if (direct && Number.isFinite(direct) && direct > 0) return direct;
        const btc = prices.get(`${asset}BTC`);
        const btcUsdt = prices.get('BTCUSDT');
        if (btc && btcUsdt && Number.isFinite(btc) && Number.isFinite(btcUsdt)) return btc * btcUsdt;
        return null;
    }

    async getAccount(): Promise<BrokerAccount> {
        const snapshot = await this.loadSnapshot();
        let cash = 0;
        let equity = 0;
        for (const balance of snapshot.balances) {
            const total = balance.free + balance.locked;
            const price = this.assetPriceUsdt(balance.asset, snapshot.prices);
            if (price === null) continue;
            equity += total * price;
            if (STABLE_ASSETS.has(balance.asset) && balance.asset === 'USDT') cash += total;
        }

        return {
            accountId: 'binance-spot',
            buyingPower: cash,
            cash,
            equity,
            portfolioValue: equity,
        };
    }

    async getPositions(): Promise<BrokerPosition[]> {
        const snapshot = await this.loadSnapshot();
        const positions: BrokerPosition[] = [];
        for (const balance of snapshot.balances) {
            if (STABLE_ASSETS.has(balance.asset)) continue;
            const quantity = balance.free + balance.locked;
            if (quantity <= 0) continue;
            const price = this.assetPriceUsdt(balance.asset, snapshot.prices);
            if (price === null || price <= 0) continue;
            positions.push({
                symbol: balance.asset,
                quantity,
                averagePrice: 0,
                currentPrice: price,
                marketValue: quantity * price,
                unrealizedPL: 0,
                unrealizedPLPercent: 0,
            });
        }
        return positions;
    }

    async placeOrder(order: {
        symbol: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit' | 'stop' | 'stop_limit';
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
    }): Promise<BrokerOrder> {
        if (!Number.isFinite(order.quantity) || order.quantity <= 0) {
            throw new Error('Binance emir adedi geçersiz');
        }

        const info = await this.getSymbolInfo(order.symbol);
        const quantity = this.normalizeQuantity(info, order.quantity);

        let binanceType: string;
        switch (order.type) {
            case 'market':
                binanceType = 'MARKET';
                break;
            case 'limit':
                binanceType = 'LIMIT';
                break;
            case 'stop':
                binanceType = 'STOP_LOSS';
                break;
            case 'stop_limit':
                binanceType = 'STOP_LOSS_LIMIT';
                break;
            default:
                throw new Error(`Desteklenmeyen Binance emir tipi: ${order.type}`);
        }

        const params: Record<string, string | number> = {
            symbol: info.symbol,
            side: order.side.toUpperCase(),
            type: binanceType,
            quantity,
            newOrderRespType: 'FULL',
        };

        if (binanceType === 'LIMIT' || binanceType === 'STOP_LOSS_LIMIT') {
            if (!Number.isFinite(order.limitPrice) || Number(order.limitPrice) <= 0) {
                throw new Error('Limit emri için geçerli limitPrice gerekli');
            }
            params.price = Number(order.limitPrice);
            params.timeInForce = 'GTC';
        }

        if (binanceType === 'STOP_LOSS' || binanceType === 'STOP_LOSS_LIMIT') {
            if (!Number.isFinite(order.stopPrice) || Number(order.stopPrice) <= 0) {
                throw new Error('Stop emri için geçerli stopPrice gerekli');
            }
            params.stopPrice = Number(order.stopPrice);
        }

        const referencePrice =
            Number(order.limitPrice) ||
            Number(order.stopPrice) ||
            (await this.getQuote(info.symbol)).price;
        this.assertNotional(info, quantity, referencePrice);

        const data = (await this.signedRequest('/api/v3/order', params, 'POST')) as Record<string, unknown>;
        const timestamp = data.transactTime ? new Date(Number(data.transactTime)) : new Date();

        return {
            orderId: String(data.orderId),
            symbol: String(data.symbol ?? info.symbol),
            side: String(data.side ?? order.side).toLowerCase() as 'buy' | 'sell',
            type: mapOrderType(String(data.type ?? binanceType)),
            quantity: Number(data.origQty ?? quantity),
            limitPrice: Number(data.price) > 0 ? Number(data.price) : undefined,
            stopPrice: Number(data.stopPrice) > 0 ? Number(data.stopPrice) : undefined,
            status: mapStatus(String(data.status ?? 'NEW')),
            filledQuantity: Number(data.executedQty ?? 0),
            averagePrice: averageFillPrice(data),
            createdAt: timestamp,
            updatedAt: timestamp,
        };
    }

    async cancelOrder(orderId: string, symbol?: string): Promise<boolean> {
        if (!/^[0-9]{1,20}$/.test(orderId)) throw new Error('Geçersiz Binance emir kimliği');
        if (!symbol) throw new Error('Binance emir iptali için sembol gerekli');

        const info = await this.getSymbolInfo(symbol);
        const data = (await this.signedRequest(
            '/api/v3/order',
            { symbol: info.symbol, orderId },
            'DELETE',
        )) as Record<string, unknown>;

        return mapStatus(String(data.status ?? '')) === 'cancelled' || data.status === undefined;
    }

    async getOrders(symbol?: string): Promise<BrokerOrder[]> {
        let raw: unknown;
        if (symbol) {
            const info = await this.getSymbolInfo(symbol);
            raw = await this.signedRequest('/api/v3/allOrders', { symbol: info.symbol, limit: 100 });
        } else {
            // Binance cannot list every historical order without a symbol; open
            // orders across all symbols is the safe, cheap equivalent.
            raw = await this.signedRequest('/api/v3/openOrders');
        }

        const list = Array.isArray(raw) ? raw : [];
        return list.map((entry) => {
            const record = entry as Record<string, unknown>;
            const createdAt = record.time ? new Date(Number(record.time)) : new Date();
            const updatedAt = record.updateTime ? new Date(Number(record.updateTime)) : createdAt;
            return {
                orderId: String(record.orderId),
                symbol: String(record.symbol),
                side: String(record.side).toLowerCase() as 'buy' | 'sell',
                type: mapOrderType(String(record.type)),
                quantity: toNumber(record.origQty, 'origQty'),
                limitPrice: Number(record.price) > 0 ? Number(record.price) : undefined,
                stopPrice: Number(record.stopPrice) > 0 ? Number(record.stopPrice) : undefined,
                status: mapStatus(String(record.status)),
                filledQuantity: Number(record.executedQty ?? 0),
                averagePrice: averageFillPrice(record),
                createdAt,
                updatedAt,
            };
        });
    }

    async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }> {
        const data = (await this.publicRequest('/api/v3/ticker/bookTicker', {
            symbol,
        })) as Record<string, unknown>;

        const bid = Number(data.bidPrice);
        const ask = Number(data.askPrice);
        if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
            throw new Error(`Binance ${symbol} için geçerli fiyat yok`);
        }

        return {
            price: (bid + ask) / 2,
            bid,
            ask,
            timestamp: new Date(),
        };
    }

    async sync(): Promise<{
        account: BrokerAccount;
        positions: BrokerPosition[];
        orders: BrokerOrder[];
    }> {
        const [account, positions, orders] = await Promise.all([
            this.getAccount(),
            this.getPositions(),
            this.getOrders(),
        ]);
        return { account, positions, orders };
    }
}
