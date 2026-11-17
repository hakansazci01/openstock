// Yahoo Finance helpers for Tadawul (.SR) quotes, which TradingView's free embeds and Finnhub's free plan don't price.
// Pure functions, covered by tests; the network call lives in lib/actions/yahoo.actions.ts.

// "2222.SR" or "TADAWUL:2222" -> "2222.SR". TASI index -> "^TASI.SR". Anything else -> null.
export function normalizeYahooSymbol(symbol: string): string | null {
    const upper = (symbol || '').trim().toUpperCase();
    if (/^\d+\.SR$/.test(upper)) return upper;
    if (upper === 'TADAWUL:TASI' || upper === '^TASI.SR') return '^TASI.SR';
    const ticker = upper.startsWith('TADAWUL:') ? upper.slice('TADAWUL:'.length) : '';
    if (/^\d+$/.test(ticker)) return `${ticker}.SR`;
    // BIST Türk hisseleri: THYAO.IS, GARAN.IS, vb.
    if (/\.IS$/.test(upper)) return upper;
    return null;
}

export const isTadawulSymbol = (symbol: string) => normalizeYahooSymbol(symbol) !== null;

// "TADAWUL:2222" -> "2222.SR", the symbol our stock pages use. The TASI index has no stock page.
export const tadawulAppSymbol = (tvSymbol: string) => {
    const yahoo = normalizeYahooSymbol(tvSymbol);
    return yahoo && !yahoo.startsWith('^') ? yahoo : null;
};

export type YahooDailyQuote = {
    price: number;
    change: number;
    changePercent: number;
    currency: string;
    name: string;
    open?: number;
    high?: number;
    low?: number;
    previousClose?: number;
};

type YahooChartJson = {
    chart?: {
        result?: Array<{
            meta?: {
                currency?: string;
                shortName?: string;
                longName?: string;
                regularMarketPrice?: number;
                fulldayChange?: number;
                regularMarketChangePercent?: number;
                regularMarketOpen?: number;
                regularMarketDayHigh?: number;
                regularMarketDayLow?: number;
                previousClose?: number;
                chartPreviousClose?: number;
            };
            indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
    };
};

// Today's quote from a /v8/finance/chart response: the last two daily closes when the range has them,
// else Yahoo's own day change (the TASI index only ever returns one daily bar, so it needs the former).
export function dailyQuoteFromChart(json: unknown): YahooDailyQuote | null {
    const result = (json as YahooChartJson)?.chart?.result?.[0];
    const meta = result?.meta;
    const closes = (result?.indicators?.quote?.[0]?.close ?? []).filter((n): n is number => Number.isFinite(n));
    if (!result || closes.length === 0) return null;
    const price = meta?.regularMarketPrice ?? closes[closes.length - 1];
    const prev = closes.length > 1 ? closes[closes.length - 2] : null;
    // meta.chartPreviousClose is the close before the requested range, not yesterday: never use it as previous close.
    const previousClose = prev ?? meta?.previousClose ?? null;
    const change = previousClose != null ? price - previousClose : (meta?.fulldayChange ?? 0);
    const changePercent = previousClose != null
        ? (change / previousClose) * 100
        : (meta?.regularMarketChangePercent ?? 0);
    return {
        price,
        change,
        changePercent,
        currency: result.meta?.currency || 'SAR',
        name: result.meta?.shortName || result.meta?.longName || '',
        ...(Number.isFinite(meta?.regularMarketOpen) ? { open: meta!.regularMarketOpen } : {}),
        ...(Number.isFinite(meta?.regularMarketDayHigh) ? { high: meta!.regularMarketDayHigh } : {}),
        ...(Number.isFinite(meta?.regularMarketDayLow) ? { low: meta!.regularMarketDayLow } : {}),
        ...(previousClose != null ? { previousClose } : {}),
    };
}
