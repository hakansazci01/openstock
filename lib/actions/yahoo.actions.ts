'use server';

import { dailyQuoteFromChart, normalizeYahooSymbol, type YahooDailyQuote } from '@/lib/yahoo';
import { toYahooChartSymbol } from '@/lib/yahoo-candles';
import { logError } from '@/lib/logger';

// One chart call per symbol (no batch endpoint without login) behind a shared 5-minute cache,
// so a dashboard costs ~N requests every 5 minutes, not per user.
async function fetchYahooQuotes(
    symbols: string[],
    mapSymbol: (symbol: string) => string | null,
): Promise<Record<string, YahooDailyQuote>> {
    const entries = await Promise.all(
        symbols.map(async (symbol) => {
            const yahooSymbol = mapSymbol(symbol);
            if (!yahooSymbol) return [symbol, null] as const;
            try {
                const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    next: { revalidate: 300 },
                });
                if (!res.ok) return [symbol, null] as const;
                return [symbol, dailyQuoteFromChart(await res.json())] as const;
            } catch (e) {
                logError('Yahoo daily quote error', { symbol, error: e });
                return [symbol, null] as const;
            }
        }),
    );
    return Object.fromEntries(entries.filter(([, q]) => q)) as Record<string, YahooDailyQuote>;
}

// Daily Tadawul quotes from Yahoo Finance (free, no key, covers .SR), keyed by the symbol passed in.
export async function getYahooDailyQuotes(symbols: string[]): Promise<Record<string, YahooDailyQuote>> {
    return fetchYahooQuotes(symbols, normalizeYahooSymbol);
}

// General free fallback for every market Yahoo covers (US tickers, BIST, crypto pairs, FX).
// Used when Finnhub is not configured or cannot price a symbol, so the UI never shows blank prices.
export async function getYahooQuotes(symbols: string[]): Promise<Record<string, YahooDailyQuote>> {
    return fetchYahooQuotes(symbols, toYahooChartSymbol);
}
