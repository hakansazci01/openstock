import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module - simulate authenticated user
vi.mock('@/lib/better-auth/auth', () => ({
    getSession: vi.fn(() => Promise.resolve({ user: { id: 'test-user-id' } })),
}));

// Mock the rate-limit module - always allow
vi.mock('@/lib/rate-limit', () => ({
    isRateLimited: vi.fn(() => Promise.resolve(false)),
}));

// Mock the finnhub actions - return fake quotes
vi.mock('@/lib/actions/finnhub.actions', () => ({
    getLiveQuotes: vi.fn(),
}));

// Mock yahoo actions
vi.mock('@/lib/actions/yahoo.actions', () => ({
    getYahooDailyQuotes: vi.fn(),
}));

describe('Quotes API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 for unauthenticated users', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce(null);

        const { GET } = await import('@/app/api/quotes/route');
        const request = {
            nextUrl: new URL('http://localhost:3000/api/quotes?symbols=AAPL'),
        } as unknown as Request;
        const response = await GET(request);

        expect(response.status).toBe(401);
    });

    it('should return quotes for valid symbols', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { getLiveQuotes } = await import('@/lib/actions/finnhub.actions');
        vi.mocked(getLiveQuotes).mockResolvedValueOnce({
            AAPL: { c: 150.00, d: 1.50, dp: 1.01 },
            TSLA: { c: 200.00, d: -2.00, dp: -0.99 },
        });

        const { getYahooDailyQuotes } = await import('@/lib/actions/yahoo.actions');
        vi.mocked(getYahooDailyQuotes).mockResolvedValueOnce({});

        const { GET } = await import('@/app/api/quotes/route');
        const request = {
            nextUrl: new URL('http://localhost:3000/api/quotes?symbols=AAPL,TSLA'),
        } as unknown as Request;
        const response = await GET(request);

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.AAPL.c).toBe(150.00);
        expect(body.TSLA.c).toBe(200.00);
        expect(vi.mocked(getLiveQuotes)).toHaveBeenCalledWith(['AAPL', 'TSLA']);
    });

    it('should filter invalid symbols', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { getLiveQuotes } = await import('@/lib/actions/finnhub.actions');
        vi.mocked(getLiveQuotes).mockResolvedValueOnce({});

        const { getYahooDailyQuotes } = await import('@/lib/actions/yahoo.actions');
        vi.mocked(getYahooDailyQuotes).mockResolvedValueOnce({});

        const { GET } = await import('@/app/api/quotes/route');
        const request = {
            nextUrl: new URL('http://localhost:3000/api/quotes?symbols=AAPL,invalid@#$'),
        } as unknown as Request;
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(vi.mocked(getLiveQuotes)).toHaveBeenCalledWith(['AAPL']);
    });

    it('should limit symbols to 25 max', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { getLiveQuotes } = await import('@/lib/actions/finnhub.actions');
        vi.mocked(getLiveQuotes).mockResolvedValueOnce({});

        const { getYahooDailyQuotes } = await import('@/lib/actions/yahoo.actions');
        vi.mocked(getYahooDailyQuotes).mockResolvedValueOnce({});

        const symbols = Array.from({ length: 30 }, (_, i) => `SYM${i}`);
        const { GET } = await import('@/app/api/quotes/route');
        const request = {
            nextUrl: new URL(`http://localhost:3000/api/quotes?symbols=${symbols.join(',')}`),
        } as unknown as Request;
        await GET(request);

        const calledArgs = vi.mocked(getLiveQuotes).mock.calls[0][0];
        expect(calledArgs.length).toBe(25);
    });
});