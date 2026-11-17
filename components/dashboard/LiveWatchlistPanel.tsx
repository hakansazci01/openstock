'use client';

import React from 'react';
import Panel from '@/components/Panel';
import { useLiveQuotes } from '@/hooks/useLiveQuotes';
import { formatPrice } from '@/lib/utils';
import Link from 'next/link';

interface LiveWatchlistRow {
    symbol: string;
    company: string;
    currency?: string;
}

export default function LiveWatchlistPanel({ symbols }: { symbols: LiveWatchlistRow[] }) {
    const symbolList = symbols.map((s) => s.symbol);
    const live = useLiveQuotes(symbolList);

    return (
        <Panel title="Canlı Fiyatlar" sub="Watchlist'ınızdaki sembollerin anlık fiyatları">
            {symbols.length === 0 ? (
                <p className="text-faint text-center py-8">
                    Watchlist'inizde sembol yok. Sembol ekleyerek fiyatları takip edebilirsiniz.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                    <table className="data-table w-full">
                        <thead>
                            <tr>
                                <th>Sembol</th>
                                <th className="is-num">Fiyat</th>
                                <th className="is-num">Günlük</th>
                                <th className="is-num">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {symbols.map((row) => {
                                const q = live[row.symbol];
                                const price = q?.c ?? 0;
                                const change = q?.d ?? 0;
                                const changePercent = q?.dp ?? 0;
                                const isUp = change >= 0;
                                return (
                                    <tr key={row.symbol}>
                                        <td>
                                            <Link href={`/stocks/${row.symbol}`} className="text-foreground hover:text-brand-ink transition-colors">
                                                {row.symbol}
                                            </Link>
                                        </td>
                                        <td className="is-num font-semibold text-foreground">
                                            {price ? formatPrice(price, row.currency) : '—'}
                                        </td>
                                        <td className={`is-num ${isUp ? 'text-up' : 'text-down'}`}>
                                            {price ? `${isUp ? '+' : ''}${change.toFixed(2)}` : '—'}
                                        </td>
                                        <td className={`is-num ${isUp ? 'text-up' : 'text-down'}`}>
                                            {price ? `${isUp ? '+' : ''}${changePercent.toFixed(2)}%` : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </Panel>
    );
}