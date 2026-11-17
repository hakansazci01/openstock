'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickSeries, type ISeriesApi } from 'lightweight-charts';
import { cn } from '@/lib/utils';

interface LightweightChartProps {
    symbol: string;
    data: Array<{ time: string; open: number; high: number; low: number; close: number }>;
    className?: string;
}

export function LightweightChart({ symbol, data, className }: LightweightChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick', number> | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0f172a' },
                textColor: '#e2e8f0',
            },
            grid: {
                vertLines: { color: '#1e293b' },
                horzLines: { color: '#1e293b' },
            },
            width: containerRef.current.clientWidth || 600,
            height: containerRef.current.clientHeight || 300,
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            borderVisible: false,
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries as unknown as ISeriesApi<'Candlestick', number>;

        if (data.length > 0) {
            const chartData = data.map((d) => ({
                time: Math.floor(new Date(d.time).getTime() / 1000),
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }));
            candlestickSeries.setData(chartData as unknown as Parameters<typeof candlestickSeries.setData>[0]);
        }

        chart.timeScale().fitContent();
        setIsReady(true);

        return () => {
            chart.remove();
            chartRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (seriesRef.current && data.length > 0) {
            const chartData = data.map((d) => ({
                time: Math.floor(new Date(d.time).getTime() / 1000),
                open: d.open,
                high: d.high,
                low: d.low,
                close: d.close,
            }));
            seriesRef.current.setData(chartData as unknown as Parameters<typeof seriesRef.current.setData>[0]);
            chartRef.current?.timeScale().fitContent();
        }
    }, [data, symbol]);

    return (
        <div className={cn('w-full h-[300px]', className)} ref={containerRef}>
            {isReady && <div className="absolute top-2 right-2 text-[10px] text-faint">{symbol}</div>}
        </div>
    );
}
