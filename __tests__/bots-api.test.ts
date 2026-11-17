import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module
vi.mock('@/lib/better-auth/auth', () => ({
    getSession: vi.fn(() => Promise.resolve({ user: { id: 'test-user-id' } })),
}));

// Mock the rate-limit module
vi.mock('@/lib/rate-limit', () => ({
    isRateLimited: vi.fn(() => Promise.resolve(false)),
}));

// Mock mongoose
vi.mock('@/database/mongoose', () => ({
    connectToDatabase: vi.fn(() => Promise.resolve({ connection: { db: {} } })),
}));

// Mock Bot model
vi.mock('@/database/models/Bot', () => ({
    Bot: {
        find: vi.fn(),
        countDocuments: vi.fn(),
        create: vi.fn(),
    },
    Trade: {
        countDocuments: vi.fn(),
    },
}));

// Mock bot queries
vi.mock('@/lib/bot/queries', () => ({
    getUserBots: vi.fn(),
}));

describe('Bots API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 for unauthenticated users', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce(null);

        const { GET } = await import('@/app/api/bots/route');
        const response = await GET();

        expect(response.status).toBe(401);
    });

    it('should return user bots', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { getUserBots } = await import('@/lib/bot/queries');
        const mockBots = [
            { _id: 'bot-1', name: 'Test Bot', status: 'running', symbols: ['AAPL'] },
        ];
        vi.mocked(getUserBots).mockResolvedValue(mockBots);

        const { GET } = await import('@/app/api/bots/route');
        const response = await GET();

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.bots).toEqual(mockBots);
    });

    it('should return 400 when bot limit reached (25 bots)', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { Bot } = await import('@/database/models/Bot');
        vi.mocked(Bot.countDocuments).mockResolvedValue(25);

        const { POST } = await import('@/app/api/bots/route');
        const request = new Request('http://localhost:3000/api/bots', {
            method: 'POST',
            body: JSON.stringify({
                name: 'New Bot',
                type: 'paper',
                strategy: 'sma_cross',
                symbols: ['AAPL'],
                initialCapital: 10000,
            }),
        });
        const response = await POST(request);

        expect(response.status).toBe(400);
    });
});