import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module
vi.mock('@/lib/better-auth/auth', () => ({
    getSession: vi.fn(() => Promise.resolve({ user: { id: 'test-user-id' } })),
}));

// Mock the rate-limit module
vi.mock('@/lib/rate-limit', () => ({
    isRateLimited: vi.fn(() => Promise.resolve(false)),
}));

// Mock technical analysis module
vi.mock('@/lib/technical-analysis', () => ({
    calculateProfessionalSignal: vi.fn(),
}));

// Mock finnhub getStockSignal
vi.mock('@/lib/actions/finnhub.actions', () => ({
    getStockSignal: vi.fn(),
}));

describe('Signals API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 for unauthenticated users', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce(null);

        const { GET } = await import('@/app/api/signals/route');
        const request = {
            nextUrl: new URL('http://localhost:3000/api/signals?symbols=AAPL'),
        } as unknown as Request;
        const response = await GET(request);

        expect(response.status).toBe(401);
    });

    it('should return signals for valid symbols', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { getStockSignal } = await import('@/lib/actions/finnhub.actions');
        vi.mocked(getStockSignal).mockResolvedValueOnce({
            quote: { c: 150.00, d: 1.50, dp: 1.01 },
            candles: Array.from({ length: 50 }, (_, i) => ({ close: 140 + i, open: 140 + i, high: 145 + i, low: 135 + i })),
        });

        const { calculateProfessionalSignal } = await import('@/lib/technical-analysis');
        vi.mocked(calculateProfessionalSignal).mockReturnValueOnce({
            signal: 'AL',
            confidence: 75,
            indicators: [{ reason: 'RSI oversold' }],
        });

        const { GET } = await import('@/app/api/signals/route');
        const request = {
            nextUrl: new URL('http://localhost:3000/api/signals?symbols=AAPL'),
        } as unknown as Request;
        const response = await GET(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.signals.AAPL.signal).toBe('AL');
    });

    it('should return empty signals for no symbols', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { GET } = await import('@/app/api/signals/route');
        const request = {
            nextUrl: new URL('http://localhost:3000/api/signals'),
        } as unknown as Request;
        const response = await GET(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.signals).toEqual({});
    });

    it('should limit symbols to 12 max', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { getStockSignal } = await import('@/lib/actions/finnhub.actions');
        vi.mocked(getStockSignal).mockResolvedValueOnce({
            quote: { c: 150.00 },
            candles: [],
        });

        const { GET } = await import('@/app/api/signals/route');
        const symbols = Array.from({ length: 20 }, (_, i) => `SYM${i}`);
        const request = {
            nextUrl: new URL(`http://localhost:3000/api/signals?symbols=${symbols.join(',')}`),
        } as unknown as Request;
        await GET(request);

        const calledSymbol = vi.mocked(getStockSignal).mock.calls[0][0];
        expect(calledSymbol).toBe('SYM0'); // Only first symbol processed due to limit
    });
});