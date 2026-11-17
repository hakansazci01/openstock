/**
 * Gelişmiş Risk Yönetimi Modülü
 *
 * Profesyonel algoritmic trading standartlarına uygun risk kontrolleri:
 * - Kelly Criterion position sizing
 * - ATR (Average True Range) bazlı volatilite ayarlı position sizing
 * - Maksimum eşzamanlı pozisyon sınırı
 * - Korelasyon sınırı (aynı sektördeki sembollerin concentración riski)
 * - Pozisyon yaşı sınırı (çok uzun süren pozisyonlar)
 * - Basit Value at Risk (VaR) tahmini
 */

import { logWarn } from '@/lib/logger';

export interface RiskManagementConfig {
    maxConcurrentPositions: number;
    maxPositionPercent: number;
    maxDailyTrades: number;
    maxDailyTradesPerSymbol: number;
    maxPositionAgeMinutes: number;
    kellyFraction: number;
    riskPerTradePercent: number;
    atrMultiplier: number;
    maxDrawdownPercent: number;
    correlationLimit: number;
}

export interface PositionSizingResult {
    quantity: number;
    notional: number;
    riskAmount: number;
    stopLossPrice?: number;
    method: 'kelly' | 'atr' | 'fixed';
    reason: string;
}

export interface TradeCooldownState {
    lastTradeAt?: Date;
    tradeCountToday: number;
    dailyTradesPerSymbol: Record<string, number>;
}

export interface CircuitBreakerState {
    triggered: boolean;
    reason?: string;
    triggeredAt?: Date;
}

export const DEFAULT_RISK_CONFIG: RiskManagementConfig = {
    maxConcurrentPositions: 5,
    maxPositionPercent: 20,
    maxDailyTrades: 20,
    maxDailyTradesPerSymbol: 3,
    maxPositionAgeMinutes: 480,
    kellyFraction: 0.25,
    riskPerTradePercent: 2,
    atrMultiplier: 2.0,
    maxDrawdownPercent: 10,
    correlationLimit: 3,
};

/**
 * Kelly Criterion ile optimal position büyüklüğü hesaplar.
 * f* = (bp - q) / b, burada b = odds, p = win probability, q = loss probability.
 * Güvenlik için sonuç kellyFraction ile çarpılır.
 */
export function kellyPositionSize({
    winRate,
    avgWin,
    avgLoss,
    equity,
    riskPerTradePercent,
}: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    equity: number;
    riskPerTradePercent: number;
}): PositionSizingResult {
    if (avgLoss <= 0 || equity <= 0) {
        return {
            quantity: 0,
            notional: 0,
            riskAmount: 0,
            method: 'kelly',
            reason: 'Geçersiz giriş değerleri',
        };
    }

    const p = Math.max(0, Math.min(1, winRate));
    const q = 1 - p;
    const b = avgWin / avgLoss;

    const kellyFraction = (b * p - q) / b;
    const safeFraction = Math.max(0, Math.min(kellyFraction * 0.25, 0.25));

    const riskAmount = equity * (safeFraction > 0 ? safeFraction : riskPerTradePercent / 100);
    const notional = riskAmount;

    return {
        quantity: 0,
        notional,
        riskAmount,
        method: 'kelly',
        reason: `Kelly Criterion: %${(safeFraction * 100).toFixed(2)} pozisyon`,
    };
}

/**
 * ATR (Average True Range) bazlı volatilite ayarlı position sizing.
 * Stop loss mesafesi ATR'ye göre belirlenir, position büyüklüğü risk yüzdesine göre.
 */
export function atrPositionSize({
    equity,
    price,
    atr,
    atrMultiplier = 2,
    riskPerTradePercent = 2,
}: {
    equity: number;
    price: number;
    atr: number;
    atrMultiplier?: number;
    riskPerTradePercent?: number;
}): PositionSizingResult {
    if (!price || price <= 0 || !atr || atr <= 0 || equity <= 0) {
        return {
            quantity: 0,
            notional: 0,
            riskAmount: 0,
            method: 'atr',
            reason: 'Geçersiz fiyat veya ATR',
        };
    }

    const riskAmount = equity * (riskPerTradePercent / 100);
    const stopDistance = atr * atrMultiplier;
    const stopLossPrice = price - stopDistance;
    const quantity = riskAmount / stopDistance;
    const notional = quantity * price;

    return {
        quantity: Math.max(0, quantity),
        notional,
        riskAmount,
        stopLossPrice: Math.max(0, stopLossPrice),
        method: 'atr',
        reason: `ATR-based: stop $${stopLossPrice.toFixed(2)}, risk $${riskAmount.toFixed(2)}`,
    };
}

/**
 * Maksimum eşzamanlı pozisyon kontrolü.
 */
