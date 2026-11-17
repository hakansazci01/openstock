'use client';

import React, { memo, useState, useEffect } from 'react';
import useTradingViewWidget from "@/hooks/useTradingViewWidget";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2, AlertTriangle, Loader2 } from 'lucide-react';

interface TradingViewWidgetProps {
    scriptUrl: string;
    config: Record<string, unknown>;
    height?: number;
    className?: string;
    allowExpand?: boolean;
}

// Fullscreen resizes the same element in place: moving or re-creating the embed would reset the chart.
const TradingViewWidget = ({ scriptUrl, config, height = 600, className, allowExpand = false }: TradingViewWidgetProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { containerRef, state } = useTradingViewWidget(scriptUrl, config);

    useEffect(() => {
        if (!isExpanded) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsExpanded(false);
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [isExpanded]);

    const isLoading = state === 'loading';
    const hasError = state === 'error';

    return (
        <>
            {isExpanded && <div className="fixed inset-0 z-50 bg-page/70 backdrop-blur-[3px]" onClick={() => setIsExpanded(false)} />}
            <div
                className={cn("tv-frame group", isExpanded && "fixed inset-3 z-50 shadow-[0_0_0_4px_var(--frame),0_24px_60px_oklch(0_0_0/0.6)]")}
                style={isExpanded ? undefined : { height }}
            >
                {allowExpand && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={cn("icon-btn absolute top-2 right-2 z-10 bg-card/80", !isExpanded && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100")}
                        aria-label={isExpanded ? "Exit full screen" : "Full screen"}
                        title={isExpanded ? "Exit full screen (Esc)" : "Full screen"}
                    >
                        {isExpanded ? <Minimize2 /> : <Maximize2 />}
                    </button>
                )}

                {hasError ? (
                    <div className="flex flex-col items-center justify-center h-full p-4 text-faint">
                        <AlertTriangle className="size-8 mb-2 opacity-50" />
                        <p className="text-sm">Grafik yüklenemedi. TradingView bağlantısını kontrol edin.</p>
                    </div>
                ) : (
                    <div
                        ref={containerRef}
                        className={cn('tradingview-widget-container', className, isLoading && 'opacity-50')}
                        style={{ height: '100%', width: '100%' }}
                    >
                        {isLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                                <Loader2 className="size-6 animate-spin text-white" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default memo(TradingViewWidget);