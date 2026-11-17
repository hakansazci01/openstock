'use client';

import { useEffect, useRef, useState } from 'react';
import { getStockSignal } from '@/lib/actions/finnhub.actions';
import { calculateProfessionalSignal, type SignalType, type TechnicalAnalysis } from '@/lib/technical-analysis';
import { addSignalAlert } from '@/lib/signal-alert-store';
import { AlertTriangle } from 'lucide-react';

interface StockSignalCardProps {
    symbol: string;
    initialPrice?: number | null;
}

const SIGNAL_COLOR: Record<SignalType, string> = {
    AL: 'text-up bg-up/10 border-up/20',
    SAT: 'text-down bg-down/10 border-down/20',
    BEKLE: 'text-muted-foreground',
};

const SIGNAL_LABEL: Record<SignalType, string> = {
    AL: '🟢 AL',
    SAT: '🔴 SAT',
    BEKLE: '🟡 BEKLE',
};

async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission as NotificationPermission;
}

export default function StockSignalCard({ symbol, initialPrice }: StockSignalCardProps) {
    const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
    const [price, setPrice] = useState<number | null>(initialPrice ?? null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notificationsAllowed, setNotificationsAllowed] = useState(false);
    const prevSignal = useRef<SignalType>('BEKLE');
    const notified = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationsAllowed(Notification.permission === 'granted');
        }
    }, []);

    useEffect(() => {
        requestNotificationPermission();

        const fetchSignal = async () => {
            try {
                setLoading(true);
                const data = await getStockSignal(symbol);
                const quote = data.quote;
                const candles = data.candles;

                if (quote?.c) {
                    setPrice(quote.c);

                    let sig: TechnicalAnalysis;
                    if (candles && candles.length >= 50) {
                        sig = calculateProfessionalSignal(candles, quote.c);
                    } else {
                        const dp = quote.dp ?? 0;
                        let signal: SignalType = 'BEKLE';
                        if (dp <= -3) signal = 'AL';
                        else if (dp >= 3) signal = 'SAT';
                        sig = {
                            symbol, currentPrice: quote.c, signal, confidence: 30,
                            score: signal === 'AL' ? 30 : signal === 'SAT' ? -30 : 0,
                            indicators: [],
                            support: null, resistance: null,
                            stopLoss: null, takeProfit: null,
                            prediction: {
                                shortTerm: signal,
                                mediumTerm: signal,
                                longTerm: signal,
                                predictedPrice: quote.c,
                                predictedChangePercent: 0,
                            },
                            timestamp: Date.now(),
                        };
                    }

                    setAnalysis(sig);

                    const previous = prevSignal.current;
                    prevSignal.current = sig.signal;

                    if ((sig.signal === 'AL' || sig.signal === 'SAT') && previous !== sig.signal && !notified.current.has(sig.signal + symbol)) {
                        notified.current.add(sig.signal + symbol);
                        addSignalAlert({
                            symbol,
                            signal: sig.signal,
                            price: quote.c,
                            reason: sig.indicators.map(i => i.reason).filter(Boolean).join(' · ') || '',
                        });

                        if (typeof window !== 'undefined' && Notification.permission === 'granted') {
                            new Notification(`OpenStock - ${sig.signal} Sinyali`, {
                                body: `${symbol}: ${quote.c.toLocaleString('tr-TR', { style: 'currency', currency: 'USD' })}`,
                                icon: '/favicon.ico',
                            });
                        }
                    }
                } else {
                    setError('Fiyat verisi alınamadı');
                }
            } catch (e) {
                setError('Analiz yükleme hatası');
                console.error('StockSignalCard error:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchSignal();
        const interval = setInterval(fetchSignal, 30000);
        return () => clearInterval(interval);
    }, [symbol]);

    if (loading) {
        return (
            <div className="hatch p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-foreground">Analiz ve Sinyal</h2>
                    <span className="text-xs font-bold px-2 py-1 rounded text-muted-foreground">🟡 BEKLE</span>
                </div>
                <div className="p-3 rounded-lg bg-page border border-line animate-pulse">
                    <p className="text-xs text-faint mb-1">Anlık Fiyat</p>
                    <p className="text-xl font-bold text-foreground">—</p>
                </div>
            </div>
        );
    }

    if (error || !analysis) {
        return (
            <div className="hatch p-4">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-semibold text-foreground">Analiz ve Sinyal</h2>
                    <span className="text-xs font-bold px-2 py-1 rounded text-muted-foreground">🟡 BEKLE</span>
                </div>
                <div className="p-3 rounded-lg bg-page border border-line">
                    <p className="text-xs text-faint mb-1">Anlık Fiyat</p>
                    <p className="text-xl font-bold text-foreground">
                        {price ? price.toLocaleString('tr-TR', { style: 'currency', currency: 'USD' }) : '—'}
                    </p>
                    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
                </div>
            </div>
        );
    }

    const sig = analysis.signal;
    const color = SIGNAL_COLOR[sig];
    const label = SIGNAL_LABEL[sig];

    return (
        <div className="hatch p-4">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-foreground">Profesyonel Analiz</h2>
                <span className={`text-xs font-bold px-2 py-1 rounded ${color}`}>
                    {label}  •  Güven: %{analysis.confidence}
                </span>
            </div>

            <div className="p-3 rounded-lg bg-page border border-line mb-3">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <p className="text-xs text-faint mb-1">Anlık Fiyat</p>
                        <p className="text-xl font-bold text-foreground">
                            {analysis.currentPrice.toLocaleString('tr-TR', { style: 'currency', currency: 'USD' })}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-faint mb-1">Puan</p>
                        <p className={`text-sm font-bold ${sig === 'AL' ? 'text-up' : sig === 'SAT' ? 'text-down' : 'text-muted-foreground'}`}>
                            {analysis.score > 0 ? '+' : ''}{analysis.score}
                        </p>
                    </div>
                </div>
            </div>
            <div className="flex gap-3">
                {analysis.support && (
                    <div className="flex-1 p-2 rounded bg-up/5 border border-up/10">
                        <p className="text-[10px] text-up font-medium mb-1">Destek</p>
                        <p className="text-sm font-mono text-up">{analysis.support.toFixed(2)}</p>
                    </div>
                )}
                {analysis.resistance && (
                    <div className="flex-1 p-2 rounded bg-down/5 border border-down/10">
                        <p className="text-[10px] text-down font-medium mb-1">Direnç</p>
                        <p className="text-sm font-mono text-down">{analysis.resistance.toFixed(2)}</p>
                    </div>
                )}
            </div>
            <div className="flex gap-3 mt-2">
                {analysis.stopLoss && (
                    <div className="flex-1 p-2 rounded bg-down/5 border border-down/10">
                        <p className="text-[10px] text-down font-medium mb-1">Stop Loss</p>
                        <p className="text-sm font-mono text-down">{analysis.stopLoss.toFixed(2)}</p>
                    </div>
                )}
                {analysis.takeProfit && (
                    <div className="flex-1 p-2 rounded bg-up/5 border border-up/10">
                        <p className="text-[10px] text-up font-medium mb-1">Take Profit</p>
                        <p className="text-sm font-mono text-up">{analysis.takeProfit.toFixed(2)}</p>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
                {analysis.indicators.map((ind) => {
                    const indColor = ind.signal === 'AL' ? 'text-up' : ind.signal === 'SAT' ? 'text-down' : 'text-muted-foreground';
                    return (
                        <div key={ind.name} className="p-2 rounded bg-page border border-line">
                            <p className="text-[10px] text-faint mb-1">{ind.name}</p>
                            <div className="flex items-baseline gap-1">
                                <span className={`text-sm font-mono font-bold ${indColor}`}>
                                    {ind.value != null ? ind.value.toFixed(2) : '—'}
                                </span>
                                <span className={`text-[10px] ${indColor}`}>{ind.signal === 'AL' ? 'AL' : ind.signal === 'SAT' ? 'SAT' : 'BEKLE'}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{ind.reason}</p>
                        </div>
                    );
                })}
            </div>

            <div className="p-2 rounded bg-page border border-line mb-3">
                <p className="text-[10px] text-faint mb-1">Fiyat Tahmini</p>
                <div className="flex gap-2">
                    <div className="flex-1 text-center p-1 rounded border border-line/50">
                        <span className="text-[10px] text-faint">Kısa Vadeli</span>
                        <span className={`text-xs font-bold ${SIGNAL_COLOR[analysis.prediction.shortTerm]}`}>
                            {SIGNAL_LABEL[analysis.prediction.shortTerm]}
                        </span>
                    </div>
                    <div className="flex-1 text-center p-1 rounded border border-line/50">
                        <span className="text-[10px] text-faint">Orta Vadeli</span>
                        <span className={`text-xs font-bold ${SIGNAL_COLOR[analysis.prediction.mediumTerm]}`}>
                            {SIGNAL_LABEL[analysis.prediction.mediumTerm]}
                        </span>
                    </div>
                    <div className="flex-1 text-center p-1 rounded border border-line/50">
                        <span className="text-[10px] text-faint">Uzun Vadeli</span>
                        <span className={`text-xs font-bold ${SIGNAL_COLOR[analysis.prediction.longTerm]}`}>
                            {SIGNAL_LABEL[analysis.prediction.longTerm]}
                        </span>
                    </div>
                </div>
                {analysis.prediction.predictedPrice && (
                    <p className="text-xs text-faint mt-1">
                        Tahmini Fiyat: {analysis.prediction.predictedPrice.toLocaleString('tr-TR', { style: 'currency', currency: 'USD' })} (
                        {analysis.prediction.predictedChangePercent != null ? (analysis.prediction.predictedChangePercent >= 0 ? '+' : '') : ''}{analysis.prediction.predictedChangePercent ?? 0}%
                        )
                    </p>
                )}
            </div>

            {!notificationsAllowed && typeof window !== 'undefined' && 'Notification' in window && (
                <button
                    onClick={async () => {
                        const permission = await requestNotificationPermission();
                        setNotificationsAllowed(permission === 'granted');
                    }}
                    className="w-full py-2 px-3 rounded border border-line bg-page hover:bg-muted text-xs text-muted-foreground transition-colors mt-3"
                >
                    <AlertTriangle className="size-3 mr-1" /> Tarayıcı bildirimlerine izin ver
                </button>
            )}
        </div>
    );
}