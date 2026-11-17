import { getSession } from '@/lib/better-auth/auth';

/**
 * Kullanıcının admin rolünde olup olmadığını kontrol eder.
 * Admin only endpoint'leri ve admin sayfalarını korumak için kullanılır.
 */
export async function requireAdmin(): Promise<{ userId: string; role: string }> {
    const session = await getSession();
    if (!session?.user) {
        throw new Error('Yetkisiz erişim');
    }

    const role = (session.user as { role?: string }).role ?? 'user';
    if (role !== 'admin') {
        throw new Error('Admin erişimi gereklidir');
    }

    return { userId: session.user.id, role };
}

/**
 * Kullanıcının admin olup olmadığını boolean olarak döndürür.
 */
export async function isAdmin(): Promise<boolean> {
    try {
        await requireAdmin();
        return true;
    } catch {
        return false;
    }
}