import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface IUser extends Document {
    id: string;
    email: string;
    name?: string;
    emailVerified?: boolean;
    image?: string;
    country?: string;
    investmentGoals?: string;
    riskTolerance?: string;
    preferredIndustry?: string;
    role?: string;
    lastActiveAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, trim: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String },
    country: { type: String, trim: true },
    investmentGoals: { type: String, trim: true },
    riskTolerance: { type: String, trim: true },
    preferredIndustry: { type: String, trim: true },
    role: { type: String, default: "user", enum: ["user", "admin"] },
    lastActiveAt: { type: Date },
}, { timestamps: true });

export const User: Model<IUser> = (models?.User as Model<IUser>) || model<IUser>('User', UserSchema);