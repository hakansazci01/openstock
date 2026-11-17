/**
 * OpenStock Backtesting Modülü
 * Geçmiş verilerle strateji performans testi
 */

import { fetchCandles } from '@/lib/bot/data-fetch';
import { generateSignal } from '@/lib/bot/strategy';
import type { MarketData } from '@/lib/bot/strategy';
import type { IBot } from '@/database/models/Bot';

export type BacktestTrade = {
    date: string;
    action: 'buy' | 'sell';
    price: number;
    quantity: number;
    total: number;
    pnl?: number;
    pnlPercent?: number;
};

export type BacktestResult = {
    symbol: string;
    strategy: string;
    initialCapital: number;
    finalCapital: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    trades: BacktestTrade[];
    equityCurve: { date: string; value: number }[];
};

export async function runBacktest(
    symbol: string,
    strategy: string,
    strategyConfig: Record<string, unknown>,
    initialCapital: number = 10000,
    count: number = 200
): Promise<BacktestResult> {
    const candles = await fetchCandles(symbol, count);

    if (candles.length < 50) {
        throw new Error(`Yeterli geçmiş veri yok (${candles.length} mum, en az 50 gerekli)`);
    }

    let capital = initialCapital;
    let position: 'long' | 'none' = 'none';
    let entryPrice = 0;
    let quantity = 0;
    const trades: BacktestTrade[] = [];
    const equityCurve: { date: string; value: number }[] = [];
    let peak = initialCapital;
    let maxDrawdown = 0;

    // Her mum için sinyal üret ve işlem yap
    for (let i = 20; i < candles.length; i++) {
        const slice = candles.slice(0, i + 1);
        const current = candles[i];
        const currentPrice = current.close;

        // Market data oluştur
        const marketData: MarketData = {
            symbol,
            price: currentPrice,
            change: currentPrice - slice[i - 1].close,
            changePercent: ((currentPrice - slice[i - 1].close) / slice[i - 1].close) * 100,
            high: current.high,
            low: current.low,
            open: current.open,
            prevClose: slice[i - 1].close,
            volume: current.volume,
            timestamp: new Date(current.timestamp * 1000),
            source: 'yahoo',
        };

        // Sinyal üret (geçmiş verilerle)
        const tempBot = {
            strategy,
            strategyConfig,
            symbols: [symbol],
        } as unknown as IBot;

        const signal = generateSignal(tempBot, marketData, slice, position);

        // İşlem yürüt
        if (signal.action === 'buy' && position === 'none') {
            const allocation = capital * 0.2;
            quantity = allocation / currentPrice;
            entryPrice = currentPrice;
            capital -= allocation;
            position = 'long';

            trades.push({
                date: new Date(current.timestamp * 1000).toISOString(),
                action: 'buy',
                price: currentPrice,
                quantity,
                total: allocation,
            });
        } else if (signal.action === 'sell' && position === 'long') {
            const total = quantity * currentPrice;
            const pnl = total - (quantity * entryPrice);
            capital += total;
            position = 'none';

            trades.push({
                date: new Date(current.timestamp * 1000).toISOString(),
                action: 'sell',
                price: currentPrice,
                quantity,
                total,
                pnl,
                pnlPercent: (pnl / (quantity * entryPrice)) * 100,
            });
        }

        // Equity curve
        let currentEquity = capital;
        if (position === 'long') {
            currentEquity += quantity * currentPrice;
        }

        equityCurve.push({
            date: new Date(current.timestamp * 1000).toISOString(),
            value: currentEquity,
        });

        if (currentEquity > peak) peak = currentEquity;
        const drawdown = (peak - currentEquity) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Pozisyon açık ise kapanış fiyatıyla kapat
    if (position === 'long' && candles.length > 0) {
        const lastPrice = candles[candles.length - 1].close;
        const total = quantity * lastPrice;
        const pnl = total - (quantity * entryPrice);
        capital += total;

        trades.push({
            date: new Date(candles[candles.length - 1].timestamp * 1000).toISOString(),
            action: 'sell',
            price: lastPrice,
            quantity,
            total,
            pnl,
            pnlPercent: (pnl / (quantity * entryPrice)) * 100,
        });
    }

    const sellTrades = trades.filter((t) => t.action === 'sell');
    const winningTrades = sellTrades.filter((t) => (t.pnl ?? 0) > 0);
    const totalReturn = capital - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;

    return {
        symbol,
        strategy,
        initialCapital,
        finalCapital: capital,
        totalReturn,
        totalReturnPercent,
        maxDrawdown: maxDrawdown * 100,
        winRate: sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0,
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: sellTrades.length - winningTrades.length,
        trades,
        equityCurve,
    };
}

export async function compareStrategies(
    symbol: string,
    strategies: Array<{ strategy: string; config: Record<string, unknown> }>,
    initialCapital: number = 10000
) {
    const results = [];
    for (const s of strategies) {
        try {
            const result = await runBacktest(symbol, s.strategy, s.config, initialCapital);
            results.push(result);
        } catch (err) {
            console.error(`Backtest hatası (${s.strategy}):`, err);
        }
    }
    return results.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);
}