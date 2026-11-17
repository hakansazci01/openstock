'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Settings2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const ADMIN_NAV = [
    { href: '/admin', label: 'Genel Bakış', icon: BarChart3 },
    { href: '/admin/users', label: 'Kullanıcılar', icon: Users },
    { href: '/admin/settings', label: 'Sistem Ayarları', icon: Settings2 },
];

export default function AdminTabs() {
    const pathname = usePathname();

    return (
        <nav className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-page p-1.5">
            {ADMIN_NAV.map((item) => {
                const active = pathname === item.href;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                            'inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold transition-colors',
                            active ? 'bg-brand text-on-brand' : 'text-muted-foreground hover:bg-hover hover:text-foreground',
                        )}
                    >
                        <item.icon className="size-4" />
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
