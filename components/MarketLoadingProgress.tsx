'use client';

import { useState, useEffect, useRef } from 'react';

const MARKETS = [
    { id: 'tr', name: 'Türkiye (BIST)', symbols: 16 },
    { id: 'us', name: 'Amerika (US)', symbols: 20 },
    { id: 'crypto', name: 'Kripto Paralar', symbols: 15 },
    { id: 'fx', name: 'Döviz (FX)', symbols: 10 },
];

export function MarketLoadingProgress() {
    const [progress, setProgress] = useState(0);
    const [currentMarket, setCurrentMarket] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [hasSeen, setHasSeen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const seen = localStorage.getItem('openstock-first-load') === '1';
        setHasSeen(seen);
        if (!seen) localStorage.setItem('openstock-start-time', Date.now().toString());
        if (seen) setIsLoading(false);
    }, []);

    useEffect(() => {
        if (hasSeen) { setIsLoading(false); return; }
        if (currentMarket >= MARKETS.length) {
            setIsLoading(false);
            localStorage.setItem('openstock-first-load', '1');
            return;
        }

        if (timerRef.current) clearInterval(timerRef.current);

        let p = 0;
        timerRef.current = setInterval(() => {
            p += Math.random() * 10 + 5;

            if (p >= 100) {
                p = 100;
                clearInterval(timerRef.current!);
                timerRef.current = null;
                setCurrentMarket((m) => m + 1);
            } else {
                setProgress(Math.round((currentMarket * 25 + p / 4) / 100 * 100));
            }
        }, 150);

        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [currentMarket, hasSeen]);

    if (!isLoading) return null;

    const overall = Math.round(((currentMarket * 25) + (progress / 4)) / 100 * 100);
    const remaining = Math.max(0, 40 - Math.floor((Date.now() - parseInt(localStorage.getItem('openstock-start-time') || '0')) / 1000));

    return (
        <div className="fixed inset-0 z-[100] bg-page/97 backdrop-blur-sm flex flex-col items-center justify-center p-6">
            <div className="mb-6 text-center max-w-md">
                <h2 className="text-2xl font-bold mb-1">İlk Açılış · Piyasa Kurulumu</h2>
                <p className="text-faint text-sm">Ana piyasanın güncel verileri hazırlanıyor...</p>
            </div>

            <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold">{overall}% Tamamlandı</span>
                <span className="text-xs font-mono font-bold">{remaining} sn</span>
            </div>
            <div className="w-full bg-line rounded-full h-3 overflow-hidden">
                <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${overall}%` }} />
            </div>

            <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                    <span className="animate-spin">⟳</span>
                </div>
                <div>
                    <div className="text-sm font-medium">{MARKETS[currentMarket]?.name || 'Hazır'}</div>
                    <div className="text-xs text-faint">{MARKETS[currentMarket]?.symbols} hisse</div>
                </div>
            </div>

            <div className="mt-4 w-full max-w-md space-y-1">
                {MARKETS.map((m, i) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded border border-line/50">
                        <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${i < currentMarket ? 'bg-brand-success text-white' : i === currentMarket ? 'bg-brand text-white' : 'bg-line text-faint'}`}>
                                {i < currentMarket ? '✓' : i === currentMarket ? '⟳' : m.id.slice(0, 2).toUpperCase()}
                            </span>
                            <span className={`text-xs ${i < currentMarket ? 'text-foreground' : 'text-faint'}`}>{m.name}</span>
                        </div>
                        <span className={`text-[10px] font-mono ${i < currentMarket ? 'text-brand-success' : 'text-faint'}`}>
                            {i < currentMarket ? '100%' : i === currentMarket ? Math.round(progress) + '%' : '0%'}
                        </span>
                    </div>
                ))}
            </div>

            <p className="mt-6 text-[11px] text-faint text-center">İkinci açışta bu ekran görünmez.</p>
        </div>
    );
}