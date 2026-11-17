/**
 * Walk-Forward Analysis Modülü
 *
 * Overfitting riskini azaltmak için:
 * - Veriyi in-sample (eğitim) ve out-of-sample (test) periyotlarına böler
 * - Zamanla ilerleyen pencerelerle (rolling window) test eder
 * - Her pencerede parametreleri in-sample'da optimize eder, out-of-sample'da test eder
 * - Tüm pencerelerin sonuçlarını birleştirir
 */

import { fetchCandles } from '@/lib/bot/data-fetch';
import { generateSignal } from '@/lib/bot/strategy';
import type { MarketData } from '@/lib/bot/strategy';
import type { IBot } from '@/database/models/Bot';

export type WalkForwardWindow = {
    windowIndex: number;
    inSampleStart: Date;
    inSampleEnd: Date;
    outSampleStart: Date;
    outSampleEnd: Date;
    optimizedConfig: Record<string, number>;
    inSampleResult: BacktestResult;
    outSampleResult: BacktestResult;
};

export type WalkForwardResult = {
    symbol: string;
    totalWindows: number;
    windows: WalkForwardWindow[];
    averageOutSampleReturn: number;
    averageOutSampleReturnPercent: number;
    averageOutSampleDrawdown: number;
    averageOutSampleWinRate: number;
    outSampleConsistency: number;
    equityCurve: { date: string; value: number }[];
    allOutSampleTrades: BacktestTrade[];
    overfittingScore: number;
};

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

/**
 * Walk-Forward Analysis çalıştırır.
 * Veriyi N pencereye böler, her pencede optimize+test yapar.
 */
export async function runWalkForwardAnalysis({
    symbol,
    strategy,
    baseConfig,
    initialCapital = 10000,
    totalCandles = 500,
    trainSize = 200,
    testSize = 50,
    stepSize = 50,
    paramGrid,
}: {
    symbol: string;
    strategy: string;
    baseConfig: Record<string, number>;
    initialCapital?: number;
    totalCandles?: number;
    trainSize?: number;
    testSize?: number;
    stepSize?: number;
    paramGrid?: Record<string, number[]>;
}): Promise<WalkForwardResult> {
    const candles = await fetchCandles(symbol, totalCandles);

    if (candles.length < trainSize + testSize) {
        throw new Error(
            `Yeterli veri yok: ${candles.length} mum, en az ${trainSize + testSize} gerekli`
        );
    }

    const windows: WalkForwardWindow[] = [];
    const allOutSampleTrades: BacktestTrade[] = [];
    const equityCurve: { date: string; value: number }[] = [];
    let runningCapital = initialCapital;

    const maxWindows = Math.floor((candles.length - trainSize) / stepSize);

    for (let w = 0; w < maxWindows; w++) {
        const trainStart = w * stepSize;
        const trainEnd = trainStart + trainSize;
        const testEnd = Math.min(trainEnd + testSize, candles.length);

        if (testEnd <= trainEnd) break;

        const inSampleCandles = candles.slice(trainStart, trainEnd);
        const outSampleCandles = candles.slice(trainEnd, testEnd);

        let bestConfig = { ...baseConfig };
        let bestInSampleReturn = -Infinity;

        if (paramGrid) {
            const paramKeys = Object.keys(paramGrid);
            const combinations = generateParamCombinations(paramGrid);

            for (const combo of combinations) {
                const testConfig = { ...baseConfig, ...combo };
                const tempBot = createTempBot(strategy, testConfig, symbol);
                const result = runBacktestOnCandles(
                    symbol,
                    tempBot,
                    inSampleCandles,
                    runningCapital
                );

                if (result.totalReturnPercent > bestInSampleReturn) {
                    bestInSampleReturn = result.totalReturnPercent;
                    bestConfig = testConfig;
                }
            }
        }

        const testBot = createTempBot(strategy, bestConfig, symbol);
        const outSampleResult = runBacktestOnCandles(
            symbol,
            testBot,
            outSampleCandles,
            runningCapital
        );

        const inSampleBot = createTempBot(strategy, bestConfig, symbol);
        const inSampleResult = runBacktestOnCandles(
            symbol,
            inSampleBot,
            inSampleCandles,
            runningCapital
        );

        runningCapital = outSampleResult.finalCapital;

        for (const trade of outSampleResult.trades) {
            allOutSampleTrades.push(trade);
        }

        for (const point of outSampleResult.equityCurve) {
            equityCurve.push({
                date: point.date,
                value: point.value,
            });
        }

        windows.push({
            windowIndex: w,
            inSampleStart: new Date(inSampleCandles[0].timestamp * 1000),
            inSampleEnd: new Date(inSampleCandles[inSampleCandles.length - 1].timestamp * 1000),
            outSampleStart: new Date(outSampleCandles[0].timestamp * 1000),
            outSampleEnd: new Date(outSampleCandles[outSampleCandles.length - 1].timestamp * 1000),
            optimizedConfig: bestConfig,
            inSampleResult,
            outSampleResult,
        });
    }

    const outSampleReturns = windows.map(w => w.outSampleResult.totalReturnPercent);
    const outSampleDrawdowns = windows.map(w => w.outSampleResult.maxDrawdown);
    const outSampleWinRates = windows.map(w => w.outSampleResult.winRate);

    const avgReturn =
        outSampleReturns.length > 0
            ? outSampleReturns.reduce((a, b) => a + b, 0) / outSampleReturns.length
            : 0;

    const avgDrawdown =
        outSampleDrawdowns.length > 0
            ? outSampleDrawdowns.reduce((a, b) => a + b, 0) / outSampleDrawdowns.length
            : 0;

    const avgWinRate =
        outSampleWinRates.length > 0
            ? outSampleWinRates.reduce((a, b) => a + b, 0) / outSampleWinRates.length
            : 0;

    const profitableWindows = outSampleReturns.filter(r => r > 0).length;
    const consistency = windows.length > 0 ? profitableWindows / windows.length : 0;

    const avgInSampleReturn =
        windows.length > 0
            ? windows.map(w => w.inSampleResult.totalReturnPercent).reduce((a, b) => a + b, 0) /
              windows.length
            : 0;

    const overfittingScore = Math.max(0, Math.min(1, (avgInSampleReturn - avgReturn) / 100));

    return {
        symbol,
        totalWindows: windows.length,
        windows,
        averageOutSampleReturn: runningCapital - initialCapital,
        averageOutSampleReturnPercent: avgReturn,
        averageOutSampleDrawdown: avgDrawdown,
        averageOutSampleWinRate: avgWinRate,
        outSampleConsistency: consistency * 100,
        equityCurve,
        allOutSampleTrades,
        overfittingScore,
    };
}

