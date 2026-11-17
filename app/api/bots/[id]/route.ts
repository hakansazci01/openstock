import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/better-auth/auth';
import { Bot, Trade } from '@/database/models/Bot';
import { runBotCycle } from '@/lib/bot/paper-trading';
import { runLiveBot } from '@/lib/bot/broker-execution';
import { connectToDatabase } from '@/database/mongoose';
import { BotInputError, normalizeBotInput, readRequestBody } from '@/lib/bot/input';
import { getBotTrades, getUserBots } from '@/lib/bot/queries';
import { getBrokerCredentialsForUser } from '@/lib/broker/broker.service';
import { isLiveBrokerUrl, isLiveTradingEnabled } from '@/lib/broker/registry';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function ownedBot(userId: string, id: string) {
    await connectToDatabase();
    const bot = await Bot.findById(id);
    if (!bot) return { error: NextResponse.json({ error: 'Bot bulunamadı' }, { status: 404 }) };
    if (bot.userId !== userId) return { error: NextResponse.json({ error: 'Erişim reddedildi' }, { status: 403 }) };
    return { bot };
}

/** Live bots may only start when their broker is connected and live trading is on. */
async function liveReadinessError(userId: string): Promise<string | null> {
    const creds = await getBrokerCredentialsForUser(userId);
    if (!creds || !creds.isConnected) {
        return 'Canlı trading için doğrulanmış broker bağlantısı gereklidir';
    }
    if (isLiveBrokerUrl(creds.broker, creds.apiUrl) && !isLiveTradingEnabled()) {
        return 'Canlı (gerçek para) işlem kapalı. Sunucuda LIVE_TRADING_ENABLED=true ayarlanmalı.';
    }
    return null;
}

