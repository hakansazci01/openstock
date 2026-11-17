content = r'''
'use client';

import { useEffect, useRef, useState } from 'react';
import { getLiveQuotes, getCandles } from '@/lib/actions/finnhub.actions';
import { getYahooDailyQuotes } from '@/lib/actions/yahoo.actions';
import { hasFinnhubQuotes } from '@/lib/markets';
import type { YahooDailyQuote } from '@/lib/yahoo';
import { type SignalType as StockSignal, calculateProfessionalSignal, type TechnicalAnalysis } from '@/lib/technical-analysis';
import { Clock, Bell, BellOff } from 'lucide-react';
import { requestNotificationPermission, showStockNotification, getNotificationPermission } from '@/lib/browser-notifications';
import { addSignalAlert } from '@/lib/signal-alert-store';

interface StockSignalCardProps {
    symbol: string;
    initialPrice?: number | null;
    initialChangePercent?: number | null;
}

export default function StockSignalCard({
    symbol,
    initialPrice,
    initialChangePercent,
}: StockSignalCardProps) {
    const [price, setPrice] = useState<number | null>(initialPrice ?? null);
    const [changePercent, setChangePercent] = useState<number | null>(initialChangePercent ?? null);
    const [signal, setSignal] = useState<StockSignal>('BEKLE');
    const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [dataSource, setDataSource] = useState<string>('Finnhub');
    const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default' | 'checking'>('checking');
    const prevSignal = useRef<StockSignal>('BEKLE');

export default function StockSignalCard({
    symbol,
    initialPrice,
    initialChangePercent,
}: StockSignalCardProps) {
    const [price, setPrice] = useState<number | null>(initialPrice ?? null);
    const [changePercent, setChangePercent] = useState<number | null>(initialChangePercent ?? null);
    const [signal, setSignal] = useState<StockSignal>('BEKLE');
    const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<string>('');
    const [dataSource, setDataSource] = useState<string>('Finnhub');
    const [notificationPermission, setNotificationPermission] = useState<'granted' | 'denied' | 'default' | 'checking'>('checking');
    const prevSignal = useRef<StockSignal>('BEKLE');