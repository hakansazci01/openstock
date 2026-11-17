'use client';

import Link from "next/link";
import { MARKETS, MARKET_COOKIE, type MarketId } from "@/lib/markets";
import { cn } from "@/lib/utils";

// Market chips for the dashboard. The choice is remembered in a cookie so the server renders it next time.
export default function MarketSwitcher({ active, openIds }: { active: MarketId; openIds: MarketId[] }) {
    const remember = (id: MarketId) => {
        document.cookie = `${MARKET_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    };

    return (
        <nav aria-label="Markets" className="flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {MARKETS.map((m) => {
                const selected = m.id === active;
                const open = openIds.includes(m.id);
                return (
                    <Link
                        key={m.id}
                        href={`/dashboard?market=${m.id}`}
                        onClick={() => remember(m.id)}
                        aria-current={selected ? 'page' : undefined}
                        className={cn(
                            'flex h-9 flex-none items-center gap-2 rounded-full px-3.5 text-[13.5px] font-semibold transition-[background-color,color,box-shadow,border-width] duration-200',
                            selected
                                ? 'bg-brand-soft text-brand-ink shadow-[inset_0_0_0_2px_oklch(0.8_0.13_176/0.6)] border-2 border-brand-ink'
                                : 'text-muted-foreground shadow-[inset_0_0_0_1px_var(--line)] hover:bg-hover hover:text-foreground border border-transparent',
                        )}
                    >
                        <span className={cn('size-1.5 rounded-full', open ? 'bg-up' : 'bg-line-strong')} title={open ? 'Şu anda açık' : 'Şu anda kapalı'} />
                        {m.name}
                    </Link>
                );
            })}
        </nav>
    );
}