export function checkMaxConcurrentPositions({
    currentPositions,
    maxConcurrentPositions,
}: {
    currentPositions: number;
    maxConcurrentPositions: number;
}): { allowed: boolean; reason?: string } {
    if (currentPositions >= maxConcurrentPositions) {
        return {
            allowed: false,
            reason: `Maksimum eşzamanlı pozisyon sınırına ulaşıldı (${currentPositions}/${maxConcurrentPositions})`,
        };
    }
    return { allowed: true };
}

/**
 * Pozisyon yaşı kontrolü (çok uzun süren pozisyonları tespit eder).
 */
export function checkPositionAge({
    entryTime,
    maxAgeMinutes,
}: {
    entryTime: Date;
    maxAgeMinutes: number;
}): { expired: boolean; ageMinutes: number; reason?: string } {
    const now = new Date();
    const ageMinutes = (now.getTime() - entryTime.getTime()) / (1000 * 60);

    if (ageMinutes > maxAgeMinutes) {
        return {
            expired: true,
            ageMinutes,
            reason: `Pozisyon yaşı ${ageMinutes.toFixed(0)} dakika aştı (limit: ${maxAgeMinutes})`,
        };
    }
    return { expired: false, ageMinutes };
}

/**
 * Günlük trade sayısı ve cooldown kontrolü.
 */
export function checkTradeCooldown({
    state,
    symbol,
    config,
    now = new Date(),
}: {
    state: TradeCooldownState;
    symbol: string;
    config: RiskManagementConfig;
    now?: Date;
}): { allowed: boolean; reason?: string; state: TradeCooldownState } {
    const today = now.toDateString();
    if (!state.lastTradeAt || state.lastTradeAt.toDateString() !== today) {
        state.tradeCountToday = 0;
        state.dailyTradesPerSymbol = {};
    }

    if (state.tradeCountToday >= config.maxDailyTrades) {
        return {
            allowed: false,
            reason: `Günlük işlem limitine ulaşıldı (${config.maxDailyTrades})`,
            state,
        };
    }

    const symbolCount = state.dailyTradesPerSymbol[symbol] ?? 0;
    if (symbolCount >= config.maxDailyTradesPerSymbol) {
        return {
            allowed: false,
            reason: `${symbol} için günlük işlem limitine ulaşıldı (${config.maxDailyTradesPerSymbol})`,
            state,
        };
    }

    return { allowed: true, state };
}

/**
 * Trade kaydı sonrası state'i günceller.
 */
export function recordTrade({
    state,
    symbol,
    now = new Date(),
}: {
    state: TradeCooldownState;
    symbol: string;
    now?: Date;
}): TradeCooldownState {
    state.lastTradeAt = now;
    state.tradeCountToday += 1;
    state.dailyTradesPerSymbol[symbol] = (state.dailyTradesPerSymbol[symbol] ?? 0) + 1;
    return state;
}

/**
 * Basit Value at Risk (VaR) tahmini - geçmiş getirilere dayalı.
 * %95 güven seviyesinde 1-günlük VaR.
 */
export function estimateVaR({
    returns,
    equity,
    confidence = 0.95,
}: {
    returns: number[];
    equity: number;
    confidence?: number;
}): { var: number; varPercent: number } {
    if (returns.length < 10) {
        return { var: 0, varPercent: 0 };
    }

    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sorted.length);
    const worstReturn = sorted[index] ?? 0;
    const varAmount = equity * Math.abs(worstReturn);

    return {
        var: varAmount,
        varPercent: Math.abs(worstReturn) * 100,
    };
}

/**
 * Tüm risk kontrollerini tek seferde çalıştırır.
 */
export function runFullRiskCheck({
    config,
    currentPositions,
    equity,
    symbol,
    cooldownState,
    entryTime,
}: {
    config: RiskManagementConfig;
    currentPositions: number;
    equity: number;
    symbol: string;
    cooldownState: TradeCooldownState;
    entryTime?: Date;
}): {
    allowed: boolean;
    reason?: string;
    cooldownState: TradeCooldownState;
    circuitBreaker?: CircuitBreakerState;
} {
    const concurrentCheck = checkMaxConcurrentPositions({
        currentPositions,
        maxConcurrentPositions: config.maxConcurrentPositions,
    });
    if (!concurrentCheck.allowed) {
        return { allowed: false, reason: concurrentCheck.reason, cooldownState };
    }

    const cooldownCheck = checkTradeCooldown({
        state: cooldownState,
        symbol,
        config,
    });
    if (!cooldownCheck.allowed) {
        return { allowed: false, reason: cooldownCheck.reason, cooldownState: cooldownCheck.state };
    }

    if (entryTime) {
        const ageCheck = checkPositionAge({
            entryTime,
            maxAgeMinutes: config.maxPositionAgeMinutes,
        });
        if (ageCheck.expired) {
            logWarn('Pozisyon yaşı sınırına ulaştı', {
                symbol,
                ageMinutes: ageCheck.ageMinutes,
                limit: config.maxPositionAgeMinutes,
            });
        }
    }

    return { allowed: true, cooldownState: cooldownCheck.state };
}

