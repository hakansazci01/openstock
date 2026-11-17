import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import { Bot } from '@/database/models/Bot';
import { BrokerCredentials } from '@/database/models/broker-credentials.model';
import { connectToDatabase } from '@/database/mongoose';
import { BotInputError, normalizeBotInput, readRequestBody } from '@/lib/bot/input';
import { getUserBots } from '@/lib/bot/queries';
import { isLiveBrokerUrl, isLiveTradingEnabled, isSupportedBroker, normalizeBrokerUrl } from '@/lib/broker/registry';

export const dynamic = 'force-dynamic';

const BOTS_LIMIT = 30; // 30 istek / dakika

interface Session {
    user: { id: string; [key: string]: unknown } | null;
}

export async function GET() {
    let session: Session | null = null;
    try {
        session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`bots:user:${session.user.id}`, BOTS_LIMIT, 60, 1)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const bots = await getUserBots(session.user.id);
        return NextResponse.json({ bots });
    } catch (err) {
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
    }

    if (await isRateLimited(`bots:user:${session.user.id}`, BOTS_LIMIT, 60, 1)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    try {
        const body = await readRequestBody(req);
        const input = normalizeBotInput(body);

        await connectToDatabase();

        // Free-plan guard: at most 25 bots per account keeps the 15-minute
        // scheduler (and the shared Finnhub quota) within bounds.
        const count = await Bot.countDocuments({ userId: session.user.id });
        if (count >= 25) {
            return NextResponse.json({ error: 'En fazla 25 bot oluşturabilirsiniz' }, { status: 400 });
        }

        // Gerçek para (live) botları için broker credential kontrolü
        if (input.type === 'live') {
            const brokerCreds = await BrokerCredentials.findOne({
                userId: session.user.id,
                isConnected: true,
            }).lean();
            if (!brokerCreds) {
                return NextResponse.json({
                    error: 'Canlı trading için broker bağlantısı gereklidir. Önce broker ayarlarını yapın.',
                }, { status: 400 });
            }
            if (!isSupportedBroker(brokerCreds.broker)) {
                return NextResponse.json({ error: `Desteklenmeyen broker: ${brokerCreds.broker}` }, { status: 400 });
            }

            let apiUrl: string;
            try {
                apiUrl = normalizeBrokerUrl(brokerCreds.broker, brokerCreds.apiUrl);
            } catch (err) {
                return NextResponse.json(
                    { error: err instanceof Error ? err.message : 'Broker adresi geçersiz' },
                    { status: 400 },
                );
            }

            if (isLiveBrokerUrl(brokerCreds.broker, apiUrl) && !isLiveTradingEnabled()) {
                return NextResponse.json({
                    error: 'Canlı (gerçek para) işlem sunucuda kapalı. LIVE_TRADING_ENABLED=true ayarlanmadan canlı bot oluşturulamaz.',
                }, { status: 400 });
            }

            const stopLossPercent = Number(input.strategyConfig.stopLossPercent);
            if (!Number.isFinite(stopLossPercent) || stopLossPercent <= 0) {
                return NextResponse.json({
                    error: 'Canlı botlar için stop-loss yüzdesi (stopLossPercent) zorunludur.',
                    field: 'stopLossPercent',
                }, { status: 400 });
            }
        }

        const bot = await Bot.create({
            userId: session.user.id,
            ...input,
            status: 'draft',
            currentCapital: input.initialCapital,
            cash: input.initialCapital,
            totalReturn: 0,
            totalReturnPercent: 0,
            maxDrawdown: 0,
            winRate: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            rebalanceThreshold: 5,
            isPaper: input.type !== 'live',
            lastSignals: [],
        });

        revalidatePath('/bots');
        revalidatePath('/dashboard');

        return NextResponse.json({ bot: bot.toObject() }, { status: 201 });
    } catch (err) {
        if (err instanceof BotInputError) {
            return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
        }
        const message = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
