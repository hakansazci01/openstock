'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ShieldCheck, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { deleteUser, updateUserRole } from '@/lib/actions/admin.actions';
import { cn } from '@/lib/utils';

export type AdminUserRow = {
    id: string;
    email: string;
    name: string;
    role: string;
    country?: string;
    createdAt: string;
};

export default function AdminUsersTable({
    users,
    currentUserId,
}: {
    users: AdminUserRow[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return users;
        return users.filter((user) =>
            [user.email, user.name, user.role, user.country ?? '']
                .join(' ')
                .toLowerCase()
                .includes(needle),
        );
    }, [users, query]);

    const changeRole = (user: AdminUserRow, role: string) => {
        if (user.role === role) return;
        if (user.id === currentUserId) {
            toast.error('Kendi rolünüzü değiştiremezsiniz');
            return;
        }
        setPendingId(user.id);
        startTransition(async () => {
            try {
                await updateUserRole(user.id, role);
                toast.success(`${user.email} → ${role === 'admin' ? 'Admin' : 'Kullanıcı'}`);
                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Rol değiştirilemedi');
            } finally {
                setPendingId(null);
            }
        });
    };

    const remove = (user: AdminUserRow) => {
        if (user.role === 'admin') {
            toast.error('Admin kullanıcı silinemez');
            return;
        }
        if (!window.confirm(`${user.email} kullanıcısını ve tüm verilerini silmek istediğinize emin misiniz?`)) return;

        setPendingId(user.id);
        startTransition(async () => {
            try {
                await deleteUser(user.id);
                toast.success(`${user.email} silindi`);
                router.refresh();
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Kullanıcı silinemedi');
            } finally {
                setPendingId(null);
            }
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="relative flex min-w-56 flex-1 items-center sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 size-4 text-faint" />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="E-posta, ad veya rol ara"
                        className="form-input w-full pl-9"
                        aria-label="Kullanıcı ara"
                    />
                </label>
                <p className="text-[11.5px] text-faint">
                    {filtered.length} / {users.length} kullanıcı
                </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-line">
                <table className="data-table w-full">
                    <thead>
                        <tr>
                            <th>E-posta</th>
                            <th>Ad</th>
                            <th>Ülke</th>
                            <th>Rol</th>
                            <th>Kayıt</th>
                            <th className="is-num">İşlem</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((user) => {
                            const isSelf = user.id === currentUserId;
                            const isAdmin = user.role === 'admin';
                            const busy = isPending && pendingId === user.id;
                            return (
                                <tr key={user.id} className={cn(busy && 'opacity-60')}>
                                    <td className="text-[12.5px] text-foreground">
                                        <span className="flex items-center gap-2">
                                            {isAdmin ? <ShieldCheck className="size-3.5 text-brand-ink" /> : <UserRound className="size-3.5 text-faint" />}
                                            <span className="truncate">{user.email}</span>
                                            {isSelf && <span className="pill h-5 px-1.5 text-[10px]">siz</span>}
                                        </span>
                                    </td>
                                    <td className="text-[12.5px] text-foreground">{user.name || '—'}</td>
                                    <td className="text-[12px] text-faint">{user.country || '—'}</td>
                                    <td>
                                        <select
                                            value={user.role === 'admin' ? 'admin' : 'user'}
                                            onChange={(event) => changeRole(user, event.target.value)}
                                            disabled={busy || isSelf || isAdmin}
                                            className="form-input h-7 py-0 text-[11.5px]"
                                            aria-label={`${user.email} rolü`}
                                            title={isAdmin ? 'Admin rolü bu ekrandan düşürülemez' : undefined}
                                        >
                                            <option value="user">Kullanıcı</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </td>
                                    <td className="text-[11.5px] text-faint">
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : '—'}
                                    </td>
                                    <td className="is-num">
                                        <button
                                            type="button"
                                            onClick={() => remove(user)}
                                            disabled={busy || isAdmin}
                                            className="icon-btn is-danger ml-auto"
                                            title={isAdmin ? 'Admin kullanıcı silinemez' : 'Kullanıcıyı sil'}
                                            aria-label={`${user.email} kullanıcısını sil`}
                                        >
                                            {busy
                                                ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                : <Trash2 />}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {filtered.length === 0 && (
                <div className="empty-state py-10">
                    <span className="empty-icon"><UserRound /></span>
                    <h3>Eşleşen kullanıcı yok</h3>
                    <p className="text-[12px]">Arama terimini temizleyin.</p>
                </div>
            )}
        </div>
    );
}
