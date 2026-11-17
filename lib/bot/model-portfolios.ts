/**
 * OpenStock Model Portföy Entegrasyonu
 * BIST ve ABD model portföylerini trading bot olarak devreye almak için
 */

import { Bot } from '@/database/models/Bot';
import { connectToDatabase } from '@/database/mongoose';
import { logInfo } from '@/lib/logger';

export type ModelPortfolio = {
    id: string;
    name: string;
    description: string;
    exchange: 'BIST' | 'US' | 'CRYPTO';
    symbols: string[];
    strategy: 'sma_cross' | 'rsi_oversold' | 'macd_cross' | 'price_threshold';
    strategyConfig: Record<string, unknown>;
    initialCapital: number;
};

export const MODEL_PORTFOLIOS: ModelPortfolio[] = [
    {
        id: 'bist-buyuk-lot',
        name: 'BIST Büyük Lot',
        description: 'BIST\'teki likiditeyi en yüksek olan büyük lot hisseleri için SMA çaprazlama stratejisi.',
        exchange: 'BIST',
        symbols: ['AKBNK.IS', 'GARAN.IS', 'ISCTR.IS', 'YKBNK.IS', 'HALKB.IS', 'THYAO.IS', 'ASELS.IS', 'FROTO.IS', 'PGSUS.IS', 'TAVHL.IS', 'BIMAS.IS', 'TUPRS.IS', 'SISE.IS', 'EREGL.IS', 'KCHOL.IS'],
        strategy: 'sma_cross',
        strategyConfig: { fastPeriod: 10, slowPeriod: 20 },
        initialCapital: 50000,
    },
    {
        id: 'bist-bankacilik',
        name: 'BIST Bankacılık',
        description: 'BIST bankacılık endeksi hisseleri için RSI aşırı satım/alım stratejisi.',
        exchange: 'BIST',
        symbols: ['AKBNK.IS', 'GARAN.IS', 'ISCTR.IS', 'YKBNK.IS', 'HALKB.IS'],
        strategy: 'rsi_oversold',
        strategyConfig: { period: 14, oversold: 30, overbought: 70 },
        initialCapital: 30000,
    },
    {
        id: 'bist-enerji',
        name: 'BIST Enerji',
        description: 'BIST enerji sektörü hisseleri için MACD çaprazlama stratejisi.',
        exchange: 'BIST',
        symbols: ['TUPRS.IS', 'EREGL.IS', 'SISE.IS'],
        strategy: 'macd_cross',
        strategyConfig: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        initialCapital: 25000,
    },
    {
        id: 'us-teknoloji',
        name: 'ABD Teknoloji',
        description: 'NASDAQ\'daki büyük teknoloji şirketleri için SMA çaprazlama stratejisi.',
        exchange: 'US',
        symbols: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD'],
        strategy: 'sma_cross',
        strategyConfig: { fastPeriod: 10, slowPeriod: 20 },
        initialCapital: 100000,
    },
    {
        id: 'us-finans',
        name: 'ABD Finans',
        description: 'ABD finansal sektörü büyük bankalar için fiyat eşiği stratejisi.',
        exchange: 'US',
        symbols: ['JPM', 'BAC', 'WFC', 'GS', 'MA', 'V'],
        strategy: 'price_threshold',
        strategyConfig: { buyThreshold: 0, sellThreshold: 0, stopLoss: 0, takeProfit: 0 },
        initialCapital: 75000,
    },
    {
        id: 'crypto-buyukler',
        name: 'Kripto Büyükler',
        description: 'Binance üzerindeki büyük kripto para birimleri için SMA çaprazlama.',
        exchange: 'CRYPTO',
        symbols: ['BINANCE:BTCUSDT', 'BINANCE:ETHUSDT', 'BINANCE:SOLUSDT', 'BINANCE:XRPUSDT'],
        strategy: 'sma_cross',
        strategyConfig: { fastPeriod: 10, slowPeriod: 20 },
        initialCapital: 50000,
    },
];

export async function createBotFromModelPortfolio(
    userId: string,
    modelId: string,
    customName?: string
) {
    await connectToDatabase();

    const model = MODEL_PORTFOLIOS.find((m) => m.id === modelId);
    if (!model) {
        throw new Error('Model portföy bulunamadı');
    }

    const bot = await Bot.create({
        userId,
        name: customName || model.name,
        description: model.description,
        type: 'paper',
        status: 'draft',
        strategy: model.strategy,
        strategyConfig: model.strategyConfig,
        symbols: model.symbols,
        exchange: model.exchange,
        initialCapital: model.initialCapital,
        currentCapital: model.initialCapital,
        totalReturn: 0,
        totalReturnPercent: 0,
        maxDrawdown: 0,
        winRate: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        intervalMinutes: 15,
        isPaper: true,
    });

    logInfo(`Model portföy "${model.name}" bot olarak oluşturuldu: ${bot._id}`);

    return bot;
}