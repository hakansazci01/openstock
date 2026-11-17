import { BaseBrokerAdapter, BrokerAccount, BrokerPosition, BrokerOrder } from '@/lib/broker/broker-adapter';

/**
 * Alpaca adapter.
 *
 * Auth uses Alpaca's own headers (APCA-API-KEY-ID / APCA-API-SECRET-KEY), not
 * OAuth Bearer tokens. Market data lives on a different host than the trading
 * API, so quotes are fetched from data.alpaca.markets.
 */

const DEFAULT_DATA_URL = 'https://data.alpaca.markets';

type AlpacaOrderStatus =
    | 'new'
    | 'partially_filled'
    | 'filled'
    | 'done_for_day'
    | 'canceled'
    | 'expired'
    | 'replaced'
    | 'pending_cancel'
    | 'pending_replace'
    | 'accepted'
    | 'pending_new'
    | 'accepted_for_bidding'
    | 'stopped'
    | 'rejected'
    | 'suspended'
    | 'calculated';

function mapStatus(status: string): BrokerOrder['status'] {
    switch (status) {
        case 'filled':
            return 'filled';
        case 'partially_filled':
            return 'partially_filled';
        case 'canceled':
        case 'expired':
        case 'replaced':
        case 'done_for_day':
            return 'cancelled';
        case 'rejected':
            return 'rejected';
        default:
            return 'pending';
    }
}

