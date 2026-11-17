'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BellRing, X } from 'lucide-react';
import {
    hydrateSignalAlerts,
    markAlertAsRead,
    subscribe,
    type SignalAlert,
} from '@/lib/signal-alert-store';
import { cn, formatPrice } from '@/lib/utils';

const AUTO_DISMISS_MS = 9_000;
const MAX_VISIBLE = 4;

/**
 * In-app AL/SAT pop-ups.
 *
 * Only alerts that arrive after this component mounts are shown; alerts restored
 * from a previous session stay in the bell list. Each pop-up disappears on its
 * own and can be dismissed, which also marks it as read.
 */
export function SignalAlertToast() {
    const mountedAt = useRef(Date.now());
    const seen = useRef<Set<string>>(new Set());
    const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const [visible, setVisible] = useState<SignalAlert[]>([]);

    const dismiss = useCallback((id: string, markRead = false) => {
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
        setVisible((current) => current.filter((alert) => alert.id !== id));
        if (markRead) markAlertAsRead(id);
    }, []);

    useEffect(() => {
        hydrateSignalAlerts();

        const unsubscribe = subscribe((alerts) => {
            const fresh = alerts.filter(
                (alert) => alert.timestamp >= mountedAt.current && !seen.current.has(alert.id),
            );
            if (fresh.length === 0) return;

            fresh.forEach((alert) => {
                seen.current.add(alert.id);
                const timer = setTimeout(() => dismiss(alert.id), AUTO_DISMISS_MS);
                timers.current.set(alert.id, timer);
            });

            setVisible((current) => [...fresh, ...current].slice(0, MAX_VISIBLE));
        });

        const timersAtCleanup = timers.current;
        return () => {
            unsubscribe();
            timersAtCleanup.forEach((timer) => clearTimeout(timer));
            timersAtCleanup.clear();
        };
    }, [dismiss]);

    if (visible.length === 0) return null;

    return (
        <div className="pointer-events-none fixed right-3 top-14 z-[60] flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2">
            {visible.map((alert) => {
                const isBuy = alert.signal === 'AL';
                return (
                    <div
                        key={alert.id}
                        role="status"
                        className="pointer-events-auto w-full rounded-xl border border-line bg-card p-3 shadow-xl shadow-black/30 animate-in fade-in slide-in-from-right-2"
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <span
                                    className={cn(
                                        'grid size-8 shrink-0 place-items-center rounded-lg border text-[13px] font-bold',
                                        isBuy
                                            ? 'border-up/25 bg-up/15 text-up'
                                            : 'border-down/25 bg-down/15 text-down',
                                    )}
                                >
                                    {isBuy ? 'AL' : 'SAT'}
                                </span>
                                <div className="min-w-0">
                                    <Link
                                        href={`/stocks/${encodeURIComponent(alert.symbol)}`}
                                        className="mono block truncate text-[13px] font-bold text-foreground hover:text-brand-ink"
                                    >
                                        {alert.symbol}
                                    </Link>
                                    <p className="text-[10.5px] text-faint">
                                        {isBuy ? 'Alım sinyali' : 'Satım sinyali'} ·{' '}
                                        {new Date(alert.timestamp).toLocaleTimeString('tr-TR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => dismiss(alert.id, true)}
                                className="icon-btn size-6 shrink-0"
                                aria-label="Uyarıyı kapat"
                            >
                                <X />
                            </button>
                        </div>

                        <div className="mt-2 flex items-center gap-2 border-t border-line pt-2">
                            <span
                                className={cn(
                                    'mono text-[12.5px] font-bold',
                                    isBuy ? 'text-up' : 'text-down',
                                )}
                            >
                                {formatPrice(alert.price)}
                            </span>
                            {alert.reason && (
                                <span className="truncate text-[11px] text-faint" title={alert.reason}>
                                    {alert.reason}
                                </span>
                            )}
                            <Link
                                href={`/stocks/${encodeURIComponent(alert.symbol)}`}
                                className="ml-auto shrink-0 text-[11px] font-semibold text-brand-ink hover:underline"
                                onClick={() => dismiss(alert.id, true)}
                            >
                                Aç
                            </Link>
                        </div>
                    </div>
                );
            })}
            <span className="pointer-events-none flex items-center justify-end gap-1 px-1 text-[10px] text-faint">
                <BellRing className="size-3" /> Sinyal uyarıları
            </span>
        </div>
    );
}
