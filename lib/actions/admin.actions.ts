'use server';

import { connectToDatabase } from "@/database/mongoose";
import { getSession } from "@/lib/better-auth/auth";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";

async function requireAdmin() {
    const session = await getSession();
    if (!session?.user) redirect('/sign-in');
    const user = session.user as { role?: string };
    if (user.role !== 'admin') redirect('/dashboard');
    return user;
}

export async function getAllUsers() {
    await requireAdmin();
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db!;
    return await db.collection('user')
        .find({}, { projection: { email: 1, name: 1, role: 1, createdAt: 1, country: 1 } })
        .sort({ createdAt: -1 })
        .toArray();
}

export async function updateUserRole(userId: string, role: string) {
    await requireAdmin();
    if (role !== 'user' && role !== 'admin') throw new Error('Geçersiz rol');
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db!;
    return await db.collection('user').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { role } }
    );
}

export async function deleteUser(userId: string) {
    await requireAdmin();
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db!;
    const user = await db.collection('user').findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error('Kullanıcı bulunamadı');
    if (user.role === 'admin') throw new Error('Admin kullanıcı silinemez');
    await db.collection('user').deleteOne({ _id: new ObjectId(userId) });
    await db.collection('account').deleteMany({ userId: String(user._id) });
    await db.collection('session').deleteMany({ userId: String(user._id) });
    await db.collection('alerts').deleteMany({ userId: String(user._id) }).catch(() => undefined);
    await db.collection('watchlists').deleteMany({ userId: String(user._id) }).catch(() => undefined);
    return { success: true };
}

export async function getSystemStats() {
    await requireAdmin();
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db!;

    const count = async (name: string, filter: Record<string, unknown> = {}) => {
        try {
            return await db.collection(name).countDocuments(filter);
        } catch {
            return 0;
        }
    };

    const [userCount, adminCount, accountCount, sessionCount, alertCount, watchlistCount, botCount, runningBots, tradeCount] = await Promise.all([
        count('user'),
        count('user', { role: 'admin' }),
        count('account'),
        count('session'),
        count('alerts'),
        count('watchlists'),
        count('bots'),
        count('bots', { status: 'running' }),
        count('trades'),
    ]);

    return {
        users: userCount,
        admins: adminCount,
        accounts: accountCount,
        sessions: sessionCount,
        alerts: alertCount,
        watchlists: watchlistCount,
        bots: botCount,
        runningBots,
        trades: tradeCount,
    };
}

export async function getEnvInfo() {
    await requireAdmin();

    const hasTwilio = Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM &&
        process.env.TWILIO_WHATSAPP_TO,
    );
    const hasAI = Boolean(
        process.env.OPENAI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.OPENROUTER_API_KEY,
    );

    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        authUrl: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
        hasFinnhubKey: Boolean(process.env.FINNHUB_API_KEY || process.env.FINNHUB_API_KEYS),
        hasEmailConfig: Boolean(process.env.NODEMAILER_EMAIL && process.env.NODEMAILER_PASSWORD),
        hasInngest: Boolean(process.env.INNGEST_EVENT_KEY),
        hasTwilio,
        hasWhatsAppRecipient: Boolean(process.env.TWILIO_WHATSAPP_TO),
        hasAI,
        dataMode: process.env.NEXT_PUBLIC_OPENSTOCK_DATA_MODE === 'realtime' ? 'realtime' : 'cached',
    };
}
