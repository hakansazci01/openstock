import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KrakenAdapter } from '@/lib/broker/adapters/kraken.adapter';

// Mock fetch globally
const mockFetch = vi.fn() as ReturnType<typeof vi.fn>;

beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('Kraken Adapter', () => {
    const adapter = new KrakenAdapter();

    it('should be instantiated', () => {
        expect(adapter).toBeInstanceOf(KrakenAdapter);
    });

    it('connect should return false when API fails', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: ['Invalid key'] }), { status: 401 }));
        const result = await adapter.connect('key', 'secret');
        expect(result).toBe(false);
    });

    it('connect should return true when API succeeds', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: { ZUSD: '1000' } }), { status: 200 }));
        const result = await adapter.connect('key', 'secret');
        expect(result).toBe(true);
    });

    it('getAccount should return account info', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: { ZUSD: '5000' } }), { status: 200 }));
        const account = await adapter.getAccount();
        expect(account.accountId).toBe('kraken');
        expect(account.cash).toBe(5000);
    });

    it('getPositions should return empty array when no positions', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: {} }), { status: 200 }));
        const positions = await adapter.getPositions();
        expect(positions).toEqual([]);
    });

    it('placeOrder should create order successfully', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            error: [],
            result: { txid: ['O123456'], descr: { order: 'buy BTCUSDT' } }
        }), { status: 200 }));
        const result = await adapter.placeOrder({
            symbol: 'BTCUSDT',
            side: 'buy',
            type: 'market',
            quantity: 1,
        });
        expect(result.orderId).toBe('O123456');
        expect(result.status).toBe('pending');
    });

    it('cancelOrder should return true when successful', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: { count: 1 } }), { status: 200 }));
        const result = await adapter.cancelOrder('12345');
        expect(result).toBe(true);
    });

    it('getOrders should return empty array when no orders', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: { open: {} } }), { status: 200 }));
        const orders = await adapter.getOrders();
        expect(orders).toEqual([]);
    });

    it('getQuote should return price data', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
            error: [],
            result: {
                XXBTZUSD: {
                    a: ['50000.00000', '1', '1'],
                    b: ['49990.00000', '1', '1'],
                },
            },
        }), { status: 200 }));
        const quote = await adapter.getQuote('BTCUSDT');
        expect(quote.price).toBe(49995);
        expect(quote.bid).toBe(49990);
        expect(quote.ask).toBe(50000);
    });

    it('sync should return account, positions, and orders', async () => {
        mockFetch
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: { ZUSD: '5000' } }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: {} }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ error: [], result: { open: {} } }), { status: 200 }));
        const synced = await adapter.sync();
        expect(synced.account).toBeDefined();
        expect(synced.positions).toEqual([]);
        expect(synced.orders).toEqual([]);
    });

    it('getQuote should throw on invalid response', async () => {
        mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: ['Pair not found'] }), { status: 400 }));
        await expect(adapter.getQuote('INVALID')).rejects.toThrow();
    });
});