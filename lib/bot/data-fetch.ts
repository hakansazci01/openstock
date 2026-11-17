/**
 * OpenStock Trading Bot Veri Çekme Modülü
 */

import { getLiveQuotes } from '@/lib/actions/finnhub.actions';
import { getYahooDailyQuotes } from '@/lib/actions/yahoo.actions';
import { getYahooCandles } from '@/lib/yahoo-candles';
import { logError } from '@/lib/logger';
import type { MarketData, CandleData } from "@/lib/bot/strategy";

const FINNHUB_SYMBOL_CACHE = new Map<string, { data: MarketData; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000;

export async function fetchMarketData(
    symbols: string[],
    symbolWeights?: Record<string, number>,
    symbolReasons?: Record<string, string>
): Promise<Record<string, MarketData>> {
    const result: Record<string, MarketData> = {};
    const uncachedSymbols: string[] = [];
    const now = Date.now();

    for (const symbol of symbols) {
        const cached = FINNHUB_SYMBOL_CACHE.get(symbol);
        if (cached && now - cached.timestamp < CACHE_TTL_MS) {
            result[symbol] = {
                ...cached.data,
                targetWeight: symbolWeights?.[symbol],
                selectionReason: symbolReasons?.[symbol],
            };
        } else {
            uncachedSymbols.push(symbol);
        }
    }

    if (uncachedSymbols.length === 0) return result;

    const finnhubSymbols = uncachedSymbols.filter((s) => !s.includes('.IS') && !s.includes('.SR'));
    const yahooSymbols = uncachedSymbols.filter((s) => s.includes('.IS') || s.includes('.SR'));

    if (finnhubSymbols.length > 0) {
        try {
            const quotes = await getLiveQuotes(finnhubSymbols);
            for (const symbol of finnhubSymbols) {
                const q = quotes[symbol];
                if (q) {
                    const data: MarketData = {
                        symbol, price: q.c ?? 0, change: q.d ?? 0,
                        changePercent: q.dp ?? 0, high: q.h ?? 0, low: q.l ?? 0,
                        open: q.o ?? 0, prevClose: q.pc ?? 0, volume: 0,
                        timestamp: new Date(), source: 'finnhub',
                        targetWeight: symbolWeights?.[symbol],
                        selectionReason: symbolReasons?.[symbol],
                    };
                    result[symbol] = data;
                    FINNHUB_SYMBOL_CACHE.set(symbol, { data, timestamp: now });
                }
            }
        } catch (err) {
            logError('Finnhub veri çekme hatası', err);
        }
    }

    if (yahooSymbols.length > 0) {
        try {
            const quotes = await getYahooDailyQuotes(yahooSymbols);
            for (const symbol of yahooSymbols) {
                const q = quotes[symbol];
                if (q) {
                    const data: MarketData = {
                        symbol, price: q.price, change: q.change,
                        changePercent: q.changePercent, high: q.price, low: q.price,
                        open: q.price, prevClose: q.price - q.change, volume: 0,
                        timestamp: new Date(), source: 'yahoo',
                        targetWeight: symbolWeights?.[symbol],
                        selectionReason: symbolReasons?.[symbol],
                    };
                    result[symbol] = data;
                    FINNHUB_SYMBOL_CACHE.set(symbol, { data, timestamp: now });
                }
            }
        } catch (err) {
            logError('Yahoo veri çekme hatası', err);
        }
    }

    return result;
}

export async function fetchCandles(symbol: string, count = 100): Promise<CandleData[]> {
    return getYahooCandles(symbol, count);
}

export async function fetchAllCandles(symbols: string[], count = 100): Promise<Record<string, CandleData[]>> {
    const result: Record<string, CandleData[]> = {};
    for (const symbol of symbols) {
        result[symbol] = await fetchCandles(symbol, count);
    }
    return result;
}

export function clearCache() {
    FINNHUB_SYMBOL_CACHE.clear();
}

