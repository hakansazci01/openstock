'use client';

import { Database, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

type DataSourceType = 'finnhub' | 'yahoo';

interface BotDataSourceInfo {
    symbol: string;
    source: DataSourceType;
    label: string;
}

function getSourceInfo(symbol: string): BotDataSourceInfo {
    const isYahoo = symbol.includes('.IS') || symbol.includes('.SR');
    return {
        symbol,
        source: isYahoo ? 'yahoo' : 'finnhub',
        label: isYahoo ? 'Yahoo Finance' : 'Finnhub',
    };
}

export function BotDataSources({ symbols }: { symbols: string[] }) {
    const sources = symbols.map(getSourceInfo);
    const finnhubCount = sources.filter((s) => s.source === 'finnhub').length;
    const yahooCount = sources.filter((s) => s.source === 'yahoo').length;

    return (
        <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
                <div className="card p-4 flex items-center gap-3 bg-blue-50 border border-blue-100">
                    <Database className="w-5 h-5 text-blue-600" />
                    <div>
                        <p className="text-[10px] uppercase font-semibold tracking-wide text-faint">Finnhub</p>
                        <p className="text-lg font-bold text-blue-600">{finnhubCount}</p>
                    </div>
                    <span className="ml-auto text-[10px] font-bold text-faint">ABD / Uluslararası</span>
                </div>
                <div className="card p-4 flex items-center gap-3 bg-purple-50 border border-purple-100">
                    <Monitor className="w-5 h-5 text-purple-600" />
                    <div>
                        <p className="text-[10px] uppercase font-semibold tracking-wide text-faint">Yahoo Finance</p>
                        <p className="text-lg font-bold text-purple-600">{yahooCount}</p>
                    </div>
                    <span className="ml-auto text-[10px] font-bold text-faint">BIST / Saudi</span>
                </div>
            </div>

            <div className="hatch">
                <div className="card">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">Veri Kaynakları</p>
                            <p className="text-[10px] text-faint">Toplam {symbols.length} sembolün veri kaynağı</p>
                        </div>
                    </div>
                    <div className="px-4 pb-4">
                        <div className="overflow-x-auto">
                            <table className="data-table w-full">
                                <thead>
                                    <tr>
                                        <th className="text-left">Sembol</th>
                                        <th className="text-left">Veri Kaynağı</th>
                                        <th className="text-left">Bölge</th>
                                        <th className="text-left">Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sources.map((src) => {
                                        const region =
                                            src.source === 'yahoo'
                                                ? src.symbol.includes('.IS')
                                                    ? 'Türkiye (BIST)'
                                                    : 'Saudi (Tadawul)'
                                                : 'Uluslararası';
                                        return (
                                            <tr key={src.symbol}>
                                                <td className="mono font-semibold text-foreground">{src.symbol}</td>
                                                <td>
                                                    <span className={cn(
                                                        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold',
                                                        src.source === 'finnhub' ? 'text-blue-600 bg-blue-50 border border-blue-100' : 'text-purple-600 bg-purple-50 border border-purple-100'
                                                    )}
                                                    >
                                                        {src.source === 'finnhub' ? <Database className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                                                        {src.label}
                                                    </span>
                                                </td>
                                                <td className="text-[11px] text-faint">{region}</td>
                                                <td>
                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-line text-[10px] text-faint">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-brand-success" />
                                                        Aktif
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
            </div>
        </div>
    );
}