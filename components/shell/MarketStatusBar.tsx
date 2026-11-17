'use client';

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMarket, isMarketOpen, MARKET_COOKIE } from '@/lib/markets';
import { newYorkNow, sessionOf } from '@/lib/market-session';

function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
    return undefined;
}

export function MarketStatusBar() {
    const [status, setStatus] = useState<{ open: boolean; market: string; line: string; phase: 'open' | 'closed' | 'pre' | 'after' } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const update = () => {
            try {
                const saved = getCookie(MARKET_COOKIE);
                const market = getMarket(saved ?? undefined);
                const open = isMarketOpen(market);

                const now = newYorkNow(new Date());
                const session = now ? sessionOf(now.weekday, now.minutes) : null;

                setStatus({
                    open,
                    market: market.short,
                    line: session?.line ?? (open ? 'Piyasa açık' : 'Piyasa kapalı'),
                    phase: session?.phase ?? (open ? 'open' : 'closed'),
                });
            } catch {
                // sessis hata yok
            } finally {
                setLoading(false);
            }
        };

        update();
        const id = setInterval(update, 15_000);
        return () => clearInterval(id);
    }, []);

    if (loading || !status) return null;

    const isOpen = status.phase === 'open' || status.phase === 'pre' || status.phase === 'after';

    return (
        <div
            className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider',
                isOpen ? 'bg-up/10 border-up/30 text-up' : 'bg-down/10 border-down/30 text-down',
            )}
            title={`${status.market} · ${status.line}`}
        >
            <Activity className={`w-3 h-3 ${isOpen ? 'text-up' : 'text-down'}`} />
            <span>{status.market}</span>
            <span>{isOpen ? 'AÇIK' : 'KAPALI'}</span>
        </div>
    );
}