import Link from 'next/link';
import {
    Activity,
    BellRing,
    Bot as BotIcon,
    ListOrdered,
    ShieldCheck,
    Users,
    Wallet,
} from 'lucide-react';
import { connectToDatabase } from '@/database/mongoose';
import { getSystemStats } from '@/lib/actions/admin.actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const stats = await getSystemStats();

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db!;
    const recentUsers = await db.collection('user')
        .find({}, { projection: { email: 1, name: 1, role: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Genel Bakış</h2>
                <p className="text-[12.5px] text-faint">Kullanıcı, bot, işlem ve uyarı aktivitesi tek ekranda.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard title="Toplam Kullanıcı" value={stats.users} hint={`${stats.admins} admin`} icon={<Users />} />
                <StatCard title="Trading Botları" value={stats.bots} hint={`${stats.runningBots} çalışıyor`} icon={<BotIcon />} tone="brand" />
                <StatCard title="Gerçekleşen İşlem" value={stats.trades} hint="Tüm botlar" icon={<ListOrdered />} />
                <StatCard title="Fiyat Uyarıları" value={stats.alerts} hint={`${stats.watchlists} izleme listesi`} icon={<BellRing />} />
                <StatCard title="Hesap Kayıtları" value={stats.accounts} hint="E-posta / OAuth" icon={<Wallet />} />
                <StatCard title="Aktif Oturumlar" value={stats.sessions} hint="Better Auth" icon={<Activity />} />
                <StatCard title="Admin Kullanıcı" value={stats.admins} hint="Tam yetkili" icon={<ShieldCheck />} />
                <StatCard title="İzleme Listesi" value={stats.watchlists} hint="Kullanıcı girdileri" icon={<BellRing />} />
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="hatch">
                    <div className="section-head">
                        <div>
                            <h3 className="section-title">Son Kayıt Olan Kullanıcılar</h3>
                            <p className="section-sub">En yeni 5 hesap</p>
                        </div>
                        <Link href="/admin/users" className="btn btn-ghost h-8 px-2.5 text-[12px]">Tümü</Link>
                    </div>
                    <div className="card overflow-x-auto p-0">
                        <table className="data-table w-full">
                            <thead>
                                <tr>
                                    <th>E-posta</th>
                                    <th>Ad</th>
                                    <th>Rol</th>
                                    <th className="is-num">Kayıt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentUsers.map((user) => (
                                    <tr key={String(user._id)}>
                                        <td className="text-[12.5px] text-foreground">{String(user.email ?? '')}</td>
                                        <td className="text-[12.5px] text-foreground">{String(user.name ?? '—')}</td>
                                        <td>
                                            <span className={`pill h-6 px-2 text-[10.5px] font-bold ${user.role === 'admin' ? 'is-brand' : ''}`}>
                                                {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                                            </span>
                                        </td>
                                        <td className="is-num text-[11.5px] text-faint">
                                            {user.createdAt ? new Date(user.createdAt as Date).toLocaleDateString('tr-TR') : '—'}
                                        </td>
                                    </tr>
                                ))}
                                {recentUsers.length === 0 && (
                                    <tr><td colSpan={4} className="py-6 text-center text-[12px] text-faint">Kayıtlı kullanıcı yok.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="hatch">
                    <div className="section-head"><h3 className="section-title">Hızlı İşlemler</h3></div>
                    <div className="card flex flex-col gap-2">
                        <Link href="/admin/users" className="btn btn-primary w-full"><Users /> Kullanıcılar</Link>
                        <Link href="/admin/settings" className="btn btn-ghost w-full"><ShieldCheck /> Sistem Ayarları</Link>
                        <Link href="/bots" className="btn btn-ghost w-full"><BotIcon /> Botlar</Link>
                        <Link href="/dashboard" className="btn btn-ghost w-full"><Activity /> Uygulamaya Git</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    hint,
    icon,
    tone,
}: {
    title: string;
    value: number;
    hint: string;
    icon: React.ReactNode;
    tone?: 'brand';
}) {
    return (
        <div className="hatch">
            <div className="card flex items-center gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone === 'brand' ? 'bg-brand-soft text-brand-ink' : 'bg-hover text-muted-foreground'}`}>
                    {icon}
                </span>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{title}</p>
                    <p className="mono text-xl font-bold text-foreground">{value}</p>
                    <p className="truncate text-[10.5px] text-faint">{hint}</p>
                </div>
            </div>
        </div>
    );
}
