import crypto from 'crypto';
import { BaseBrokerAdapter, BrokerAccount, BrokerPosition, BrokerOrder } from '@/lib/broker/broker-adapter';

const DEFAULT_API_URL = 'https://api.exchange.coinbase.com';

function mapStatus(status: string): BrokerOrder['status'] {
    switch (status) {
        case 'filled': return 'filled';
        case 'open': return 'pending';
        case 'done': return 'filled';
        case 'canceled': case 'cancelled': return 'cancelled';
        case 'rejected': return 'rejected';
        default: return 'pending';
    }
}

function num(value: unknown, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Coinbase yanıtında geçersiz ${field}`);
    return parsed;
}

export class CoinbaseAdapter extends BaseBrokerAdapter {
    private passphrase = '';

    async connect(apiKey: string, apiSecret: string, apiUrl?: string): Promise<boolean> {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.apiUrl = apiUrl || DEFAULT_API_URL;
        const parts = apiSecret.split(':');
        if (parts.length === 2) {
            this.passphrase = parts[1];
        }
        try {
            await this.getAccount();
            return true;
        } catch {
            return false;
        }
    }

    protected signedHeaders(method: string, path: string, body?: string): Record<string, string> {
        const timestamp = Date.now() / 1000;
        const message = `${timestamp}${method.toUpperCase()}${path}${body ?? ''}`;
        const hmac = crypto.createHmac('sha256', Buffer.from(this.apiSecret.split(':')[0], 'base64'));
        const signature = hmac.update(message).digest('base64');
        return {
            'Content-Type': 'application/json',
            'CB-ACCESS-KEY': this.apiKey,
            'CB-ACCESS-SIGN': signature,
            'CB-ACCESS-TIMESTAMP': String(timestamp),
            'CB-ACCESS-PASSPHRASE': this.passphrase,
        };
    }

    private async request<T>(method: string, path: string, body?: string): Promise<T> {
        const url = `${this.apiUrl}${path}`;
        const res = await fetch(url, {
            method,
            headers: this.signedHeaders(method, path, body),
            body,
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`Coinbase ${res.status} ${text.slice(0, 300)}`);
        }
        return (await res.json()) as T;
    }

    async getAccount(): Promise<BrokerAccount> {
        const data = await this.request<Record<string, unknown>[]>('GET', '/accounts');
        let cash = 0;
        for (const acc of data) {
            if (String(acc.currency) === 'USD' || String(acc.currency) === 'USDT') {
                cash = Number(acc.available ?? 0);
                break;
            }
        }
        return {
            accountId: 'coinbase',
            buyingPower: cash,
            cash,
            equity: cash,
            portfolioValue: cash,
        };
    }

    async getPositions(): Promise<BrokerPosition[]> {
        const data = await this.request<Record<string, unknown>[]>('GET', '/accounts');
        return data
            .filter((acc) => Number(acc.available ?? 0) > 0 && String(acc.currency) !== 'USD' && String(acc.currency) !== 'USDT')
            .map((p) => ({
                symbol: String(p.currency ?? ''),
                quantity: Number(p.available ?? 0),
                averagePrice: 0,
                currentPrice: 0,
                marketValue: 0,
                unrealizedPL: 0,
                unrealizedPLPercent: 0,
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
        const body = JSON.stringify({
            product_id: order.symbol,
            side: order.side,
            type: order.type === 'market' ? 'market' : 'limit',
            size: String(order.quantity),
            price: order.limitPrice ? String(order.limitPrice) : undefined,
        });
        const data = await this.request<Record<string, unknown>>('POST', '/orders', body);
        return {
            orderId: String(data.id ?? ''),
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity,
            limitPrice: order.limitPrice,
            stopPrice: order.stopPrice,
            status: mapStatus(String(data.status ?? 'pending')),
            filledQuantity: Number(data.filled_size ?? 0),
            averagePrice: data.average_price ? Number(data.average_price) : undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    async cancelOrder(orderId: string, _symbol?: string): Promise<boolean> {
        const res = await fetch(`${this.apiUrl}/orders/${encodeURIComponent(orderId)}`, {
            method: 'DELETE',
            headers: this.signedHeaders('DELETE', `/orders/${orderId}`),
        });
        return res.ok;
    }

    async getOrders(_symbol?: string): Promise<BrokerOrder[]> {
        const data = await this.request<Record<string, unknown>[]>('GET', '/orders?status=all');
        return data.map((o) => ({
            orderId: String(o.id ?? ''),
            symbol: String(o.product_id ?? ''),
            side: String(o.side) as 'buy' | 'sell',
            type: String(o.type) as BrokerOrder['type'],
            quantity: Number(o.size ?? 0),
            limitPrice: o.price ? Number(o.price) : undefined,
            stopPrice: o.stop_price ? Number(o.stop_price) : undefined,
            status: mapStatus(String(o.status ?? 'pending')),
            filledQuantity: Number(o.filled_size ?? 0),
            averagePrice: o.average_price ? Number(o.average_price) : undefined,
            createdAt: o.created_at ? new Date(String(o.created_at)) : new Date(),
            updatedAt: o.done_at ? new Date(String(o.done_at)) : new Date(),
        }));
    }

    async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }> {
        const data = await this.request<Record<string, unknown>>('GET', `/products/${encodeURIComponent(symbol)}/ticker`);
        const bid = num(data.bid, 'bid');
        const ask = num(data.ask, 'ask');
        return {
            price: (bid + ask) / 2,
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