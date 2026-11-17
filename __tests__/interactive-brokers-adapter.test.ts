import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InteractiveBrokersAdapter } from '@/lib/broker/adapters/interactive-brokers.adapter';

const mockFetch = vi.fn() as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Interactive Brokers Adapter', () => {
    const adapter = new InteractiveBrokersAdapter();

    it('should be instantiated', () => {
        expect(adapter).toBeInstanceOf(InteractiveBrokersAdapter);
    });

    it('connect should return false when API fails', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }));
        const result = await adapter.connect('key', 'secret');
        expect(result).toBe(false);
    });

    it('connect should return true when API succeeds', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ accountId: 'U123456', buyingPower: 10000 }), { status: 200 }));
        const result = await adapter.connect('key', 'secret');
        expect(result).toBe(true);
    });

    it('getAccount should return account info', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            accountId: 'U123456',
            buyingPower: 10000,
            cash: 5000,
            equity: 15000,
            portfolioValue: 20000,
        }), { status: 200 }));
        const account = await adapter.getAccount();
        expect(account.accountId).toBe('U123456');
        expect(account.buyingPower).toBe(10000);
        expect(account.cash).toBe(5000);
        expect(account.equity).toBe(15000);
        expect(account.portfolioValue).toBe(20000);
    });

    it('getPositions should return positions array', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                symbol: 'AAPL',
                quantity: 10,
                averagePrice: 150,
                currentPrice: 160,
                marketValue: 1600,
                unrealizedPL: 100,
                unrealizedPLPercent: 6.67,
            },
        ]), { status: 200 }));
        const positions = await adapter.getPositions();
        expect(positions).toHaveLength(1);
        expect(positions[0].symbol).toBe('AAPL');
        expect(positions[0].quantity).toBe(10);
    });

    it('placeOrder should place and return order', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ orderId: 'ORD-123' }), { status: 200 }));
        const order = await adapter.placeOrder({
            symbol: 'AAPL',
            side: 'buy',
            type: 'market',
            quantity: 10,
        });
        expect(order.orderId).toBe('ORD-123');
        expect(order.symbol).toBe('AAPL');
        expect(order.side).toBe('buy');
        expect(order.status).toBe('pending');
    });

    it('cancelOrder should return true on success', async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
        const result = await adapter.cancelOrder('ORD-123');
        expect(result).toBe(true);
    });

    it('cancelOrder should return false on failure', async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
        const result = await adapter.cancelOrder('ORD-999');
        expect(result).toBe(false);
    });

    it('getOrders should return orders array', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                orderId: 'ORD-1',
                symbol: 'AAPL',
                side: 'buy',
                type: 'market',
                quantity: 10,
                filledQuantity: 5,
                status: 'partially_filled',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:30:00Z',
            },
        ]), { status: 200 }));
        const orders = await adapter.getOrders();
        expect(orders).toHaveLength(1);
        expect(orders[0].orderId).toBe('ORD-1');
        expect(orders[0].status).toBe('partially_filled');
    });

    it('getQuote should return quote data', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            bid: 149.50,
            ask: 150.50,
            last: 150.00,
        }), { status: 200 }));
        const quote = await adapter.getQuote('AAPL');
        expect(quote.price).toBe(150);
        expect(quote.bid).toBe(149.5);
        expect(quote.ask).toBe(150.5);
    });

    it('sync should return combined data', async () => {
        mockFetch
            .mockResolvedValueOnce(new Response(JSON.stringify({ accountId: 'U123', buyingPower: 5000, cash: 5000, equity: 5000, portfolioValue: 5000 }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
        const synced = await adapter.sync();
        expect(synced.account.accountId).toBe('U123');
        expect(synced.positions).toEqual([]);
        expect(synced.orders).toEqual([]);
    });

    it('getQuote should throw on API error', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Not found' }), { status: 404 }));
        await expect(adapter.getQuote('INVALID')).rejects.toThrow();
    });
});