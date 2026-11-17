/**
 * Monte Carlo Backtest Modülü
 *
 * Trade'leri yeniden örneklemek (resampling with replacement) suretiyle:
 * - Binlerce farklı equity eğrisi simüle eder
 * - Güven aralıkları hesaplar (%5, %25, %50, %75, %95 percentiller)
 * - Karmaşası (ruin) olasılığını hesaplar
 * - Maksimum drawdown dağılımını gösterir
 */

import { BacktestTrade, BacktestResult } from '@/lib/bot/walk-forward-backtest';

export type MonteCarloResult = {
    symbol: string;
    strategy: string;
    simulations: number;
    initialCapital: number;
    finalCapitalPercentiles: {
        p5: number;
        p25: number;
        p50: number;
        p75: number;
        p95: number;
    };
    finalCapitalMean: number;
    finalCapitalStdDev: number;
    totalReturnPercentiles: {
        p5: number;
        p25: number;
        p50: number;
        p75: number;
        p95: number;
    };
    maxDrawdownPercentiles: {
        p5: number;
        p25: number;
        p50: number;
        p75: number;
        p95: number;
    };
    maxDrawdownMean: number;
    maxDrawdownStdDev: number;
    winRatePercentiles: {
        p5: number;
        p25: number;
        p50: number;
        p75: number;
        p95: number;
    };
    winRateMean: number;
    probabilityOfRuin: number;
    probabilityOfLoss: number;
    worstCaseEquityCurve: { date: string; value: number }[];
    bestCaseEquityCurve: { date: string; value: number }[];
    medianCaseEquityCurve: { date: string; value: number }[];
    allSimulations: MonteCarloSimulation[];
};

export type MonteCarloSimulation = {
    simulationIndex: number;
    finalCapital: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    trades: BacktestTrade[];
    equityCurve: { date: string; value: number }[];
};

export type MonteCarloConfig = {
    simulations: number;
    confidenceLevel: number;
    bootstrapSampleSize?: number;
};

export const DEFAULT_MONTE_CARLO_CONFIG: MonteCarloConfig = {
    simulations: 1000,
    confidenceLevel: 0.95,
};

/**
 * Monte Carlo simülasyonu çalıştırır.
 * Gerçek trade'leri yeniden örnekleyerek binlerce alternatif tarih createsi üretir.
 */
