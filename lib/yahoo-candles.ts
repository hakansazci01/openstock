// Yahoo Finance daily candles. Used by the bot engine, the signal monitor and
// the stock page fallback because Finnhub's free plan no longer serves candles.

import { logError } from '@/lib/logger';

export type DailyCandle = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

// Crypto bases and fiat codes used to turn our display symbols (BTCUSD, EURUSD)
// into the pairs Yahoo actually charts (BTC-USD, EURUSD=X).
const CRYPTO_BASES = new Set([
    'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'MATIC', 'POL',
    'TRX', 'BCH', 'LTC', 'UNI', 'ATOM', 'BNB', 'SHIB', 'ETC', 'XLM', 'NEAR', 'APT',
    'ARB', 'OP', 'SUI', 'PEPE', 'TON', 'AAVE', 'ALGO', 'FIL',
]);
const FIAT_CODES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'MXN', 'TRY',
    'ZAR', 'SEK', 'NOK', 'CNH', 'SGD', 'HKD', 'DKK', 'PLN',
]);

// "BTCUSD" / "DOGEUSD" -> "BTC-USD" / "DOGE-USD", "EURUSD" -> "EURUSD=X".
function plainPairToYahoo(upper: string): string | null {
    for (const quote of ['USDT', 'USDC', 'FDUSD', 'BUSD', 'USD']) {
        if (!upper.endsWith(quote) || upper.length <= quote.length) continue;
        const base = upper.slice(0, -quote.length);
        if (CRYPTO_BASES.has(base)) return `${base}-USD`;
    }
    if (upper.length === 6) {
        const base = upper.slice(0, 3);
        const quote = upper.slice(3);
        if (FIAT_CODES.has(base) && FIAT_CODES.has(quote)) return `${upper}=X`;
    }
    return null;
}

/**
 * Maps an app symbol onto a Yahoo chart symbol.
 *  - THYAO.IS / 2222.SR pass through
 *  - BINANCE:BTCUSDT / BTCUSD -> BTC-USD
 *  - EURUSD -> EURUSD=X
 *  - US tickers (AAPL, MSFT) pass through
 */
export function toYahooChartSymbol(symbol: string): string | null {
    const upper = (symbol || '').trim().toUpperCase();
    if (!upper) return null;

    if (upper.startsWith('BINANCE:')) {
        const pair = upper.slice('BINANCE:'.length);
        const quote = ['USDT', 'BUSD', 'FDUSD', 'USDC', 'BTC', 'ETH', 'BNB']
            .find((suffix) => pair.endsWith(suffix) && pair.length > suffix.length);
        if (!quote) return null;
        return `${pair.slice(0, -quote.length)}-${quote === 'USDT' || quote === 'BUSD' || quote === 'FDUSD' || quote === 'USDC' ? 'USD' : quote}`;
    }

    const pair = plainPairToYahoo(upper);
    if (pair) return pair;

    if (/^[A-Z0-9.^=-]{1,20}$/.test(upper)) return upper;
    return null;
}

export async function getYahooCandles(symbol: string, count = 120): Promise<DailyCandle[]> {
    const chartSymbol = toYahooChartSymbol(symbol);
    if (!chartSymbol) return [];

    try {
        const range = Math.min(400, Math.max(5, Math.ceil(count * 1.6)));
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(chartSymbol)}?interval=1d&range=${range}d`,
            { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 300 } },
        );
        if (!res.ok) return [];

        const json = await res.json();
        const result = json?.chart?.result?.[0];
        const quote = result?.indicators?.quote?.[0];
        const timestamps: number[] = result?.timestamp ?? [];
        if (!quote || timestamps.length === 0) return [];

        const candles: DailyCandle[] = [];
        for (let i = 0; i < timestamps.length; i += 1) {
            const close = quote.close?.[i];
            if (!Number.isFinite(close)) continue;
            candles.push({
                timestamp: timestamps[i] * 1000,
                open: Number.isFinite(quote.open?.[i]) ? quote.open[i] : close,
                high: Number.isFinite(quote.high?.[i]) ? quote.high[i] : close,
                low: Number.isFinite(quote.low?.[i]) ? quote.low[i] : close,
                close,
                volume: Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : 0,
            });
        }

        return candles.slice(-count);
    } catch (error) {
        logError(`Yahoo mum verisi alınamadı (${symbol})`, error);
        return [];
    }
}
