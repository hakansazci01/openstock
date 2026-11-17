import { BaseBrokerAdapter, BrokerAccount, BrokerPosition, BrokerOrder } from '@/lib/broker/broker-adapter';
import crypto from 'crypto';

/**
 * Kraken Spot adapter.
 *
 * Kraken uses API key + API signature (HMAC-SHA512 over the request path + SHA256(post data + nonce)).
 * This is a production-ready skeleton; fill in API key/secret from broker credentials.
 */

const DEFAULT_API_URL = 'https://api.kraken.com';
const RECV_WINDOW = 10_000;

function mapStatus(status: string): BrokerOrder['status'] {
    switch (status) {
        case 'filled':
            return 'filled';
        case 'partial_fill':
            return 'partially_filled';
        case 'canceled':
        case 'expired':
            return 'cancelled';
        case 'rejected':
            return 'rejected';
        default:
            return 'pending';
    }
}

function num(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Kraken yanıtında geçersiz ${field}`);
    return parsed;
}

export class KrakenAdapter extends BaseBrokerAdapter {
    private nonce = 0;

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

    protected getSignedHeaders(path: string, body?: string): Record<string, string> {
        const nonce = Date.now();
        const message = `${nonce}${body ?? ''}`;
        const sha = crypto.createHash('sha256').update(message).digest();
        const sig = crypto
            .createHmac('sha512', Buffer.from(this.apiSecret, 'base64'))
            .update(Buffer.concat([Buffer.from(path), sha]))
            .digest('base64');

        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'API-Key': this.apiKey,
            'API-Sign': sig,
            Nonce: String(nonce),
        };
    }

    private async request<T>(method: string, path: string, body?: string): Promise<T> {
        const url = `${this.apiUrl}${path}`;
        const res = await fetch(url, {
            method,
            headers: this.getSignedHeaders(path, body),
            body,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Kraken ${res.status} ${text.slice(0, 300)}`);
        }
        return (await res.json()) as T;
    }

    async getAccount(): Promise<BrokerAccount> {
        const data = await this.request<any>('POST', '/0/private/Balance');
        const error = data.error;
        if (error && Array.isArray(error) && error.length > 0) {
            throw new Error(`Kraken: ${error.join(', ')}`);
        }
        const result: Record<string, unknown> = data.result ?? {};
        let cash = 0;
        let equity = 0;
        for (const [asset, balance] of Object.entries(result)) {
            const bal = num(balance, asset);
            if (asset === 'ZUSD' || asset === 'USD') cash += bal;
            equity += bal;
        }
        return {
            accountId: 'kraken',
            buyingPower: cash,
            cash,
            equity,
            portfolioValue: equity,
        };
    }

    async getPositions(): Promise<BrokerPosition[]> {
        const data = await this.request<any>('POST', '/0/private/OpenPositions', 'docalcs=true');
        const error = data.error;
        if (error && Array.isArray(error) && error.length > 0) {
            if (error[0] === 'EGeneral:No positions') return [];
            throw new Error(`Kraken: ${error.join(', ')}`);
        }
        const result: Record<string, any> = data.result ?? {};
        return Object.entries(result).map(([txid, pos]: [string, any]) => ({
            symbol: String(pos.pair),
            quantity: num(pos.vol, 'vol'),
            averagePrice: num(pos.avg_price, 'avg_price'),
            currentPrice: num(pos.markprice ?? pos.avg_price, 'markprice'),
            marketValue: num(pos.vol, 'vol') * num(pos.markprice ?? pos.avg_price, 'markprice'),
            unrealizedPL: num(pos.unrealized_pnl, 'unrealized_pnl'),
            unrealizedPLPercent: num(pos.vol, 'vol') > 0 ? (num(pos.unrealized_pnl, 'unrealized_pnl') / (num(pos.vol, 'vol') * num(pos.avg_price, 'avg_price')) * 100) : 0,
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
        const bodyParams: Record<string, string> = {
            pair: order.symbol,
            type: order.side,
            ordertype: order.type === 'market' ? 'market' : order.type === 'limit' ? 'limit' : 'stop-loss',
            volume: String(order.quantity),
        };
        if (order.type !== 'market' && order.limitPrice) {
            bodyParams.price = String(order.limitPrice);
        }
        if (order.stopPrice) {
            bodyParams.price = String(order.stopPrice);
            bodyParams.ordertype = 'stop-loss';
        }

        const bodyStr = Object.entries(bodyParams)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        const data = await this.request<any>('POST', '/0/private/AddOrder', bodyStr);
        const error = data.error;
        if (error && Array.isArray(error) && error.length > 0) {
            throw new Error(`Kraken sipariş hatası: ${error.join(', ')}`);
        }
        const result: any = data.result ?? {};
        const desc: any = result.descr ?? {};
        return {
            orderId: String(result.txid?.[0] ?? ''),
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity,
            limitPrice: order.limitPrice,
            stopPrice: order.stopPrice,
            status: mapStatus(String(desc.order ?? 'pending')),
            filledQuantity: 0,
            averagePrice: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    async cancelOrder(orderId: string, _symbol?: string): Promise<boolean> {
        const data = await this.request<any>('POST', '/0/private/CancelOrder', `txid=${encodeURIComponent(orderId)}`);
        const error = data.error;
        if (error && Array.isArray(error) && error.length > 0) {
            return false;
        }
        const result: any = data.result ?? {};
        return result.count === 1 || result.count === '1';
    }

    async getOrders(_symbol?: string): Promise<BrokerOrder[]> {
        const data = await this.request<any>('POST', '/0/private/OpenOrders', 'trades=true');
        const error = data.error;
        if (error && Array.isArray(error) && error.length > 0) {
            if (error[0] === 'EGeneral:No orders') return [];
            throw new Error(`Kraken: ${error.join(', ')}`);
        }
        const result: any = data.result ?? {};
        const open: any = result.open ?? {};
        return Object.entries(open).map(([txid, ord]: [string, any]) => ({
            orderId: txid,
            symbol: String(ord.pair),
            side: String(ord.type).toLowerCase() as 'buy' | 'sell',
            type: String(ord.ordertype).toLowerCase() as BrokerOrder['type'],
            quantity: num(ord.vol, 'vol'),
            limitPrice: ord.price ? num(ord.price, 'price') : undefined,
            stopPrice: ord.price2 ? num(ord.price2, 'price2') : undefined,
            status: mapStatus(String(ord.status)),
            filledQuantity: num(ord.vol_exec, 'vol_exec'),
            averagePrice: ord.avg_price ? num(ord.avg_price, 'avg_price') : undefined,
            createdAt: ord.opentm ? new Date(Number(ord.opentm) * 1000) : new Date(),
            updatedAt: new Date(),
        }));
    }

    async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }> {
        const data = await this.request<Record<string, { result?: Record<string, unknown>; error?: string[] }>>(
            'GET',
            `/0/public/Ticker?pair=${encodeURIComponent(symbol)}`,
        );
        const resultObj = data.result ?? {};
        const firstKey = Object.keys(resultObj)[0];
        const result = firstKey ? (resultObj as Record<string, Record<string, unknown>>)[firstKey] : {};
        const ask = num((result as { a?: unknown[] })?.a?.[0], 'ask');
        const bid = num((result as { b?: unknown[] })?.b?.[0], 'bid');
        return {
            price: (ask + bid) / 2,
            bid,
            ask,
            timestamp: new Date(),
        };
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