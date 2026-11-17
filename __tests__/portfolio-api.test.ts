import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module
vi.mock('@/lib/better-auth/auth', () => ({
    getSession: vi.fn(() => Promise.resolve({ user: { id: 'test-user-id' } })),
}));

// Mock the rate-limit module
vi.mock('@/lib/rate-limit', () => ({
    isRateLimited: vi.fn(() => Promise.resolve(false)),
}));

describe('Portfolio API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return 401 for unauthenticated users', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce(null);

        const { GET } = await import('@/app/api/portfolio/route');
        const response = await GET();

        expect(response.status).toBe(401);
    });

    it('should return 400 for missing fields on POST', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { POST } = await import('@/app/api/portfolio/route');
        const request = new Request('http://localhost:3000/api/portfolio', {
            method: 'POST',
            body: JSON.stringify({ symbol: 'AAPL' }),
        });
        const response = await POST(request);

        expect(response.status).toBe(400);
    });

    it('should return 400 for missing symbol on DELETE', async () => {
        const { getSession } = await import('@/lib/better-auth/auth');
        vi.mocked(getSession).mockResolvedValueOnce({ user: { id: 'test-user-id' } });

        const { DELETE } = await import('@/app/api/portfolio/route');
        const request = new Request('http://localhost:3000/api/portfolio');
        const response = await DELETE(request);

        expect(response.status).toBe(400);
    });
});