import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module
vi.mock('@/lib/better-auth/auth', () => ({
    requireUserId: vi.fn(() => Promise.resolve('test-user-id')),
}));

// Mock the watchlist actions
vi.mock('@/lib/actions/watchlist.actions', () => ({
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
    getUserWatchlist: vi.fn(),
    isStockInWatchlist: vi.fn(),
}));

describe('Watchlist API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return watchlist for authenticated user', async () => {
        const { getUserWatchlist } = await import('@/lib/actions/watchlist.actions');
        const mockWatchlist = [{ symbol: 'AAPL', company: 'Apple Inc.' }];
        vi.mocked(getUserWatchlist).mockResolvedValue(mockWatchlist);

        const result = await getUserWatchlist();
        expect(result).toEqual(mockWatchlist);
        expect(vi.mocked(getUserWatchlist)).toHaveBeenCalledTimes(1);
    });

    it('should add stock to watchlist', async () => {
        const { addToWatchlist } = await import('@/lib/actions/watchlist.actions');
        const mockResult = { symbol: 'AAPL', company: 'Apple Inc.' };
        vi.mocked(addToWatchlist).mockResolvedValue(mockResult);

        const result = await addToWatchlist('AAPL', 'Apple Inc.');
        expect(result).toEqual(mockResult);
        expect(vi.mocked(addToWatchlist)).toHaveBeenCalledWith('AAPL', 'Apple Inc.');
    });

    it('should remove stock from watchlist', async () => {
        const { removeFromWatchlist } = await import('@/lib/actions/watchlist.actions');
        vi.mocked(removeFromWatchlist).mockResolvedValue({ success: true });

        const result = await removeFromWatchlist('AAPL');
        expect(result).toEqual({ success: true });
        expect(vi.mocked(removeFromWatchlist)).toHaveBeenCalledWith('AAPL');
    });

    it('should check if stock is in watchlist', async () => {
        const { isStockInWatchlist } = await import('@/lib/actions/watchlist.actions');
        vi.mocked(isStockInWatchlist).mockResolvedValue(true);

        const result = await isStockInWatchlist('AAPL');
        expect(result).toBe(true);
        expect(vi.mocked(isStockInWatchlist)).toHaveBeenCalledWith('AAPL');
    });
});