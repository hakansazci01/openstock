'use client';

import { useEffect, useState } from 'react';
import { Database, Monitor, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type DataSource = 'finnhub' | 'yahoo';

interface QuoteData {
    [symbol: string]: {
        c?: number;
        d?: number;
        dp?: number;
        price?: number;
        change?: number;
        changePercent?: number;
    };
}
interface TradeAnalysis {
    symbol: string;
    source: DataSource;
    label: string;
    price: number;
    change: number;
    changePercent: number;
    updatedAt: Date;
}

function getSource(symbol: string): DataSource {
    return symbol.includes('.IS') || symbol.includes('.SR') ? 'yahoo' : 'finnhub';
}

interface SourceConfig {
    icon: typeof Database;
    color: string;
    bg: string;
    border: string;
    label: string;
}

function getSourceConfig(source: DataSource): SourceConfig {
    return source === 'finnhub'
        ? { icon: Database, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', label: 'Finnhub' }
        : { icon: Monitor, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', label: 'Yahoo Finance' };
}

export function BotTradeAnalysis({ trades }: { trades: Array<{ symbol: string; price: number; side: 'buy' | 'sell'; pnl?: number }> }) {
    const [analysis, setAnalysis] = useState<TradeAnalysis[]>([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    useEffect(() => {
        if (!trades.length) return;

        const uniqueSymbols = [...new Set(trades.map((t) => t.symbol))];

        const initial: TradeAnalysis[] = uniqueSymbols.map((symbol) => {
            const trade = trades.find((t) => t.symbol === symbol);
            const source = getSource(symbol);
            const cfg = getSourceConfig(source);

            return {
                symbol,
                source,
                label: cfg.label,
                price: trade?.price ?? 0,
                change: 0,
                changePercent: 0,
                updatedAt: new Date(),
            };
        });

        setAnalysis(initial);
        setLastUpdate(new Date());

        const interval = setInterval(async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/quotes?symbols=${uniqueSymbols.join(',')}`);
                if (response.ok) {
                    const data: QuoteData = await response.json();
                    setAnalysis((prev) =>
                        prev.map((a) => {
                            const quote = data[a.symbol];
                            const price = quote?.c ?? quote?.price ?? a.price;
                            const change = quote?.d ?? quote?.change ?? 0;
                            const changePercent = quote?.dp ?? quote?.changePercent ?? 0;
                            return { ...a, price, change, changePercent, updatedAt: new Date() };
                        })
                    );
                    setLastUpdate(new Date());
                }
            } catch {
            } finally {
                setLoading(false);
            }
        }, 15000);

        return () => clearInterval(interval);
    }, [trades]);

    if (!analysis.length) return null;

    return (
        <div className="space-y-3">
            <div className="card p-4">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
                    <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-faint animate-[spin_2s_linear_infinite]" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">Anlık Analiz Verileri</span>
                    </div>
                    {loading && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-line text-[10px] text-faint">
                            Güncelleniyor…
                        </span>
                    )}
                    {lastUpdate && (
                        <span className="text-[10px] text-faint">{lastUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                </div>
                <div className="px-4 pb-4">
                    <div className="overflow-x-auto">
                        <table className="data-table w-full">
                            <thead>
                                <tr>
                                    <th className="text-left">Sembol</th>
                                    <th className="text-left">Kaynak</th>
                                    <th className="text-right is-num">Anlık Fiyat</th>
                                    <th className="text-right is-num">Değişim</th>
                                    <th className="text-right is-num">%</th>
                                    <th className="text-left">Durum</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.map((a) => {
                                    const cfg = getSourceConfig(a.source);
                                    const isUp = a.change >= 0;
                                    return (
                                        <tr key={a.symbol}>
                                            <td className="mono font-semibold text-foreground">{a.symbol}</td>
                                            <td>
                                                <span className={cn(
                                                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold',
                                                    cfg.color,
                                                    cfg.bg,
                                                    cfg.border,
                                                )}
                                                >
                                                    <cfg.icon className="w-3 h-3" />
                                                    {a.label}
                                                </span>
                                            </td>
                                            <td className="is-num font-medium">{a.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td className={`is-num font-medium ${isUp ? 'text-up' : 'text-down'}`}>
                                                {isUp ? '+' : ''}{a.change.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className={`is-num font-medium ${isUp ? 'text-up' : 'text-down'}`}>
                                                {isUp ? '+' : ''}{a.changePercent.toFixed(2)}%
                                            </td>
                                            <td>
                                                <span
                                                    className={cn(
                                                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold',
                                                        isUp ? 'bg-up/10 text-up' : 'bg-down/10 text-down',
                                                    )}
                                                >
                                                    {isUp ? 'YÜKSELİŞ' : 'DÜŞÜŞ'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                <div className="card p-3 bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-semibold text-blue-600 uppercase">Finnhub</span>
                    </div>
                    <p className="text-[11px] text-faint mt-1">
                        {analysis.filter((a) => a.source === 'finnhub').length} sembol
                    </p>
                </div>
                <div className="card p-3 bg-purple-50 border border-purple-100">
                    <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-purple-600" />
                        <span className="text-[10px] font-semibold text-purple-600 uppercase">Yahoo Finance</span>
                    </div>
                    <p className="text-[11px] text-faint mt-1">
                        {analysis.filter((a) => a.source === 'yahoo').length} sembol
                    </p>
                </div>
            </div>
        </div>
    );
}