export async function GET(_req: Request, { params }: Params) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

        const { id } = await params;
        const result = await ownedBot(session.user.id, id);
        if (result.error) return result.error;

        const [bot, trades] = await Promise.all([getUserBots(session.user.id), getBotTrades(id)]);
        return NextResponse.json({ bot: bot.find((item) => item._id === id) ?? result.bot?.toObject(), trades });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function PUT(req: Request, { params }: Params) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

        const { id } = await params;
        const result = await ownedBot(session.user.id, id);
        if (result.error || !result.bot) return result.error!;

        const body = await readRequestBody(req);
        const merged = {
            name: body.name ?? result.bot.name,
            description: body.description ?? result.bot.description,
            type: body.type ?? result.bot.type,
            strategy: body.strategy ?? result.bot.strategy,
            strategyConfig: body.strategyConfig ?? result.bot.strategyConfig,
            symbols: body.symbols ?? result.bot.symbols,
            exchange: body.exchange ?? result.bot.exchange,
            initialCapital: body.initialCapital ?? result.bot.initialCapital,
            intervalMinutes: body.intervalMinutes ?? result.bot.intervalMinutes,
        };

        const input = normalizeBotInput(merged);
        const update: Record<string, unknown> = { ...input, updatedAt: new Date() };

        // `isPaper` is what the execution engine actually reads, so it must
        // follow the type change; otherwise a "live" bot would trade on paper.
        update.isPaper = input.type !== 'live';

        if (input.type === 'live' && result.bot.type !== 'live') {
            const readiness = await liveReadinessError(session.user.id);
            if (readiness) return NextResponse.json({ error: readiness }, { status: 400 });
        }

        // Resetting the starting capital is only safe before the first fill.
        if (input.initialCapital !== result.bot.initialCapital) {
            const fillCount = await Trade.countDocuments({ botId: id });
            if (fillCount > 0) delete update.initialCapital;
            else {
                update.currentCapital = input.initialCapital;
                update.cash = input.initialCapital;
            }
        }

        const updated = await Bot.findByIdAndUpdate(id, update, { new: true }).lean();
        revalidatePath('/bots');
        revalidatePath(`/bots/${id}`);
        revalidatePath('/dashboard');

        return NextResponse.json({ bot: updated });
    } catch (err) {
        if (err instanceof BotInputError) {
            return NextResponse.json({ error: err.message, field: err.field }, { status: 400 });
        }
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: Params) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

        const { id } = await params;
        const result = await ownedBot(session.user.id, id);
        if (result.error) return result.error;

        await Promise.all([
            Bot.findByIdAndDelete(id),
            Trade.deleteMany({ botId: id }),
        ]);

        revalidatePath('/bots');
        revalidatePath('/dashboard');
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function POST(req: Request, { params }: Params) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });

        const { id } = await params;
        const result = await ownedBot(session.user.id, id);
        if (result.error || !result.bot) return result.error!;

        const body = await readRequestBody(req);
        const action = String(body.action ?? '');
        const now = new Date();

        if (action === 'run') {
            // Live bots must go through the real broker engine. Running the paper
            // engine on a live bot would show simulated fills that never happened.
            if (!result.bot.isPaper && result.bot.type === 'live') {
                const liveResults = await runLiveBot(id, { force: true, userId: session.user.id });
                const trades = liveResults
                    .filter((item) => item.success)
                    .map((item) => ({
                        symbol: item.symbol,
                        side: item.side,
                        quantity: item.quantity,
                        price: item.price,
                        orderId: item.orderId,
                    }));

                revalidatePath('/bots');
                revalidatePath(`/bots/${id}`);
                revalidatePath('/dashboard');

                const failures = liveResults.filter((item) => !item.success);
                if (liveResults.length > 0 && failures.length === liveResults.length) {
                    return NextResponse.json({
                        error: failures.map((item) => item.message).join(' | '),
                        results: liveResults,
                        trades,
                    }, { status: 400 });
                }

                return NextResponse.json({ success: true, trades, results: liveResults });
            }

            const run = await runBotCycle(id, { force: true });
            revalidatePath('/bots');
            revalidatePath(`/bots/${id}`);
            revalidatePath('/dashboard');
            if (run.error) return NextResponse.json({ error: run.error }, { status: 400 });
            return NextResponse.json(run);
        }

        if (action === 'start') {
            if (!result.bot.isPaper && result.bot.type === 'live') {
                const readiness = await liveReadinessError(session.user.id);
                if (readiness) return NextResponse.json({ error: readiness }, { status: 400 });
            }
            await Bot.findByIdAndUpdate(id, {
                status: 'running',
                lastError: undefined,
                nextRunAt: new Date(now.getTime() + Math.max(1, result.bot.intervalMinutes || 15) * 60_000),
                updatedAt: now,
            });
            revalidatePath('/bots');
            revalidatePath(`/bots/${id}`);
            revalidatePath('/dashboard');
            return NextResponse.json({ success: true, message: 'Bot başlatıldı' });
        }

        if (action === 'pause' || action === 'stop') {
            await Bot.findByIdAndUpdate(id, {
                status: action === 'pause' ? 'paused' : 'stopped',
                updatedAt: now,
            });
            revalidatePath('/bots');
            revalidatePath(`/bots/${id}`);
            revalidatePath('/dashboard');
            return NextResponse.json({ success: true, message: action === 'pause' ? 'Bot duraklatıldı' : 'Bot durduruldu' });
        }

        if (action === 'reset') {
            await Trade.deleteMany({ botId: id });
            await Bot.findByIdAndUpdate(id, {
                status: 'draft',
                currentCapital: result.bot.initialCapital,
                cash: result.bot.initialCapital,
                totalReturn: 0,
                totalReturnPercent: 0,
                maxDrawdown: 0,
                winRate: 0,
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                lastError: undefined,
                lastSignals: [],
                lastRunAt: undefined,
                nextRunAt: undefined,
                updatedAt: now,
            });
            revalidatePath('/bots');
            revalidatePath(`/bots/${id}`);
            revalidatePath('/dashboard');
            return NextResponse.json({ success: true, message: 'Bot sıfırlandı' });
        }

        return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}
