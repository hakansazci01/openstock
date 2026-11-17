import mongoose, { Schema, Document, Model, models } from 'mongoose';

export type BotStatus = 'draft' | 'running' | 'paused' | 'stopped' | 'error';
export type BotType = 'signal' | 'paper' | 'live';
export type StrategyType = 'sma_cross' | 'rsi_oversold' | 'macd_cross' | 'price_threshold' | 'custom';

export interface IBot extends Document {
    userId: string;
    name: string;
    description?: string;
    type: BotType;
    status: BotStatus;
    strategy: StrategyType;
    strategyConfig: Record<string, unknown>;
    symbols: string[];
    symbolWeights?: Record<string, number>; // Her hisse için hedef ağırlık (noktaportfoy.com modeli)
    symbolReasons?: Record<string, string>; // Seçimin gerekçesi
    symbolRisks?: Record<string, string>; // Hisse bazlı risk notları
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
    rebalanceThreshold?: number; // Ağırlık sapma eşiği (noktaportfoy.com'da %5)
    lastRunAt?: Date;
    nextRunAt?: Date;
    lastRebalanceAt?: Date; // Son yeniden dengeleme tarihi
    lastError?: string;
    lastSignals?: Array<{
        symbol: string;
        action: 'buy' | 'sell' | 'hold';
        confidence: number;
        price: number;
        reason: string;
        at: Date;
    }>;
    intervalMinutes: number;
    isPaper: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ITrade extends Document {
    botId: string;
    userId: string;
    symbol: string;
    side: 'buy' | 'sell';
    price: number;
    quantity: number;
    total: number;
    strategy: string;
    signal: 'buy' | 'sell' | 'hold';
    executedAt: Date;
    status: 'executed' | 'pending' | 'cancelled';
    pnl?: number;
    pnlPercent?: number;
}

const BotSchema = new Schema<IBot>(
    {
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, trim: true },
        type: { type: String, enum: ['signal', 'paper', 'live'], default: 'paper' },
        status: { type: String, enum: ['draft', 'running', 'paused', 'stopped', 'error'], default: 'draft' },
        strategy: { type: String, enum: ['sma_cross', 'rsi_oversold', 'macd_cross', 'price_threshold', 'custom'], required: true },
        strategyConfig: { type: Schema.Types.Mixed, default: {} },
        symbols: [{ type: String, required: true }],
        symbolWeights: { type: Schema.Types.Mixed, default: {} },
        symbolReasons: { type: Schema.Types.Mixed, default: {} },
        symbolRisks: { type: Schema.Types.Mixed, default: {} },
        exchange: { type: String, required: true, default: 'BIST' },
        initialCapital: { type: Number, required: true, default: 10000 },
        currentCapital: { type: Number, default: 10000 },
        cash: { type: Number, default: 10000 },
        totalReturn: { type: Number, default: 0 },
        totalReturnPercent: { type: Number, default: 0 },
        maxDrawdown: { type: Number, default: 0 },
        winRate: { type: Number, default: 0 },
        totalTrades: { type: Number, default: 0 },
        winningTrades: { type: Number, default: 0 },
        losingTrades: { type: Number, default: 0 },
        rebalanceThreshold: { type: Number, default: 5 }, // %5 sapma eşiği (noktaportfoy.com modeli)
        lastRunAt: { type: Date },
        nextRunAt: { type: Date },
        lastRebalanceAt: { type: Date },
        lastError: { type: String },
        lastSignals: { type: Schema.Types.Mixed, default: [] },
        intervalMinutes: { type: Number, default: 15 },
        isPaper: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

BotSchema.index({ userId: 1, status: 1 });
BotSchema.index({ userId: 1, createdAt: -1 });

export const Bot = (models.Bot as Model<IBot>) || mongoose.model<IBot>('Bot', BotSchema);

const TradeSchema = new Schema<ITrade>(
    {
        botId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true },
        side: { type: String, enum: ['buy', 'sell'], required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        total: { type: Number, required: true },
        strategy: { type: String, required: true },
        signal: { type: String, enum: ['buy', 'sell', 'hold'], required: true },
        executedAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['executed', 'pending', 'cancelled'], default: 'executed' },
        pnl: { type: Number },
        pnlPercent: { type: Number },
    },
    { timestamps: true }
);

TradeSchema.index({ botId: 1, executedAt: -1 });
TradeSchema.index({ userId: 1, symbol: 1 });

export const Trade = (models.Trade as Model<ITrade>) || mongoose.model<ITrade>('Trade', TradeSchema);