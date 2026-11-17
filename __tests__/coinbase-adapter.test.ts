import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoinbaseAdapter } from '@/lib/broker/adapters/coinbase.adapter';

const mockFetch = vi.fn() as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Coinbase Adapter', () => {
    const adapter = new CoinbaseAdapter();

    it('should be instantiated', () => {
        expect(adapter).toBeInstanceOf(CoinbaseAdapter);
    });

    it('connect should return false when API fails', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }));
        const result = await adapter.connect('key', 'secret');
        expect(result).toBe(false);
    });

    it('connect should return true when API succeeds', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{ currency: 'USD', available: '1000' }]), { status: 200 }));
        const result = await adapter.connect('key', 'secret:passphrase');
        expect(result).toBe(true);
        expect(adapter['passphrase']).toBe('passphrase');
    });

    it('getAccount should return account info with USD cash', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([
            { currency: 'USD', available: '5000' },
            { currency: 'BTC', available: '0.5' },
        ]), { status: 200 }));
        const account = await adapter.getAccount();
        expect(account.accountId).toBe('coinbase');
        expect(account.cash).toBe(5000);
        expect(account.buyingPower).toBe(5000);
    });

    it('getPositions should return non-USD positions', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([
            { currency: 'USD', available: '5000' },
            { currency: 'BTC', available: '0.5' },
            { currency: 'ETH', available: '2.0' },
        ]), { status: 200 }));
        const positions = await adapter.getPositions();
        expect(positions).toHaveLength(2);
        expect(positions[0].symbol).toBe('BTC');
        expect(positions[1].symbol).toBe('ETH');
    });

    it('placeOrder should place market order', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            id: 'ORD-CB-1',
            status: 'filled',
            filled_size: '1.0',
        }), { status: 200 }));
        const order = await adapter.placeOrder({
            symbol: 'BTC-USD',
            side: 'buy',
            type: 'market',
            quantity: 1,
        });
        expect(order.orderId).toBe('ORD-CB-1');
        expect(order.symbol).toBe('BTC-USD');
        expect(order.status).toBe('filled');
    });

    it('placeOrder should place limit order', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            id: 'ORD-CB-2',
            status: 'open',
            filled_size: '0',
        }), { status: 200 }));
        const order = await adapter.placeOrder({
            symbol: 'BTC-USD',
            side: 'sell',
            type: 'limit',
            quantity: 1,
            limitPrice: 50000,
        });
        expect(order.type).toBe('limit');
        expect(order.limitPrice).toBe(50000);
        expect(order.status).toBe('pending');
    });

    it('cancelOrder should return true on success', async () => {
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
        const result = await adapter.cancelOrder('ORD-CB-1');
        expect(result).toBe(true);
    });

    it('getOrders should return orders array', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([
            {
                id: 'ORD-1',
                product_id: 'BTC-USD',
                side: 'buy',
                type: 'limit',
                size: '1.0',
                price: '50000',
                status: 'open',
                filled_size: '0',
                created_at: '2024-01-01T00:00:00Z',
            },
        ]), { status: 200 }));
        const orders = await adapter.getOrders();
        expect(orders).toHaveLength(1);
        expect(orders[0].orderId).toBe('ORD-1');
        expect(orders[0].symbol).toBe('BTC-USD');
    });

    it('getQuote should return ticker data', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            bid: 49900,
            ask: 50100,
        }), { status: 200 }));
        const quote = await adapter.getQuote('BTC-USD');
        expect(quote.price).toBe(50000);
        expect(quote.bid).toBe(49900);
        expect(quote.ask).toBe(50100);
    });

    it('sync should return combined data', async () => {
        mockFetch
            .mockResolvedValueOnce(new Response(JSON.stringify([{ currency: 'USD', available: '1000' }]), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify([{ currency: 'USD', available: '1000' }]), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
        const synced = await adapter.sync();
        expect(synced.account.cash).toBe(1000);
        expect(synced.positions).toEqual([]);
        expect(synced.orders).toEqual([]);
    });

    it('getQuote should throw on API error', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Not found' }), { status: 404 }));
        await expect(adapter.getQuote('INVALID')).rejects.toThrow();
    });
});