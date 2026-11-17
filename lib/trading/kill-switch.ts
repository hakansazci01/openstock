'use server';

import { connectToDatabase } from '@/database/mongoose';
import { TradingSession } from '@/database/models/trading-session.model';
import { logError, logInfo, logWarn } from '@/lib/logger';

/**
 * Kill Switch - Tüm trading aktivitelerini acil olarak durdurur.
 * Kullanıcı veya sistem tarafından tetiklenebilir.
 */

export interface KillSwitchState {
    enabled: boolean;
    status: 'active' | 'paused' | 'killed';
    reason?: string;
    dailyLossLimitReached: boolean;
    dailyTradedNotional: number;
}

/**
 * Mevcut trading session'ı getirir veya oluşturur.
 */
async function getOrCreateSession(userId: string): Promise<any> {
    await connectToDatabase();
    const now = new Date();
    // Gece 00:00 UTC'de resetle
    const resetAt = new Date(now);
    resetAt.setUTCHours(24, 0, 0, 0);

    let session: any = await TradingSession.findOne({ userId }).lean();
    if (!session) {
        const created = await TradingSession.create({
            userId,
            status: 'active',
            dailyTradedNotional: 0,
            dailyRealizedPnl: 0,
            dailyLossLimitReached: false,
            resetAt,
        });
        session = created.toObject ? created.toObject() : created;
    } else {
        // Gün değişmişse sayaçları sıfırla
        const sessionReset = new Date(session.resetAt);
        if (now >= sessionReset) {
            session = await TradingSession.findOneAndUpdate(
                { userId },
                {
                    dailyTradedNotional: 0,
                    dailyRealizedPnl: 0,
                    dailyLossLimitReached: false,
                    status: session.status === 'killed' ? 'killed' : 'active', // Kill switch kalıcıdır, sadece manuel sıfırlanabilir
                    resetAt: new Date(sessionReset.getTime() + 24 * 60 * 60 * 1000),
                },
                { new: true }
            ).lean();
        }
    }
    return session;
}

/**
 * Trading durumunu döndürür (kill switch, günlük limitler, vb.)
 */
export async function getTradingState(userId: string): Promise<KillSwitchState> {
    const session = await getOrCreateSession(userId);
    if (!session) {
        throw new Error('Trading oturumu oluşturulamadı');
    }
    return {
        enabled: session.status !== 'active',
        status: session.status,
        reason: session.killSwitchReason,
        dailyLossLimitReached: Boolean(session.dailyLossLimitReached),
        dailyTradedNotional: Number(session.dailyTradedNotional || 0),
    };
}

/**
 * Kill switch'i aktive eder (tüm trading durdurulur).
 */
export async function activateKillSwitch(userId: string, reason: string): Promise<void> {
    await connectToDatabase();
    await TradingSession.findOneAndUpdate(
        { userId },
        {
            status: 'killed',
            killSwitchReason: reason,
            updatedAt: new Date(),
        },
        { upsert: true }
    );
    logWarn('Kill switch aktifleştirildi', { userId, reason });
}

/**
 * Kill switch'i devre dışı bırakır (trading yeniden aktif olur).
 * Yalnızca manuel olarak yapılmalı, otomatik sıfırlanmaz.
 */
export async function deactivateKillSwitch(userId: string): Promise<void> {
    await connectToDatabase();
    await TradingSession.findOneAndUpdate(
        { userId },
        {
            status: 'active',
            killSwitchReason: undefined,
            updatedAt: new Date(),
        },
        { upsert: true }
    );
    logInfo('Kill switch devre dışı bırakıldı', { userId });
}

/**
 * Bir emirden önce trading'in izin verilip verilmediğini kontrol eder.
 * Engellense hata fırlatır.
 */
export async function assertTradingAllowed(userId: string): Promise<void> {
    const state = await getTradingState(userId);
    if (state.status === 'killed') {
        throw new Error(`Trading durduruldu (kill switch): ${state.reason || 'bilinmeyen neden'}`);
    }
    if (state.dailyLossLimitReached) {
        throw new Error('Günlük kayıp limiti aşıldı. Trading geçici olarak durduruldu.');
    }
}

/**
 * Günlük işlem notional'ını artırır.
 */
export async function recordDailyNotional(userId: string, notional: number): Promise<void> {
    await connectToDatabase();
    await TradingSession.findOneAndUpdate(
        { userId },
        {
            $inc: { dailyTradedNotional: notional },
            lastOrderAt: new Date(),
            updatedAt: new Date(),
        },
        { upsert: true }
    );
}

/**
 * Günlük gerçekleşen kar/zararı günceller.
 */
export async function recordDailyPnL(userId: string, pnl: number): Promise<void> {
    await connectToDatabase();
    await TradingSession.findOneAndUpdate(
        { userId },
        {
            $inc: { dailyRealizedPnl: pnl },
            updatedAt: new Date(),
        },
        { upsert: true }
    );
}