export async function runMonteCarloBacktest({
    backtestResult,
    config = DEFAULT_MONTE_CARLO_CONFIG,
}: {
    backtestResult: BacktestResult;
    config?: MonteCarloConfig;
}): Promise<MonteCarloResult> {
    const trades = backtestResult.trades.filter((t) => t.action === 'sell');
    const initialCapital = backtestResult.initialCapital;

    if (trades.length < 5) {
        throw new Error(
            `Monte Carlo için yeterli trade yok: ${trades.length} trade, en az 5 gerekli`
        );
    }

    const simulations: MonteCarloSimulation[] = [];
    const sampleSize = config.bootstrapSampleSize ?? trades.length;

    for (let s = 0; s < config.simulations; s++) {
        const sampledTrades: BacktestTrade[] = [];
        for (let i = 0; i < sampleSize; i++) {
            const randomIndex = Math.floor(Math.random() * trades.length);
            sampledTrades.push({ ...trades[randomIndex] });
        }

        sampledTrades.sort((a, b) => a.date.localeCompare(b.date));

        let capital = initialCapital;
        let position: 'long' | 'none' = 'none';
        let entryPrice = 0;
        let quantity = 0;
        const equityCurve: { date: string; value: number }[] = [];
        let peak = initialCapital;
        let maxDrawdown = 0;
        let winningTrades = 0;
        let losingTrades = 0;

        for (const trade of sampledTrades) {
            if (trade.action === 'buy' && position === 'none') {
                const allocation = capital * 0.2;
                quantity = allocation / trade.price;
                entryPrice = trade.price;
                capital -= allocation;
                position = 'long';
            } else if (trade.action === 'sell' && position === 'long') {
                const total = quantity * trade.price;
                const pnl = total - quantity * entryPrice;
                capital += total;
                position = 'none';

                if (pnl > 0) winningTrades++;
                else losingTrades++;
            }

            let currentEquity = capital;
            if (position === 'long') {
                currentEquity += quantity * trade.price;
            }

            equityCurve.push({
                date: trade.date,
                value: currentEquity,
            });

            if (currentEquity > peak) peak = currentEquity;
            const drawdown = (peak - currentEquity) / peak;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
        }

        if (position === 'long' && sampledTrades.length > 0) {
            const lastTrade = sampledTrades[sampledTrades.length - 1];
            const total = quantity * lastTrade.price;
            const pnl = total - quantity * entryPrice;
            capital += total;

            if (pnl > 0) winningTrades++;
            else losingTrades++;
        }

        const totalReturn = capital - initialCapital;
        const totalReturnPercent = (totalReturn / initialCapital) * 100;
        const winRate = (winningTrades + losingTrades) > 0
            ? (winningTrades / (winningTrades + losingTrades)) * 100
            : 0;

        simulations.push({
            simulationIndex: s,
            finalCapital: capital,
            totalReturnPercent,
            maxDrawdown: maxDrawdown * 100,
            winRate,
            totalTrades: winningTrades + losingTrades,
            trades: sampledTrades,
            equityCurve,
        });
    }

    const percentile = (arr: number[], p: number): number => {
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
    };

    const finalCapitals = simulations.map(s => s.finalCapital);
    const totalReturns = simulations.map(s => s.totalReturnPercent);
    const maxDrawdowns = simulations.map(s => s.maxDrawdown);
    const winRates = simulations.map(s => s.winRate);

    const finalCapitalPercentiles = {
        p5: percentile(finalCapitals, 5),
        p25: percentile(finalCapitals, 25),
        p50: percentile(finalCapitals, 50),
        p75: percentile(finalCapitals, 75),
        p95: percentile(finalCapitals, 95),
    };

    const totalReturnPercentiles = {
        p5: percentile(totalReturns, 5),
        p25: percentile(totalReturns, 25),
        p50: percentile(totalReturns, 50),
        p75: percentile(totalReturns, 75),
        p95: percentile(totalReturns, 95),
    };

    const maxDrawdownPercentiles = {
        p5: percentile(maxDrawdowns, 5),
        p25: percentile(maxDrawdowns, 25),
        p50: percentile(maxDrawdowns, 50),
        p75: percentile(maxDrawdowns, 75),
        p95: percentile(maxDrawdowns, 95),
    };

    const winRatePercentiles = {
        p5: percentile(winRates, 5),
        p25: percentile(winRates, 25),
        p50: percentile(winRates, 50),
        p75: percentile(winRates, 75),
        p95: percentile(winRates, 95),
    };

    const finalCapitalMean = finalCapitals.reduce((a, b) => a + b, 0) / finalCapitals.length;
    const finalCapitalStdDev = Math.sqrt(
        finalCapitals.reduce((sum, val) => sum + Math.pow(val - finalCapitalMean, 2), 0) /
            finalCapitals.length
    );

    const maxDrawdownMean = maxDrawdowns.reduce((a, b) => a + b, 0) / maxDrawdowns.length;
    const maxDrawdownStdDev = Math.sqrt(
        maxDrawdowns.reduce((sum, val) => sum + Math.pow(val - maxDrawdownMean, 2), 0) /
            maxDrawdowns.length
    );

    const winRateMean = winRates.reduce((a, b) => a + b, 0) / winRates.length;

    const ruinCount = simulations.filter(s => s.finalCapital < initialCapital * 0.5).length;
    const lossCount = simulations.filter(s => s.finalCapital < initialCapital).length;

    const probabilityOfRuin = (ruinCount / simulations.length) * 100;
    const probabilityOfLoss = (lossCount / simulations.length) * 100;

    const sortedByReturn = [...simulations].sort((a, b) => a.totalReturnPercent - b.totalReturnPercent);
    const worstCase = sortedByReturn[0];
    const bestCase = sortedByReturn[sortedByReturn.length - 1];
    const medianCase = sortedByReturn[Math.floor(sortedByReturn.length / 2)];

    return {
        symbol: backtestResult.symbol,
        strategy: backtestResult.strategy,
        simulations: config.simulations,
        initialCapital,
        finalCapitalPercentiles,
        finalCapitalMean,
        finalCapitalStdDev,
        totalReturnPercentiles,
        maxDrawdownPercentiles,
        maxDrawdownMean,
        maxDrawdownStdDev,
        winRatePercentiles,
        winRateMean,
        probabilityOfRuin,
        probabilityOfLoss,
        worstCaseEquityCurve: worstCase.equityCurve,
        bestCaseEquityCurve: bestCase.equityCurve,
        medianCaseEquityCurve: medianCase.equityCurve,
        allSimulations: simulations,
    };
}

