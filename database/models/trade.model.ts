import { Schema, model, models, type Document, type Model } from 'mongoose';

export type TradeSide = 'buy' | 'sell';
export type TradeStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired';
export type TradeSource = 'manual' | 'bot' | 'alert';

export interface ITrade extends Document {
    userId: string;
    broker: 'alpaca' | 'binance';
    brokerOrderId: string;        // Broker'ın verdiği order ID
    clientOrderId?: string;       // İdempotency için istemci tarafı benzersiz kimlik
    symbol: string;
    side: TradeSide;
    type: 'market' | 'limit' | 'stop' | 'stop_limit';
    quantity: number;
    limitPrice?: number;
    stopPrice?: number;
    filledQuantity: number;
    averagePrice?: number;
    notional: number;             // quantity * price (USD)
    fee?: number;
    status: TradeStatus;
    source: TradeSource;
    botId?: string;               // Eğer bot tarafından yapıldıysa
    signalId?: string;            // Sinyal kaynağı
    errorMessage?: string;
    executedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const TradeSchema = new Schema<ITrade>(
    {
        userId: { type: String, required: true, index: true },
        broker: { type: String, required: true, enum: ['alpaca', 'binance'] },
        brokerOrderId: { type: String, required: true, index: true },
        clientOrderId: { type: String, index: true },
        symbol: { type: String, required: true, index: true },
        side: { type: String, required: true, enum: ['buy', 'sell'] },
        type: { type: String, required: true, enum: ['market', 'limit', 'stop', 'stop_limit'] },
        quantity: { type: Number, required: true, min: 0 },
        limitPrice: { type: Number, min: 0 },
        stopPrice: { type: Number, min: 0 },
        filledQuantity: { type: Number, default: 0, min: 0 },
        averagePrice: { type: Number, min: 0 },
        notional: { type: Number, required: true, min: 0 },
        fee: { type: Number, min: 0 },
        status: { type: String, required: true, enum: ['pending', 'filled', 'partially_filled', 'cancelled', 'rejected', 'expired'], index: true },
        source: { type: String, required: true, enum: ['manual', 'bot', 'alert'], default: 'manual' },
        botId: { type: String, ref: 'Bot', index: true },
        signalId: { type: String },
        errorMessage: { type: String },
        executedAt: { type: Date },
    },
    { timestamps: true }
);

// Sorguları hızlandırmak için birleşik indexler
TradeSchema.index({ userId: 1, status: 1, createdAt: -1 });
TradeSchema.index({ userId: 1, symbol: 1, createdAt: -1 });
TradeSchema.index({ brokerOrderId: 1 }, { unique: true });
TradeSchema.index({ clientOrderId: 1 }, { unique: true, partialFilterExpression: { clientOrderId: { $exists: true } } });

export const Trade: Model<ITrade> =
    (models?.Trade as Model<ITrade>) || model<ITrade>('Trade', TradeSchema);