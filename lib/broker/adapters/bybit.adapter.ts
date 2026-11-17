import { BaseBrokerAdapter, BrokerAccount, BrokerPosition, BrokerOrder } from '@/lib/broker/broker-adapter';
import crypto from 'crypto';

const DEFAULT_API_URL = 'https://api.bybit.com';
const RECV_WINDOW = 5000;

function mapStatus(status: string): BrokerOrder['status'] {
    switch (status) {
        case 'Filled': return 'filled';
        case 'PartiallyFilled': return 'partially_filled';
        case 'Cancelled': return 'cancelled';
        case 'Rejected': return 'rejected';
        case 'New': return 'pending';
        default: return 'pending';
    }
}

function num(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Bybit yanıtında geçersiz ${field}`);
    return parsed;
}

export class BybitAdapter extends BaseBrokerAdapter {
    async connect(apiKey: string, apiSecret: string, apiUrl?: string): Promise<boolean> {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.apiUrl = apiUrl || DEFAULT_API_URL;
        try {
            await this.getAccount();
            return true;
        } catch {
            return false;
        }
    }

    headers(): Record<string, string> {
        const timestamp = Date.now();
        const signStr = `${timestamp}${this.apiKey}${RECV_WINDOW}`;
        const signature = crypto.createHmac('sha256', this.apiSecret).update(signStr).digest('hex');
        return {
            'Content-Type': 'application/json',
            'X-BAPI-API-KEY': this.apiKey,
            'X-BAPI-TIMESTAMP': String(timestamp),
            'X-BAPI-RECV-WINDOW': String(RECV_WINDOW),
            'X-BAPI-SIGN': signature,
            'X-BAPI-SIGN-TYPE': '2',
        };
    }

    private request = async (method: string, path: string, body?: string): Promise<any> => {
        const url = `${this.apiUrl}${path}`;
        const init: RequestInit = { method, headers: this.headers() };
        if (method !== 'GET' && body) init.body = body;
        const res = await fetch(url, init);
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Bybit ${res.status} ${text.slice(0, 300)}`);
        }
        return (await res.json()) as Record<string, unknown>;
    };

    async getAccount(): Promise<BrokerAccount> {
        const data: any = await this.request('GET', '/v5/account/wallet-balance', 'accountType=UNIFIED');
        const result: any = data.result ?? {};
        const list: any[] = Array.isArray(result.list) ? result.list : [];
        const unified = list.find((a: any) => a.accountType === 'UNIFIED') ?? list[0] ?? {};
        const totalWalletBalance = num(unified.totalWalletBalance, 'totalWalletBalance');
        const totalAvailableBalance = num(unified.totalAvailableBalance, 'totalAvailableBalance');
        return {
            accountId: 'bybit',
            buyingPower: totalAvailableBalance,
            cash: totalAvailableBalance,
            equity: totalWalletBalance,
            portfolioValue: totalWalletBalance,
        };
    }

    async placeOrder(order: {
        symbol: string;
        side: 'buy' | 'sell';
        type: 'market' | 'limit' | 'stop' | 'stop_limit';
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
    }): Promise<BrokerOrder> {
        const bodyParams: Record<string, string> = {
            category: 'spot',
            symbol: order.symbol,
            side: order.side.charAt(0).toUpperCase() + order.side.slice(1),
            orderType: order.type === 'market' ? 'Market' : 'Limit',
            qty: String(order.quantity),
        };
        if (order.type !== 'market' && order.limitPrice) {
            bodyParams.price = String(order.limitPrice);
        }
        if (order.stopPrice) {
            bodyParams.triggerPrice = String(order.stopPrice);
        }
        const bodyStr = Object.entries(bodyParams)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
        const data: any = await this.request('POST', '/v5/order/create', bodyStr);
        const result: any = data.result ?? {};
        return {
            orderId: String(result.orderId ?? result.orderLinkId ?? ''),
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity,
            limitPrice: order.limitPrice,
            stopPrice: order.stopPrice,
            status: mapStatus(String(result.orderStatus ?? 'New')),
            filledQuantity: num(result.cumExecQty ?? 0, 'cumExecQty'),
            averagePrice: result.cumExecValue ? num(result.cumExecValue, 'cumExecValue') / num(result.cumExecQty ?? 1, 'cumExecQty') : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    async cancelOrder(orderId: string, symbol?: string): Promise<boolean> {
        if (!symbol) throw new Error('Bybit emir iptali için sembol gerekli');
        const data: any = await this.request('POST', '/v5/order/cancel', `category=spot&symbol=${encodeURIComponent(symbol)}&orderId=${encodeURIComponent(orderId)}`);
        const result: any = data.result ?? {};
        return String(result.orderId) === orderId;
    }

    async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }> {
        const data: any = await this.request('GET', `/v5/market/tickers?category=spot&symbol=${encodeURIComponent(symbol)}`);
        const result: any = data.result ?? {};
        const list: any[] = Array.isArray(result.list) ? result.list : [];
        const ticker: any = list[0] ?? {};
        const ask = num(ticker.ask1Price, 'ask1Price');
        const bid = num(ticker.bid1Price, 'bid1Price');
        return {
            price: (ask + bid) / 2,
            bid,
            ask,
            timestamp: new Date(),
        };
    }

    async getPositions(): Promise<BrokerPosition[]> {
        const data = await this.request('GET', '/v5/position/list', 'category=spot');
        const result = data.result ?? {};
        const list = Array.isArray(result.list) ? result.list : [];
        return list.map((p: any) => ({
            symbol: String(p.symbol),
            quantity: num(p.size, 'size'),
            averagePrice: num(p.avgPrice, 'avgPrice'),
            currentPrice: num(p.markPrice, 'markPrice'),
            marketValue: num(p.size, 'size') * num(p.markPrice, 'markPrice'),
            unrealizedPL: num(p.unrealizedPnl, 'unrealizedPnl'),
            unrealizedPLPercent: num(p.size, 'size') > 0 ? (num(p.unrealizedPnl, 'unrealizedPnl') / (num(p.size, 'size') * num(p.avgPrice, 'avgPrice')) * 100) : 0,
        }));
    }

    async getOrders(_symbol?: string): Promise<BrokerOrder[]> {
        const data = await this.request('GET', '/v5/order/history', 'category=spot&limit=100');
        const result = data.result ?? {};
        const list = Array.isArray(result.list) ? result.list : [];
        return list.map((o: any) => ({
            orderId: String(o.orderId),
            symbol: String(o.symbol),
            side: String(o.side).toLowerCase() as 'buy' | 'sell',
            type: String(o.orderType).toLowerCase() as BrokerOrder['type'],
            quantity: num(o.qty, 'qty'),
            limitPrice: o.price ? num(o.price, 'price') : undefined,
            stopPrice: o.triggerPrice ? num(o.triggerPrice, 'triggerPrice') : undefined,
            status: mapStatus(String(o.orderStatus)),
            filledQuantity: num(o.cumExecQty, 'cumExecQty'),
            averagePrice: o.cumExecValue ? num(o.cumExecValue, 'cumExecValue') / num(o.cumExecQty ?? 1, 'cumExecQty') : undefined,
            createdAt: o.createdTime ? new Date(Number(o.createdTime)) : new Date(),
            updatedAt: o.updatedTime ? new Date(Number(o.updatedTime)) : new Date(),
        }));
    }

    async sync(): Promise<{ account: BrokerAccount; positions: BrokerPosition[]; orders: BrokerOrder[] }> {
        const [account, positions, orders] = await Promise.all([
            this.getAccount(),
            this.getPositions(),
            this.getOrders(),
        ]);
        return { account, positions, orders };
    }
}