import { describe, expect, it } from 'vitest';
import { dailyQuoteFromChart, normalizeYahooSymbol, tadawulAppSymbol } from '@/lib/yahoo';
import { toYahooChartSymbol } from '@/lib/yahoo-candles';
import { formatSymbolForTradingView, isChartEmbeddable } from '@/lib/utils';

describe('Tadawul symbols', () => {
    it('maps app and TradingView symbols to Yahoo', () => {
        expect(normalizeYahooSymbol('2222.SR')).toBe('2222.SR');
        expect(normalizeYahooSymbol('tadawul:2222')).toBe('2222.SR');
        expect(normalizeYahooSymbol('TADAWUL:TASI')).toBe('^TASI.SR');
        // Bare numbers stay ambiguous: 7203 is Toyota in Tokyo
        expect(normalizeYahooSymbol('7203')).toBeNull();
        expect(normalizeYahooSymbol('AAPL')).toBeNull();
        expect(tadawulAppSymbol('TADAWUL:1120')).toBe('1120.SR');
        expect(tadawulAppSymbol('TADAWUL:TASI')).toBeNull();
    });

    it('charts .SR on TradingView as TADAWUL, without the embed it blocks', () => {
        expect(formatSymbolForTradingView('2222.SR')).toBe('TADAWUL:2222');
        expect(isChartEmbeddable('TADAWUL:2222')).toBe(false);
    });
});

describe('dailyQuoteFromChart', () => {
    const chart = (close: (number | null)[]) => ({ chart: { result: [{ meta: { currency: 'SAR', shortName: 'Saudi Arabian Oil Co.' }, indicators: { quote: [{ close }] } }] } });

    it('maps crypto and FX display symbols to Yahoo pairs', () => {
        expect(toYahooChartSymbol('BTCUSD')).toBe('BTC-USD');
        expect(toYahooChartSymbol('DOGEUSD')).toBe('DOGE-USD');
        expect(toYahooChartSymbol('EURUSD')).toBe('EURUSD=X');
        expect(toYahooChartSymbol('BINANCE:BTCUSDT')).toBe('BTC-USD');
        expect(toYahooChartSymbol('AAPL')).toBe('AAPL');
        expect(toYahooChartSymbol('THYAO.IS')).toBe('THYAO.IS');
    });

    it('uses the last two closes, never chartPreviousClose, as the day change', () => {
        const json = {
            chart: {
                result: [{
                    meta: { currency: 'USD', regularMarketPrice: 356.27, chartPreviousClose: 342.37 },
                    indicators: { quote: [{ close: [348.51, 355.63, 354.88, 356.27] }] },
                }],
            },
        };
        const q = dailyQuoteFromChart(json)!;
        expect(q.price).toBe(356.27);
        expect(q.change).toBeCloseTo(1.39);
        expect(q.previousClose).toBe(354.88);
    });

    it('compares the last two closes, skipping gaps', () => {
        const q = dailyQuoteFromChart(chart([25, 26, null, 26.52]))!;
        expect(q.price).toBe(26.52);
        expect(q.change).toBeCloseTo(0.52);
        expect(q.changePercent).toBeCloseTo(2);
        expect(q).toMatchObject({ currency: 'SAR', name: 'Saudi Arabian Oil Co.' });
    });

    it("prefers Yahoo's own day change (TASI sends a single daily bar)", () => {
        const json = { chart: { result: [{ meta: { regularMarketPrice: 9921.5, fulldayChange: -101.97, regularMarketChangePercent: -1.017 }, indicators: { quote: [{ close: [9921.5] }] } }] } };
        expect(dailyQuoteFromChart(json)).toMatchObject({ price: 9921.5, change: -101.97, changePercent: -1.017 });
    });

    it('returns null when Yahoo has nothing', () => {
        expect(dailyQuoteFromChart({ chart: { result: null } })).toBeNull();
        expect(dailyQuoteFromChart(chart([null]))).toBeNull();
    });
});
