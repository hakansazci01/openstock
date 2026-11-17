'use client';

import { APP_OWNER_NAME } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
    Activity,
    BookOpen,
    Bot,
    CircleUser,
    Code2,
    Globe,
    Info,
    LayoutDashboard,
    Landmark,
    LifeBuoy,
    LogOut,
    Search,
    Shield,
    Star,
} from "lucide-react";
import { openSearch } from "@/components/SearchCommand";
import { signOut } from "@/lib/actions/auth.actions";
import { cn } from "@/lib/utils";
import { getMarket } from "@/lib/markets";
import { isRealtime } from "@/lib/market-data";

type SidebarProps = {
    user: User;
    role?: string;
    watchlist: { symbol: string; company: string }[];
    activeMarketId?: string;
};

const RESOURCES = [
    { href: '/help', label: 'Yardım', icon: LifeBuoy },
    { href: '/api-docs', label: 'API Dokümanı', icon: Code2 },
    { href: '/about', label: 'Hakkında', icon: Info },
    { href: '/terms', label: 'Koşullar', icon: BookOpen },
];

const isActive = (pathname: string, href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

const Sidebar = ({ user, role, watchlist, activeMarketId }: SidebarProps) => {
    const pathname = usePathname();
    const router = useRouter();
    const activeMarket = activeMarketId ? getMarket(activeMarketId) : null;
    const isAdmin = role === 'admin';

    const primary = [
        { href: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
        { href: '/watchlist', label: 'İzleme Listesi', icon: Star },
        { href: '/bots', label: 'Trading Botlar', icon: Bot },
        { href: '/broker', label: 'Broker Ayarları', icon: Landmark },
        { href: '/profile', label: 'Profil', icon: CircleUser },
        ...(isAdmin ? [{ href: '/admin', label: 'Yönetim Paneli', icon: Shield }] : []),
    ];

    const handleSignOut = async () => {
        await signOut();
        router.push('/sign-in');
    };

    return (
        <aside className="sidebar">
            <Link href="/dashboard" className="px-2 pt-1 pb-2" aria-label="OpenStock paneli">
                <Image src="/assets/images/logo.png" alt="OpenStock" width={150} height={38} priority />
            </Link>

            <div className="mb-3 flex items-center gap-1.5 border-b border-line px-2 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {APP_OWNER_NAME} <Shield className="size-3.5" />
            </div>

            {activeMarket && (
                <div className="mb-3 px-2 py-2">
                    <div className="mb-1 flex items-center gap-2">
                        <Activity className="size-3.5 text-up" aria-hidden />
                        <span className="rounded border border-up/20 bg-up/10 px-1 py-0.5 text-[10px] font-bold text-up">
                            {isRealtime ? 'Canlı · 15 sn' : 'Önbellek · saatlik'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-line bg-page px-2 py-1.5">
                        <Globe className="size-4 text-muted-foreground" />
                        <div className="flex min-w-0 flex-col">
                            <span className="truncate text-xs font-semibold text-foreground">{activeMarket.name}</span>
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                                {activeMarket.short}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            <button type="button" onClick={openSearch} className="side-cta">
                <Search className="size-4" strokeWidth={2.5} />
                <span className="flex-1 text-left">Hisse Ara</span>
            </button>

            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pt-2">
                {primary.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-hover',
                                active ? 'bg-brand-soft text-brand-ink' : 'text-muted-foreground',
                            )}
                        >
                            <item.icon className="size-4 shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}

                <div className="my-2 border-t border-line" />

                <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">İzleme Listem</span>
                    <span className="pill h-5 px-1.5 text-[10px]">{watchlist.length}</span>
                </div>

                {watchlist.length === 0 ? (
                    <div className="mx-1 rounded-lg border border-dashed border-line px-3 py-3">
                        <p className="text-[11.5px] leading-snug text-faint">
                            Henüz hisse eklemediniz.
                        </p>
                        <Link href="/watchlist" className="mt-1.5 inline-flex text-[11.5px] font-semibold text-brand-ink hover:underline">
                            Hisse ekle →
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col gap-0.5 pb-1">
                        {watchlist.map(({ symbol, company }) => (
                            <Link
                                key={symbol}
                                href={`/stocks/${encodeURIComponent(symbol)}`}
                                className={cn(
                                    'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-hover',
                                    pathname === `/stocks/${symbol}` && 'bg-hover',
                                )}
                                title={company}
                            >
                                <span className="mono shrink-0 text-[11px] font-semibold text-muted-foreground">{symbol}</span>
                                <span className="truncate text-[11px] text-faint">{company}</span>
                            </Link>
                        ))}
                    </div>
                )}

                <div className="my-2 border-t border-line" />

                {RESOURCES.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-hover',
                                active ? 'bg-hover text-foreground' : 'text-muted-foreground',
                            )}
                        >
                            <item.icon className="size-4 shrink-0" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto border-t border-line px-2 pb-4 pt-3">
                <Link href="/profile" className="mb-2 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-hover">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[12px] font-bold text-brand-ink">
                        {(user.name || user.email || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-foreground">{user.name || 'Kullanıcı'}</span>
                        <span className="block truncate text-[10.5px] text-faint">{user.email}</span>
                    </span>
                </Link>
                <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-hover"
                >
                    <LogOut className="size-4" />
                    Çıkış Yap
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
