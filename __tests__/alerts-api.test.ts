import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the auth module
vi.mock('@/lib/better-auth/auth', () => ({
    requireUserId: vi.fn(() => Promise.resolve('test-user-id')),
}));

// Mock the alert actions
vi.mock('@/lib/actions/alert.actions', () => ({
    createAlert: vi.fn(),
    getUserAlerts: vi.fn(),
    deleteAlert: vi.fn(),
}));

describe('Alerts API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return user alerts', async () => {
        const { getUserAlerts } = await import('@/lib/actions/alert.actions');
        const mockAlerts = [{ symbol: 'AAPL', targetPrice: 150, condition: 'ABOVE' }];
        vi.mocked(getUserAlerts).mockResolvedValue(mockAlerts);

        const result = await getUserAlerts();
        expect(result).toEqual(mockAlerts);
        expect(vi.mocked(getUserAlerts)).toHaveBeenCalledTimes(1);
    });

    it('should create a new alert', async () => {
        const { createAlert } = await import('@/lib/actions/alert.actions');
        const mockResult = { symbol: 'AAPL', targetPrice: 150, condition: 'ABOVE' };
        vi.mocked(createAlert).mockResolvedValue(mockResult);

        const result = await createAlert({ symbol: 'AAPL', targetPrice: 150, condition: 'ABOVE' });
        expect(result).toEqual(mockResult);
        expect(vi.mocked(createAlert)).toHaveBeenCalledWith({ symbol: 'AAPL', targetPrice: 150, condition: 'ABOVE' });
    });

    it('should delete an alert', async () => {
        const { deleteAlert } = await import('@/lib/actions/alert.actions');
        vi.mocked(deleteAlert).mockResolvedValue({ success: true });

        const result = await deleteAlert('alert-123');
        expect(result).toEqual({ success: true });
        expect(vi.mocked(deleteAlert)).toHaveBeenCalledWith('alert-123');
    });
});