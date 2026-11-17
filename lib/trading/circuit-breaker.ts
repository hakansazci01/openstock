import { connectToDatabase } from '@/database/mongoose';
import { TradingSession } from '@/database/models/trading-session.model';
import { logWarn } from '@/lib/logger';

/**
 * Circuit Breaker - Günlük kayıp limiti aşıldığında trading'i durdurur.
 */

export interface CircuitBreakerConfig {
    maxDailyLossUSD: number;
    maxDailyNotionalUSD: number;
    maxOrderNotionalUSD: number;
    maxPositionPercent: number;
}

/**
 * Günlük kayıp limitini kontrol eder ve aşıldığında kill switch'i aktive eder.
 * Bu fonksiyon her işlem sonrasında çağrılmalı.
 */
export async function checkDailyLossLimit(
    userId: string,
    realizedPnL: number,
    config: CircuitBreakerConfig
): Promise<{ breached: boolean; newPnL: number }> {
    await connectToDatabase();

    const session = await TradingSession.findOne({ userId }).lean();
    if (!session) return { breached: false, newPnL: realizedPnL };

    const newPnL = Number(session.dailyRealizedPnl || 0) + realizedPnL;

    // Günlük kayıp limiti kontrolü (negatif PnL = kayıp)
    const dailyLoss = -newPnL;
    if (dailyLoss >= config.maxDailyLossUSD && !session.dailyLossLimitReached) {
        await TradingSession.findOneAndUpdate(
            { userId },
            {
                dailyLossLimitReached: true,
                status: 'killed',
                killSwitchReason: `Günlük kayıp limiti aşıldı: $${dailyLoss.toFixed(2)} >= $${config.maxDailyLossUSD.toFixed(2)}`,
                updatedAt: new Date(),
            }
        );
        logWarn('Circuit breaker: günlük kayıp limiti aşıldı, kill switch aktive edildi', {
            userId,
            dailyLoss,
            limit: config.maxDailyLossUSD,
        });
        return { breached: true, newPnL };
    }

    return { breached: false, newPnL };
}

/**
 * Emir başına notional sınırını kontrol eder.
 */
export function validateOrderNotional(notional: number, config: CircuitBreakerConfig): { allowed: boolean; reason?: string } {
    if (notional <= 0) {
        return { allowed: false, reason: 'Emir değeri sıfır veya negatif olamaz' };
    }
    if (notional > config.maxOrderNotionalUSD) {
        return {
            allowed: false,
            reason: `Emir değeri ($${notional.toFixed(2)}) günlük başına maksimum sınırı ($${config.maxOrderNotionalUSD.toFixed(2)}) aşıyor`,
        };
    }
    return { allowed: true };
}

/**
 * Günlük notional toplamını kontrol eder.
 */
export function validateDailyNotional(
    currentDailyNotional: number,
    newOrderNotional: number,
    config: CircuitBreakerConfig
): { allowed: boolean; reason?: string } {
    const projected = currentDailyNotional + newOrderNotional;
    if (projected > config.maxDailyNotionalUSD) {
        return {
            allowed: false,
            reason: `Günlük notional toplamı ($${projected.toFixed(2)}) limiti ($${config.maxDailyNotionalUSD.toFixed(2)}) aşıyor`,
        };
    }
    return { allowed: true };
}

/**
 * Pozisyon yüzdesini doğrular (tek sembolde portföydeki max %).
 */
export function validatePositionPercent(
    positionPercent: number,
    config: CircuitBreakerConfig
): { allowed: boolean; reason?: string } {
    if (positionPercent > config.maxPositionPercent) {
        return {
            allowed: false,
            reason: `Tek sembolik pozisyon yüzdesi (%${positionPercent.toFixed(1)}) limiti (%${config.maxPositionPercent.toFixed(1)}) aşıyor`,
        };
    }
    return { allowed: true };
}

/**
 * Trading konfigürasyonunu .env'den yükler.
 */
export function loadCircuitBreakerConfig(): CircuitBreakerConfig {
    return {
        maxDailyLossUSD: Number(process.env.LIVE_MAX_DAILY_LOSS_USD) || 100,
        maxDailyNotionalUSD: Number(process.env.LIVE_MAX_DAILY_NOTIONAL_USD) || 500,
        maxOrderNotionalUSD: Number(process.env.LIVE_MAX_ORDER_NOTIONAL_USD) || 100,
        maxPositionPercent: Number(process.env.LIVE_MAX_POSITION_PERCENT) || 20,
    };
}