import { describe, expect, it } from 'vitest';
import { computePortfolio, positionSizePercent, type TradeLike } from '@/lib/bot/portfolio';
import { normalizeBotInput, normalizeSymbols, BotInputError } from '@/lib/bot/input';

const trade = (side: 'buy' | 'sell', price: number, quantity: number, extra: Partial<TradeLike> = {}): TradeLike => ({
    side,
    symbol: 'AAPL',
    price,
    quantity,
    total: price * quantity,
    ...extra,
});

describe('computePortfolio', () => {
    it('keeps equity unchanged when a buy fills at the mark price', () => {
        const portfolio = computePortfolio(10_000, [trade('buy', 100, 20)], { AAPL: 100 });
        expect(portfolio.cash).toBe(8_000);
        expect(portfolio.invested).toBe(2_000);
        expect(portfolio.equity).toBe(10_000);
        expect(portfolio.totalReturn).toBe(0);
        expect(portfolio.positions).toHaveLength(1);
    });

    it('values open positions at the latest mark', () => {
        const portfolio = computePortfolio(10_000, [trade('buy', 100, 20)], { AAPL: 125 });
        expect(portfolio.equity).toBe(10_500);
        expect(portfolio.positions[0].unrealizedPnl).toBe(500);
        expect(portfolio.totalReturnPercent).toBeCloseTo(5, 5);
    });

    it('realises PnL on a sell and closes the position', () => {
        const portfolio = computePortfolio(10_000, [
            trade('buy', 100, 20),
            trade('sell', 110, 20, { pnl: 200 }),
        ]);
        expect(portfolio.positions).toHaveLength(0);
        expect(portfolio.cash).toBe(10_200);
        expect(portfolio.realizedPnl).toBe(200);
        expect(portfolio.wins).toBe(1);
        expect(portfolio.winRate).toBe(100);
        expect(portfolio.equity).toBe(10_200);
    });

    it('averages cost across several buys', () => {
        const portfolio = computePortfolio(10_000, [
            trade('buy', 100, 10),
            trade('buy', 200, 10),
        ]);
        expect(portfolio.positions[0].avgCost).toBe(150);
        expect(portfolio.positions[0].quantity).toBe(20);
    });

    it('never funds a buy with money the bot does not have', () => {
        const portfolio = computePortfolio(1_000, [trade('buy', 100, 100)]);
        expect(portfolio.positions).toHaveLength(0);
        expect(portfolio.cash).toBe(1_000);
    });

    it('tracks the maximum drawdown', () => {
        const portfolio = computePortfolio(
            10_000,
            [trade('buy', 100, 50)],
            { AAPL: 80 },
        );
        expect(portfolio.equity).toBe(9_000);
        expect(portfolio.maxDrawdown).toBeCloseTo(10, 5);
    });

    it('ignores malformed trades instead of throwing', () => {
        const portfolio = computePortfolio(10_000, [
            { side: 'buy', symbol: 'AAPL', price: 0, quantity: 10 },
            { side: 'sell', symbol: 'MSFT', price: 100, quantity: -5 },
        ]);
        expect(portfolio.cash).toBe(10_000);
        expect(portfolio.equity).toBe(10_000);
    });
});

describe('positionSizePercent', () => {
    it('defaults to 20% and clamps to 1..100', () => {
        expect(positionSizePercent(undefined)).toBe(20);
        expect(positionSizePercent({ positionSizePercent: 0 })).toBe(1);
        expect(positionSizePercent({ positionSizePercent: 500 })).toBe(100);
        expect(positionSizePercent({ positionSizePercent: 12.5 })).toBe(12.5);
    });
});

describe('normalizeSymbols', () => {
    it('accepts comma and space separated lists, uppercases and dedupes', () => {
        expect(normalizeSymbols('aapl, msft aapl')).toEqual(['AAPL', 'MSFT']);
        expect(normalizeSymbols(['THYAO.IS', 'thyao.is'])).toEqual(['THYAO.IS']);
    });

    it('rejects empty and invalid symbols', () => {
        expect(() => normalizeSymbols('')).toThrow(BotInputError);
        expect(() => normalizeSymbols('<script>')).toThrow(BotInputError);
    });
});

describe('normalizeBotInput', () => {
    it('preserves live bot type for real trading', () => {
        const input = normalizeBotInput({
            name: 'Momentum',
            type: 'live',
            strategy: 'sma_cross',
            symbols: 'AAPL,MSFT',
            initialCapital: 5_000,
            strategyConfig: { fastPeriod: 5, slowPeriod: 40 },
        });
        expect(input.type).toBe('live');
        expect(input.symbols).toEqual(['AAPL', 'MSFT']);
        expect(input.strategyConfig).toEqual({
            fastPeriod: 5,
            slowPeriod: 40,
            positionSizePercent: 20,
            maxPositionPercent: 20,
            stopLossPercent: 0,
            takeProfitPercent: 0,
        });
    });

    it('clamps strategy parameters to sensible ranges', () => {
        const input = normalizeBotInput({
            name: 'RSI bot',
            strategy: 'rsi_oversold',
            symbols: 'AAPL',
            strategyConfig: { period: 500, oversold: 90, overbought: 10 },
        });
        expect(input.strategyConfig.period).toBe(100);
        expect(input.strategyConfig.oversold).toBe(49);
        expect(input.strategyConfig.overbought).toBe(51);
    });

    it('rejects short names and tiny capital', () => {
        expect(() => normalizeBotInput({ name: 'x', symbols: 'AAPL' })).toThrow(BotInputError);
        expect(() => normalizeBotInput({ name: 'Nice bot', symbols: 'AAPL', initialCapital: 10 })).toThrow(BotInputError);
    });
});
