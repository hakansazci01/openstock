/**
 * Server-side reads for the bot pages. Every function tolerates a missing
 * database so a dashboard render never turns into a 500 page.
 */

import { Bot, Trade } from '@/database/models/Bot';
import { connectToDatabase } from '@/database/mongoose';
import { computePortfolio, type TradeLike } from '@/lib/bot/portfolio';
import { logError } from '@/lib/logger';

export type BotListItem = {
    _id: string;
    name: string;
    description?: string;
    type: string;
    status: string;
    strategy: string;
    symbols: string[];
    exchange: string;
    initialCapital: number;
    currentCapital: number;
    cash?: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    intervalMinutes: number;
    isPaper: boolean;
    lastRunAt?: string | Date;
    nextRunAt?: string | Date;
    lastError?: string;
    lastSignals?: unknown[];
};

const toPlain = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

export async function getUserBots(userId: string): Promise<BotListItem[]> {
    if (!userId) return [];
    try {
        await connectToDatabase();
        const bots = await Bot.find({ userId }).sort({ createdAt: -1 }).lean();
        return toPlain(bots) as BotListItem[];
    } catch (error) {
        logError('Bot listesi okunamadı', error);
        return [];
    }
}

export async function getBotForUser(userId: string, botId: string) {
    try {
        await connectToDatabase();
        const bot = await Bot.findById(botId).lean();
        if (!bot || bot.userId !== userId) return null;
        return toPlain(bot) as BotListItem;
    } catch (error) {
        logError(`Bot okunamadı (${botId})`, error);
        return null;
    }
}

export async function getBotTrades(botId: string, limit = 100) {
    try {
        await connectToDatabase();
        const trades = await Trade.find({ botId }).sort({ executedAt: -1 }).limit(limit).lean();
        return toPlain(trades) as Array<{
            _id: string;
            symbol: string;
            side: 'buy' | 'sell';
            price: number;
            quantity: number;
            total: number;
            pnl?: number;
            pnlPercent?: number;
            executedAt: string;
        }>;
    } catch (error) {
        logError(`İşlemler okunamadı (${botId})`, error);
        return [];
    }
}

/** Portfolio snapshot for a bot, priced with the last known trade prices. */
export async function getBotPortfolio(bot: BotListItem) {
    const trades = await getBotTrades(bot._id, 500);
    const marks: Record<string, number> = {};
    for (const trade of trades) {
        if (!marks[trade.symbol]) marks[trade.symbol] = trade.price;
    }
    return computePortfolio(
        bot.initialCapital,
        [...trades].reverse() as TradeLike[],
        marks,
    );
}
