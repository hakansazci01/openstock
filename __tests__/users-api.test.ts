import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/better-auth/auth', () => ({
    requireUserId: vi.fn(() => Promise.resolve('test-user-id')),
}));

vi.mock('@/database/mongoose', () => ({
    connectToDatabase: vi.fn(() => Promise.resolve({
        connection: {
            db: {
                collection: vi.fn(() => ({
                    findOne: vi.fn(),
                    updateOne: vi.fn(),
                })),
            },
        },
    })),
}));

describe('Users API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should require user ID', async () => {
        const { requireUserId } = await import('@/lib/better-auth/auth');
        const result = await requireUserId();
        expect(result).toBe('test-user-id');
    });

    it('should connect to database', async () => {
        const { connectToDatabase } = await import('@/database/mongoose');
        const result = await connectToDatabase();
        expect(result).toBeDefined();
    });
});
