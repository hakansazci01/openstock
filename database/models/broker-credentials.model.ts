import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface IBrokerCredentials extends Document {
    userId: string;
    broker: 'alpaca' | 'binance' | 'kraken' | 'interactive_brokers' | 'coinbase' | 'bybit' | 'custom';
    apiKey: string;          // Encrypted at rest
    apiSecret: string;       // Encrypted at rest
    apiUrl?: string;         // Custom broker base URL
    isConnected: boolean;
    lastSyncedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const BrokerCredentialsSchema = new Schema<IBrokerCredentials>(
    {
        userId: { type: String, required: true, index: true, unique: true },
        broker: { type: String, required: true, enum: ['alpaca', 'binance', 'kraken', 'interactive_brokers', 'coinbase', 'bybit', 'custom'] },
        apiKey: { type: String, required: true },
        apiSecret: { type: String, required: true },
        apiUrl: { type: String, required: false },
        isConnected: { type: Boolean, default: false },
        lastSyncedAt: { type: Date },
    },
    { timestamps: true }
);

BrokerCredentialsSchema.index({ userId: 1 }, { unique: true });

export const BrokerCredentials: Model<IBrokerCredentials> =
    (models?.BrokerCredentials as Model<IBrokerCredentials>) || model<IBrokerCredentials>('BrokerCredentials', BrokerCredentialsSchema);