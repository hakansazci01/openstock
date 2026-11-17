'use client';

import { useEffect, useRef } from 'react';
import { addSignalAlert, type StockSignal } from '@/lib/signal-alert-store';

const POLL_MS = 60_000;
const MAX_SYMBOLS = 12;
const SEEN_KEY = 'openstock-watchlist-signal-dedupe-v1';

type ApiSignal = {
    signal: StockSignal;
    price: number;
    confidence: number;
    reason: string;
};

const dayKey = () => new Date().toISOString().slice(0, 10);

function readSeen(): Set<string> {
    try {
        const raw = window.localStorage.getItem(SEEN_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
    } catch {
        return new Set();
    }
}

function writeSeen(seen: Set<string>) {
    try {
        window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-300)));
    } catch {
        /* private mode: in-memory dedupe still works for this tab */
    }
}

/**
 * Watches the user's watchlist and raises an in-app alert whenever a symbol
 * flips to AL or SAT. Signals are computed server-side and cached for five
 * minutes, so a 60-second poll is cheap.
 *
 * The first poll only seeds the baseline: it does not fire alerts for signals
 * that were already active before the page opened.
 */
export default function WatchlistSignalMonitor({ symbols }: { symbols: string[] }) {
    const lastSignals = useRef<Record<string, StockSignal>>({});
    const firstPoll = useRef(true);
    const key = [...new Set(symbols.filter(Boolean))].slice(0, MAX_SYMBOLS).join(',');

    useEffect(() => {
        if (!key) return;
        let cancelled = false;

        const poll = async () => {
            if (document.visibilityState !== 'visible') return;

            try {
                const res = await fetch(`/api/signals?symbols=${encodeURIComponent(key)}`, {
                    cache: 'no-store',
                });
                if (!res.ok || cancelled) return;

                const data: { signals?: Record<string, ApiSignal> } = await res.json();
                const signals = data.signals ?? {};

                if (firstPoll.current) {
                    firstPoll.current = false;
                    const baseline: Record<string, StockSignal> = {};
                    for (const [symbol, payload] of Object.entries(signals)) {
                        baseline[symbol] = payload.signal;
                    }
                    lastSignals.current = baseline;
                    return;
                }

                const seen = readSeen();
                let changed = false;

                for (const [symbol, payload] of Object.entries(signals)) {
                    const previous = lastSignals.current[symbol];
                    lastSignals.current[symbol] = payload.signal;

                    if (payload.signal !== 'AL' && payload.signal !== 'SAT') continue;
                    if (previous === payload.signal) continue;

                    const dedupeKey = `${dayKey()}:${symbol}:${payload.signal}`;
                    if (seen.has(dedupeKey)) continue;

                    seen.add(dedupeKey);
                    changed = true;
                    addSignalAlert({
                        symbol,
                        signal: payload.signal,
                        price: payload.price,
                        reason: payload.reason,
                        source: 'watchlist',
                    });
                }

                if (changed) writeSeen(seen);
            } catch {
                /* transient network error: keep the last baseline and retry next tick */
            }
        };

        void poll();
        const interval = setInterval(poll, POLL_MS);
        const onVisibility = () => {
            if (document.visibilityState === 'visible') void poll();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [key]);

    return null;
}
