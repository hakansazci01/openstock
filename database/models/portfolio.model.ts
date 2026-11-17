import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface IPortfolio extends Document {
    userId: string;
    symbol: string;
    company: string;
    quantity: number;
    averagePrice: number;
    currentPrice?: number;
    totalValue?: number;
    pnl?: number;
    pnlPercent?: number;
    exchange?: string;
    createdAt: Date;
    updatedAt: Date;
}

const PortfolioSchema = new Schema<IPortfolio>({
    userId: { type: String, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, default: 0 },
    averagePrice: { type: Number, required: true, default: 0 },
    currentPrice: { type: Number },
    totalValue: { type: Number },
    pnl: { type: Number },
    pnlPercent: { type: Number },
    exchange: { type: String, trim: true },
}, { timestamps: true });

PortfolioSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Portfolio: Model<IPortfolio> = (models?.Portfolio as Model<IPortfolio>) || model<IPortfolio>('Portfolio', PortfolioSchema);