function num(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Alpaca yanıtında geçersiz ${field}`);
    return parsed;
}

export class AlpacaAdapter extends BaseBrokerAdapter {
    private dataUrl: string = DEFAULT_DATA_URL;

    async connect(apiKey: string, apiSecret: string, apiUrl?: string): Promise<boolean> {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.apiUrl = apiUrl || 'https://paper-api.alpaca.markets';
        this.dataUrl = process.env.ALPACA_DATA_URL?.trim() || DEFAULT_DATA_URL;

        try {
            await this.getAccount();
            return true;
        } catch {
            return false;
        }
    }

    protected headers(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'APCA-API-KEY-ID': this.apiKey,
            'APCA-API-SECRET-KEY': this.apiSecret,
        };
    }

    private async request<T>(url: string, init?: RequestInit): Promise<T> {
        const res = await fetch(url, { ...init, headers: { ...this.headers(), ...(init?.headers ?? {}) } });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Alpaca ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 300)}` : ''}`);
        }
        return (await res.json()) as T;
    }

    async getAccount(): Promise<BrokerAccount> {
        const data = await this.request<Record<string, unknown>>(`${this.apiUrl}/v2/account`);
        return {
            accountId: String(data.id ?? ''),
            buyingPower: num(data.buying_power, 'buying_power'),
            cash: num(data.cash, 'cash'),
            equity: num(data.equity, 'equity'),
            portfolioValue: num(data.portfolio_value, 'portfolio_value'),
        };
    }

    async getPositions(): Promise<BrokerPosition[]> {
        const data = await this.request<Record<string, unknown>[]>(`${this.apiUrl}/v2/positions`);
        return data.map((p) => ({
            symbol: String(p.symbol),
            quantity: num(p.qty, 'qty'),
            averagePrice: num(p.avg_entry_price, 'avg_entry_price'),
            currentPrice: num(p.current_price, 'current_price'),
            marketValue: num(p.market_value, 'market_value'),
            unrealizedPL: num(p.unrealized_pl, 'unrealized_pl'),
            unrealizedPLPercent: num(p.unrealized_plpc, 'unrealized_plpc') * 100,
        }));
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
            throw new Error('Alpaca emir adedi geçersiz');
        }

        const body: Record<string, unknown> = {
            symbol: order.symbol,
            qty: String(order.quantity),
            side: order.side,
            type: order.type,
            time_in_force: order.type === 'market' ? 'day' : 'gtc',
            extended_hours: false,
        };
        if (order.type === 'limit' || order.type === 'stop_limit') {
            if (!Number.isFinite(order.limitPrice) || Number(order.limitPrice) <= 0) {
                throw new Error('Limit emri için geçerli limitPrice gerekli');
            }
            body.limit_price = String(order.limitPrice);
        }
        if (order.type === 'stop' || order.type === 'stop_limit') {
            if (!Number.isFinite(order.stopPrice) || Number(order.stopPrice) <= 0) {
                throw new Error('Stop emri için geçerli stopPrice gerekli');
            }
            body.stop_price = String(order.stopPrice);
        }

        const data = await this.request<Record<string, unknown>>(`${this.apiUrl}/v2/orders`, {
            method: 'POST',
            body: JSON.stringify(body),
        });

        return {
            orderId: String(data.id),
            symbol: String(data.symbol),
            side: String(data.side) as 'buy' | 'sell',
            type: String(data.type) as BrokerOrder['type'],
            quantity: num(data.qty, 'qty'),
            limitPrice: data.limit_price ? num(data.limit_price, 'limit_price') : undefined,
            stopPrice: data.stop_price ? num(data.stop_price, 'stop_price') : undefined,
            status: mapStatus(String(data.status) as AlpacaOrderStatus),
            filledQuantity: data.filled_qty ? num(data.filled_qty, 'filled_qty') : 0,
            averagePrice: data.filled_avg_price ? num(data.filled_avg_price, 'filled_avg_price') : undefined,
            createdAt: data.created_at ? new Date(String(data.created_at)) : new Date(),
            updatedAt: data.updated_at ? new Date(String(data.updated_at)) : new Date(),
        };
    }

    async cancelOrder(orderId: string, _symbol?: string): Promise<boolean> {
        if (!/^[a-zA-Z0-9-]{1,64}$/.test(orderId)) throw new Error('Geçersiz emir kimliği');
        const res = await fetch(`${this.apiUrl}/v2/orders/${encodeURIComponent(orderId)}`, {
            method: 'DELETE',
            headers: this.headers(),
        });
        // Alpaca returns 204 on success and 404/422 if the order is no longer open.
        return res.ok || res.status === 404;
    }

    async getOrders(_symbol?: string): Promise<BrokerOrder[]> {
        const data = await this.request<Record<string, unknown>[]>(
            `${this.apiUrl}/v2/orders?status=all&limit=100&direction=desc`,
        );
        return data.map((o) => ({
            orderId: String(o.id),
            symbol: String(o.symbol),
            side: String(o.side) as 'buy' | 'sell',
            type: String(o.type) as BrokerOrder['type'],
            quantity: num(o.qty, 'qty'),
            limitPrice: o.limit_price ? num(o.limit_price, 'limit_price') : undefined,
            stopPrice: o.stop_price ? num(o.stop_price, 'stop_price') : undefined,
            status: mapStatus(String(o.status)),
            filledQuantity: o.filled_qty ? num(o.filled_qty, 'filled_qty') : 0,
            averagePrice: o.filled_avg_price ? num(o.filled_avg_price, 'filled_avg_price') : undefined,
            createdAt: o.created_at ? new Date(String(o.created_at)) : new Date(),
            updatedAt: o.updated_at ? new Date(String(o.updated_at)) : new Date(),
        }));
    }

    async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }> {
        const feed = process.env.ALPACA_DATA_FEED?.trim() || 'iex';
        const url = `${this.dataUrl}/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest?feed=${encodeURIComponent(feed)}`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Alpaca quote ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
        }
        const data = (await res.json()) as { quote?: { ap?: number; bp?: number; t?: string } };
        const ask = Number(data.quote?.ap);
        const bid = Number(data.quote?.bp);
        if (!Number.isFinite(ask) || !Number.isFinite(bid) || ask <= 0 || bid <= 0) {
            throw new Error(`Alpaca ${symbol} için geçerli fiyat yok (piyasa kapalı olabilir)`);
        }
        return {
            price: (ask + bid) / 2,
            bid,
            ask,
            timestamp: data.quote?.t ? new Date(data.quote.t) : new Date(),
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
