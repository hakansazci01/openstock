import { BaseBrokerAdapter, BrokerAccount, BrokerPosition, BrokerOrder } from '@/lib/broker/broker-adapter';

/**
 * Interactive Brokers adapter.
 *
 * IBKR requires the local IBKR Gateway (TWS) running and the API enabled.
 * Default Gateway port is 5000 (paper) or 4001 (live).
 * Connection: http://localhost:5000/v1/api/...
 */

const DEFAULT_API_URL = 'http://localhost:5000/v1/api';

export class InteractiveBrokersAdapter extends BaseBrokerAdapter {
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

    protected headers(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
        };
    }

    private async request<T>(url: string, init?: RequestInit): Promise<T> {
        const res = await fetch(url, { ...init, headers: { ...this.headers(), ...(init?.headers ?? {}) } });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`Interactive Brokers ${res.status} ${body.slice(0, 300)}`);
        }
        return (await res.json()) as T;
    }

    async getAccount(): Promise<BrokerAccount> {
        const data = await this.request<Record<string, unknown>>(`${this.apiUrl}/v1/account`);
        return {
            accountId: String(data.accountId ?? ''),
            buyingPower: Number(data.buyingPower ?? 0),
            cash: Number(data.cash ?? 0),
            equity: Number(data.equity ?? 0),
            portfolioValue: Number(data.portfolioValue ?? 0),
        };
    }

    async getPositions(): Promise<BrokerPosition[]> {
        const data = await this.request<Record<string, unknown>[]>(`${this.apiUrl}/v1/positions`);
        return data.map((p) => ({
            symbol: String(p.symbol ?? ''),
            quantity: Number(p.quantity ?? 0),
            averagePrice: Number(p.averagePrice ?? 0),
            currentPrice: Number(p.currentPrice ?? 0),
            marketValue: Number(p.marketValue ?? 0),
            unrealizedPL: Number(p.unrealizedPL ?? 0),
            unrealizedPLPercent: Number(p.unrealizedPLPercent ?? 0),
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
        const res = await this.request<Record<string, unknown>>(`${this.apiUrl}/v1/order`, {
            method: 'POST',
            body: JSON.stringify(order),
        });
        return {
            orderId: String(res.orderId ?? ''),
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity,
            limitPrice: order.limitPrice,
            stopPrice: order.stopPrice,
            status: 'pending',
            filledQuantity: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }

    async cancelOrder(orderId: string, _symbol?: string): Promise<boolean> {
        const res = await fetch(`${this.apiUrl}/v1/order/${encodeURIComponent(orderId)}`, {
            method: 'DELETE',
            headers: this.headers(),
        });
        return res.ok;
    }

    async getOrders(_symbol?: string): Promise<BrokerOrder[]> {
        const data = await this.request<Record<string, unknown>[]>(`${this.apiUrl}/v1/orders`);
        return data.map((o) => ({
            orderId: String(o.orderId ?? ''),
            symbol: String(o.symbol ?? ''),
            side: String(o.side) as 'buy' | 'sell',
            type: String(o.type) as BrokerOrder['type'],
            quantity: Number(o.quantity ?? 0),
            limitPrice: o.limitPrice ? Number(o.limitPrice) : undefined,
            stopPrice: o.stopPrice ? Number(o.stopPrice) : undefined,
            status: String(o.status) as BrokerOrder['status'],
            filledQuantity: Number(o.filledQuantity ?? 0),
            averagePrice: o.averagePrice ? Number(o.averagePrice) : undefined,
            createdAt: o.createdAt ? new Date(String(o.createdAt)) : new Date(),
            updatedAt: o.updatedAt ? new Date(String(o.updatedAt)) : new Date(),
        }));
    }

    async getQuote(symbol: string): Promise<{ price: number; bid: number; ask: number; timestamp: Date }> {
        const data = await this.request<Record<string, unknown>>(`${this.apiUrl}/v1/marketdata/${encodeURIComponent(symbol)}/snapshot`);
        const bid = Number(data.bid ?? 0);
        const ask = Number(data.ask ?? 0);
        return {
            price: (bid + ask) / 2 || Number(data.last ?? 0),
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