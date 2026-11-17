import { Schema, model, models, type Document, type Model } from 'mongoose';

export type TradingSessionStatus = 'active' | 'paused' | 'killed';

export interface ITradingSession extends Document {
    userId: string;
    status: TradingSessionStatus;
    dailyTradedNotional: number;     // Bugün işlem gören toplam notional (USD)
    dailyRealizedPnl: number;        // Bugün gerçekleşen kar/zarar (USD)
    dailyLossLimitReached: boolean;  // Günlük kayıp limiti aşıldığında true
    killSwitchReason?: string;       // Kill switch aktifse nedeni
    lastOrderAt?: Date;
    resetAt: Date;                   // Günlük sayaçların sıfırlanacağı tarih (gece 00:00 UTC)
    createdAt: Date;
    updatedAt: Date;
}

const TradingSessionSchema = new Schema<ITradingSession>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        status: { type: String, required: true, enum: ['active', 'paused', 'killed'], default: 'active', index: true },
        dailyTradedNotional: { type: Number, default: 0, min: 0 },
        dailyRealizedPnl: { type: Number, default: 0 },
        dailyLossLimitReached: { type: Boolean, default: false },
        killSwitchReason: { type: String },
        lastOrderAt: { type: Date },
        resetAt: { type: Date, required: true },
    },
    { timestamps: true }
);

TradingSessionSchema.index({ status: 1, resetAt: 1 });

export const TradingSession: Model<ITradingSession> =
    (models?.TradingSession as Model<ITradingSession>) || model<ITradingSession>('TradingSession', TradingSessionSchema);