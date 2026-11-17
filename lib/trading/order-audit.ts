/**
 * Order Audit Trail Modülü
 *
 * Her trading kararının ve emrin detaylı kaydını tutar:
 * - Neden al/sat sinyali üretildi (strateji, güven, fiyat, indikatörler)
 * - Emir broker'a gönderilmeden önceki risk kontrolü
 * - Emir gerçekleştiği fiyat, slippage, komisyon
 * - Karar zinciri: Sinyal → Risk Onayı → Emir → Fill
 */

import { AuditLog } from '@/database/models/audit.log.model';
import { connectToDatabase } from '@/database/mongoose';

export interface TradingDecisionAudit {
    userId: string;
    botId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    action: 'signal' | 'risk_check' | 'order_placed' | 'order_filled' | 'order_cancelled' | 'stop_loss_triggered' | 'trailing_stop_triggered';
    strategy: string;
    confidence: number;
    price: number;
    quantity?: number;
    notional?: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
    trailingStopPrice?: number;
    regime?: string;
    regimeConfidence?: number;
    slippagePercent?: number;
    orderId?: string;
    brokerOrderId?: string;
    reason: string;
    metadata?: Record<string, unknown>;
    timestamp: Date;
}

/**
 * Bir trading kararını/emri audit log'a yazar.
 * Bu kayıt değiştirilemez (immutable) ve裁判/analiz için kullanılabilir.
 */
export async function recordTradingDecision(audit: TradingDecisionAudit): Promise<void> {
    await connectToDatabase();

    try {
        await AuditLog.create({
            userId: audit.userId,
            userEmail: undefined, // Caller'dan gelirse doldurulur
            action: `bot_${audit.action}`,
            resource: 'trading_decision',
            resourceId: audit.brokerOrderId ?? audit.orderId,
            details: {
                botId: audit.botId,
                symbol: audit.symbol,
                side: audit.side,
                strategy: audit.strategy,
                confidence: audit.confidence,
                price: audit.price,
                quantity: audit.quantity,
                notional: audit.notional,
                stopLossPrice: audit.stopLossPrice,
                takeProfitPrice: audit.takeProfitPrice,
                trailingStopPrice: audit.trailingStopPrice,
                regime: audit.regime,
                regimeConfidence: audit.regimeConfidence,
                slippagePercent: audit.slippagePercent,
                orderId: audit.orderId,
                brokerOrderId: audit.brokerOrderId,
                reason: audit.reason,
                metadata: audit.metadata,
                timestamp: audit.timestamp,
            },
        });
    } catch (err) {
        // Audit log yazım hatası asıl işlemi engellememeli
        console.error('Audit log yazma hatası:', err);
    }
}

/**
 * Sinyal üretimi anında audit kaydı oluşturur.
 */
export async function recordSignalAudit(params: {
    userId: string;
    botId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    strategy: string;
    confidence: number;
    price: number;
    regime?: string;
    regimeConfidence?: number;
    reason: string;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    await recordTradingDecision({
        ...params,
        action: 'signal',
        timestamp: new Date(),
    });
}

/**
 * Risk kontrolü anında audit kaydı oluşturur.
 */
export async function recordRiskCheckAudit(params: {
    userId: string;
    botId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    strategy: string;
    price: number;
    quantity: number;
    notional: number;
    allowed: boolean;
    reason: string;
    stopLossPrice?: number;
    confidence?: number;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    await recordTradingDecision({
        ...params,
        confidence: params.confidence ?? 0,
        action: 'risk_check',
        timestamp: new Date(),
    });
}

/**
 * Emir yerleştirildiğinde audit kaydı oluşturur.
 */
export async function recordOrderPlacedAudit(params: {
    userId: string;
    botId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    strategy: string;
    price: number;
    quantity: number;
    notional: number;
    orderId: string;
    brokerOrderId?: string;
    slippagePercent?: number;
    reason: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    await recordTradingDecision({
        ...params,
        confidence: params.confidence ?? 0,
        action: 'order_placed',
        timestamp: new Date(),
    });
}

/**
 * Emir doldurulduğunda (fill) audit kaydı oluşturur.
 */
export async function recordOrderFilledAudit(params: {
    userId: string;
    botId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    strategy: string;
    price: number;
    quantity: number;
    notional: number;
    orderId: string;
    brokerOrderId?: string;
    slippagePercent?: number;
    reason: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    await recordTradingDecision({
        ...params,
        confidence: params.confidence ?? 0,
        action: 'order_filled',
        timestamp: new Date(),
    });
}

/**
 * Stop-loss veya trailing stop tetiklendiğinde audit kaydı oluşturur.
 */
export async function recordStopLossTriggeredAudit(params: {
    userId: string;
    botId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    strategy: string;
    price: number;
    quantity: number;
    notional: number;
    stopType: 'stop_loss' | 'trailing_stop' | 'break_even';
    orderId: string;
    brokerOrderId?: string;
    reason: string;
    confidence?: number;
    metadata?: Record<string, unknown>;
}): Promise<void> {
    await recordTradingDecision({
        ...params,
        confidence: params.confidence ?? 0,
        action: params.stopType === 'trailing_stop' ? 'trailing_stop_triggered' : 'stop_loss_triggered',
        timestamp: new Date(),
    });
}