/**
 * ParametreGrid'den tüm kombinasyonları üretir.
 */
function generateParamCombinations(
    paramGrid: Record<string, number[]>
): Record<string, number>[] {
    const keys = Object.keys(paramGrid);
    const result: Record<string, number>[] = [{}];

    for (const key of keys) {
        const values = paramGrid[key];
        const newResult: Record<string, number>[] = [];

        for (const combo of result) {
            for (const value of values) {
                newResult.push({ ...combo, [key]: value });
            }
        }

        result.splice(0, result.length, ...newResult);
    }

    return result;
}

/**
 * Geçici bot nesnesi oluşturur.
 */
function createTempBot(
    strategy: string,
    config: Record<string, number>,
    symbol: string
): IBot {
    return {
        _id: 'temp',
        userId: 'temp',
        name: 'Walk-Forward Temp',
        strategy,
        strategyConfig: config,
        symbols: [symbol],
        status: 'running',
        isPaper: true,
        initialCapital: 10000,
        currentCapital: 10000,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as unknown as IBot;
}

/**
 * Belirli mum verileri üzerinde backtest çalıştırır.
 */
function runBacktestOnCandles(
    symbol: string,
    bot: IBot,
    candles: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[],
    initialCapital: number
): BacktestResult {
    let capital = initialCapital;
    let position: 'long' | 'none' = 'none';
    let entryPrice = 0;
    let quantity = 0;
    const trades: BacktestTrade[] = [];
    const equityCurve: { date: string; value: number }[] = [];
    let peak = initialCapital;
    let maxDrawdown = 0;

    for (let i = 20; i < candles.length; i++) {
        const slice = candles.slice(0, i + 1);
        const current = candles[i];
        const currentPrice = current.close;

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

        const signal = generateSignal(bot, marketData, slice, position);

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
            const pnl = total - quantity * entryPrice;
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

    if (position === 'long' && candles.length > 0) {
        const lastPrice = candles[candles.length - 1].close;
        const total = quantity * lastPrice;
        const pnl = total - quantity * entryPrice;
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

    return {
        symbol,
        strategy: bot.strategy,
        initialCapital,
        finalCapital: capital,
        totalReturn,
        totalReturnPercent: (totalReturn / initialCapital) * 100,
        maxDrawdown: maxDrawdown * 100,
        winRate: sellTrades.length > 0 ? (winningTrades.length / sellTrades.length) * 100 : 0,
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: sellTrades.length - winningTrades.length,
        trades,
        equityCurve,
    };
}

