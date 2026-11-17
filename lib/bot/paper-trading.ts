/**
 * OpenStock paper trading engine.
 *
 * A bot cycle reads live quotes + daily candles, asks the strategy engine for
 * signals, executes them against a virtual cash balance and stores the result
 * as equity (cash + open positions) instead of cash only.
 */

import { Bot, Trade } from '@/database/models/Bot';
import type { ITrade } from '@/database/models/Bot';
import { connectToDatabase } from '@/database/mongoose';
import { generateAllSignals } from '@/lib/bot/strategy';
import { fetchAllCandles, fetchMarketData } from '@/lib/bot/data-fetch';
import { computePortfolio, positionSizePercent, type TradeLike } from '@/lib/bot/portfolio';
import { logError, logInfo } from '@/lib/logger';
import { sendBotSignalEmail } from '@/lib/nodemailer';
import type { Signal } from '@/lib/bot/strategy';

export type BotCycleResult = {
    signals: Signal[];
    trades: ITrade[];
    portfolio?: ReturnType<typeof computePortfolio>;
    error?: string;
    skipped?: boolean;
};

const MIN_TRADE_VALUE = 1;

export async function runBotCycle(botId: string, options: { force?: boolean } = {}): Promise<BotCycleResult> {
    await connectToDatabase();

    const bot = await Bot.findById(botId);
    if (!bot) return { signals: [], trades: [], error: 'Bot bulunamadı' };

    // The scheduler only calls running bots; "Şimdi çalıştır" passes force so a
    // draft or paused bot can be back-tested without starting the schedule.
    if (!options.force && bot.status !== 'running') {
        return { signals: [], trades: [], error: 'Bot çalışmıyor' };
    }

    const symbols: string[] = (bot.symbols ?? []).filter(Boolean);
    if (symbols.length === 0) {
        await Bot.findByIdAndUpdate(botId, { lastError: 'Sembol listesi boş', lastRunAt: new Date() });
        return { signals: [], trades: [], error: 'Botun sembol listesi boş' };
    }

    try {
        const [marketData, candles] = await Promise.all([
            fetchMarketData(symbols, bot.symbolWeights, bot.symbolReasons),
            fetchAllCandles(symbols, 120),
        ]);

        const previousTrades = await Trade.find({ botId }).sort({ executedAt: 1 }).lean();
        const marks: Record<string, number> = {};
        for (const [symbol, data] of Object.entries(marketData)) {
            if (data?.price > 0) marks[symbol] = data.price;
        }

        const before = computePortfolio(bot.initialCapital, previousTrades as TradeLike[], marks);

        const positions: Record<string, 'long' | 'short' | 'none'> = {};
        for (const symbol of symbols) {
            const open = before.positions.find((position) => position.symbol === symbol);
            positions[symbol] = open && open.quantity > 0 ? 'long' : 'none';
        }

        const signals = await generateAllSignals([bot as never], marketData, candles, positions);

            // Send email notification for non-hold signals
            if (signals.length > 0) {
                try {
                    const { getSession } = await import('@/lib/better-auth/auth');
                    const session = await getSession();
                    const userEmail = session?.user?.email;
                    if (userEmail) {
                        for (const signal of signals) {
                            if (signal.action !== 'hold') {
                                await sendBotSignalEmail({
                                    email: userEmail,
                                    symbol: signal.symbol,
                                    signal: signal.action === 'buy' ? 'BUY' : 'SELL',
                                    price: signal.price,
                                    reason: signal.reason,
                                    confidence: signal.confidence,
                                    strategy: bot.strategy,
                                    timestamp: signal.timestamp?.toLocaleString('tr-TR') || new Date().toLocaleString('tr-TR'),
                                });
                            }
                        }
                    }
                } catch (err) {
                    logError('Bot signal email error', err);
                }
            }

        let cash = before.cash;
        const sizePercent = positionSizePercent(bot.strategyConfig);
        const executedTrades = [];

        for (const signal of signals) {
            if (signal.action === 'hold') continue;
            const data = marketData[signal.symbol];
            if (!data || !Number.isFinite(data.price) || data.price <= 0) continue;

            const openPosition = before.positions.find((position) => position.symbol === signal.symbol);
            const isLong = Boolean(openPosition && openPosition.quantity > 0);

            if (signal.action === 'buy' && !isLong) {
                const weight = Number(bot.symbolWeights?.[signal.symbol]);
                const target = Number.isFinite(weight) && weight > 0
                    ? (before.equity * weight) / 100
                    : (before.equity * sizePercent) / 100;
                const allocation = Math.min(target, cash * 0.98);
                if (allocation < MIN_TRADE_VALUE) continue;

                const quantity = allocation / data.price;
                const total = quantity * data.price;

                const trade = await Trade.create({
                    botId: bot._id.toString(),
                    userId: bot.userId,
                    symbol: signal.symbol,
                    side: 'buy',
                    price: data.price,
                    quantity,
                    total,
                    strategy: bot.strategy,
                    signal: signal.action,
                    executedAt: new Date(),
                    status: 'executed',
                });

                cash -= total;
                executedTrades.push((trade as any).toObject());
                logInfo(`Paper Trading: ${bot.name} - ${signal.symbol} ALIŞ ${quantity.toFixed(4)} @ ${data.price}`);
            }

            if (signal.action === 'sell' && isLong && openPosition) {
                const quantity = openPosition.quantity;
                const total = quantity * data.price;
                const pnl = (data.price - openPosition.avgCost) * quantity;
                const pnlPercent = openPosition.avgCost > 0 ? ((data.price - openPosition.avgCost) / openPosition.avgCost) * 100 : 0;

                const trade = await Trade.create({
                    botId: bot._id.toString(),
                    userId: bot.userId,
                    symbol: signal.symbol,
                    side: 'sell',
                    price: data.price,
                    quantity,
                    total,
                    strategy: bot.strategy,
                    signal: signal.action,
                    executedAt: new Date(),
                    status: 'executed',
                    pnl,
                    pnlPercent,
                });

                cash += total;
                executedTrades.push((trade as any).toObject());
                logInfo(`Paper Trading: ${bot.name} - ${signal.symbol} SATIŞ ${quantity.toFixed(4)} @ ${data.price} - P&L: ${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);
            }
        }

        // Re-value everything after the new fills so equity and drawdown use the
        // same snapshot the user sees on the dashboard.
        const allTrades = await Trade.find({ botId }).sort({ executedAt: 1 }).lean();
        const portfolio = computePortfolio(bot.initialCapital, allTrades as TradeLike[], marks);
        const now = new Date();

        await Bot.findByIdAndUpdate(botId, {
            currentCapital: portfolio.equity,
            cash: portfolio.cash,
            totalReturn: portfolio.totalReturn,
            totalReturnPercent: portfolio.totalReturnPercent,
            maxDrawdown: portfolio.maxDrawdown,
            winRate: portfolio.winRate,
            totalTrades: allTrades.length,
            winningTrades: portfolio.wins,
            losingTrades: portfolio.losses,
            lastRunAt: now,
            nextRunAt: new Date(now.getTime() + Math.max(1, bot.intervalMinutes || 15) * 60_000),
            lastError: undefined,
            lastSignals: signals.slice(0, 20).map((signal) => ({
                symbol: signal.symbol,
                action: signal.action,
                confidence: signal.confidence,
                price: signal.price,
                reason: signal.reason,
                at: signal.timestamp ?? now,
            })),
            updatedAt: now,
        });

        return { signals, trades: executedTrades, portfolio };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`Bot döngü hatası (${botId})`, err);
        await Bot.findByIdAndUpdate(botId, {
            lastError: message,
            lastRunAt: new Date(),
            updatedAt: new Date(),
        }).catch(() => undefined);
        return { signals: [], trades: [], error: message };
    }
}

export async function getBotPerformance(botId: string) {
    await connectToDatabase();

    const bot = await Bot.findById(botId).lean();
    if (!bot) return null;

    const trades = await Trade.find({ botId }).sort({ executedAt: -1 }).limit(100).lean();
    const marks: Record<string, number> = {};
    const portfolio = computePortfolio(bot.initialCapital, [...trades].reverse() as TradeLike[], marks);

    return {
        ...bot,
        totalReturnPercent: bot.totalReturnPercent ?? 0,
        winRate: bot.winRate ?? 0,
        maxDrawdown: bot.maxDrawdown ?? 0,
        totalTrades: bot.totalTrades ?? 0,
        winningTrades: bot.winningTrades ?? 0,
        losingTrades: bot.losingTrades ?? 0,
        portfolio,
        trades: trades.map((t) => ({
            ...t,
            pnl: t.pnl ?? 0,
            pnlPercent: t.pnlPercent ?? 0,
        })),
    };
}
