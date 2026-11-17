content = r"""'use client';

import { APP_OWNER_NAME } from "@/lib/constants";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { BookOpen, Code2, Heart, Info, LayoutDashboard, LifeBuoy, LogOut, Search, Star, Shield } from "lucide-react";
import { openSearch } from "@/components/SearchCommand";
import { signOut } from "@/lib/actions/auth.actions";
import { cn } from "@/lib/utils";

type SidebarProps = {
    user: User;
    watchlist: { symbol: string; company: string }[];
};

const RESOURCES = [
    { href: '/help', label: 'Help', icon: LifeBuoy },
    { href: '/api-docs', label: 'API docs', icon: Code2 },
    { href: '/about', label: 'About', icon: Info },
    { href: '/terms', label: 'Terms', icon: BookOpen },
];

const Sidebar = ({ user, watchlist }: SidebarProps) => {
    const pathname = usePathname();
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        router.push('/sign-in');
    };

    return (
        <aside className="sidebar">
            <Link href="/dashboard" className="px-2 pt-1 pb-2" aria-label="OpenStock dashboard">
                <Image src="/assets/images/logo.png" alt="OpenStock" width={150} height={38} priority />
            </Link>

            <div className="px-2 py-2 text-[10px] font-medium text-muted-foreground tracking-wider uppercase border-b border-line mb-3">
                <>
                    {APP_OWNER_NAME} <Shield className="size-3.5 inline" />
                </>
            </div>

            <button type="button" onClick={openSearch} className="side-cta">
                <Search className="size-4" strokeWidth={2.5} />
                <span className="flex-1 text-left">Hisse Ara</span>
            </button>

            <nav className="space-y-1 px-2 pt-2">
                {RESOURCES.map((item) => (
                    <a key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-hover text-muted-foreground font-medium text-sm">
                        <span>{item.icon}</span>
                        {item.label}
                    </a>
                ))}
                <div className="border-t border-line my-3 px-2"></div>
                <div className="flex items-center gap-2 px-2 pt-2">
                    <span className="text-xs font-medium text-muted-foreground">İzleme Listesi</span>
                    <span className="text-xs text-faint">{watchlist.length} sembol</span>
                </div>
                <div className="flex flex-col px-2 pb-2 gap-1">
                    {watchlist.map(({ symbol, company }) => (
                        <a key={symbol} href={`/stocks/${symbol}`} className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-hover text-sm">
                            <span className="text-xs font-medium text-muted-foreground">{symbol}</span>
                            <span className="text-xs text-faint truncate w-full ml-1">{company}</span>
                        </a>
                    ))}
                </div>
            </nav>
            <div className="mt-auto pt-6 pb-4 px-2 border-t border-line">
                <button onClick={handleSignOut} className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-hover text-muted-foreground font-medium text-sm w-full">
                    <LogOut className="size-4" />
                    Çıkış Yap
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
"""

with open('C:\\Users\\hakan\\OneDrive\\Desktop\\OpenStock-main\\OpenStock-main\\components\\shell\\Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Sidebar.tsx written successfully')