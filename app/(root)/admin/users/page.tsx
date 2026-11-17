import { getSession } from '@/lib/better-auth/auth';
import { getAllUsers } from '@/lib/actions/admin.actions';
import AdminUsersTable, { type AdminUserRow } from '@/components/admin/AdminUsersTable';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
    const [users, session] = await Promise.all([getAllUsers(), getSession()]);

    const rows: AdminUserRow[] = users.map((user) => ({
        id: String(user._id),
        email: String(user.email ?? ''),
        name: String(user.name ?? ''),
        role: String(user.role ?? 'user'),
        country: user.country ? String(user.country) : undefined,
        createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : '',
    }));

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Kullanıcı Yönetimi</h2>
                <p className="text-[12.5px] text-faint">
                    Tüm kullanıcıları görüntüleyin, rolünü değiştirin veya silin. Admin hesapları korumalıdır.
                </p>
            </div>

            <AdminUsersTable users={rows} currentUserId={session?.user?.id ?? ''} />
        </div>
    );
}
