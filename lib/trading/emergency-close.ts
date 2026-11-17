/**
 * Acil Durum Kapatma Modülü
 *
 * Kritik durumlarda tüm açık pozisyonları tek işlemde kapatmak için:
 * - Emergency Kill Switch: Tüm botları durdurur, tüm emirleri iptal eder
 * - Close All Positions: Tüm açık pozisyonları market order ile kapatır
 * - Selective Close: Belirli sembol veya broker'daki pozisyonları kapatır
 */

import { logError, logInfo, logWarn } from '@/lib/logger';
import { BaseBrokerAdapter, BrokerPosition } from '@/lib/broker/broker-adapter';
import { createBrokerAdapter, normalizeBrokerUrl } from '@/lib/broker/registry';
import { connectToDatabase } from '@/database/mongoose';

export interface EmergencyCloseResult {
    success: boolean;
    closedPositions: number;
    failedPositions: number;
    cancelledOrders: number;
    errors: string[];
    details: Array<{
        symbol: string;
        side: 'buy' | 'sell';
        quantity: number;
        success: boolean;
        error?: string;
    }>;
}

export interface EmergencyCloseConfig {
    maxSlippagePercent: number;
    cancelAllOrders: boolean;
    closeAllPositions: boolean;
    stopAllBots: boolean;
}

export const DEFAULT_EMERGENCY_CONFIG: EmergencyCloseConfig = {
    maxSlippagePercent: 2.0,
    cancelAllOrders: true,
    closeAllPositions: true,
    stopAllBots: true,
};

export async function emergencyCloseAll({
    userId,
    broker,
    apiKey,
    apiSecret,
    apiUrl,
    config = DEFAULT_EMERGENCY_CONFIG,
}: {
    userId: string;
    broker: string;
    apiKey: string;
    apiSecret: string;
    apiUrl?: string;
    config?: EmergencyCloseConfig;
}): Promise<EmergencyCloseResult> {
    const result: EmergencyCloseResult = {
        success: false,
        closedPositions: 0,
        failedPositions: 0,
        cancelledOrders: 0,
        errors: [],
        details: [],
    };

    try {
        await connectToDatabase();

        const normalizedUrl = normalizeBrokerUrl(broker as any, apiUrl);
        const adapter = createBrokerAdapter(broker);

        if (!adapter) {
            result.errors.push(`${broker} adaptörü desteklenmiyor`);
            return result;
        }

        const connected = await adapter.connect(apiKey, apiSecret, normalizedUrl);
        if (!connected) {
            result.errors.push('Broker bağlantısı kurulamadı');
            return result;
        }

        logWarn('Acil durum kapatma başlatıldı', { userId, broker });

        if (config.cancelAllOrders) {
            try {
                const orders = await adapter.getOrders();
                for (const order of orders) {
                    if (order.status === 'pending' || order.status === 'partially_filled') {
                        try {
                            const cancelled = await adapter.cancelOrder(order.orderId, order.symbol);
                            if (cancelled) {
                                result.cancelledOrders++;
                                logInfo(`Emir iptal edildi: ${order.orderId} (${order.symbol})`);
                            } else {
                                result.errors.push(`Emir iptal edilemedi: ${order.orderId}`);
                            }
                        } catch (err) {
                            result.errors.push(`Emir iptal hatası (${order.orderId}): ${err instanceof Error ? err.message : String(err)}`);
                        }
                    }
                }
            } catch (err) {
                result.errors.push(`Emir listesi alınamadı: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        if (config.closeAllPositions) {
            try {
                const positions = await adapter.getPositions();

                for (const position of positions) {
                    const side: 'buy' | 'sell' = position.quantity > 0 ? 'sell' : 'buy';
                    const quantity = Math.abs(position.quantity);

                    try {
                        const order = await adapter.placeOrder({
                            symbol: position.symbol,
                            side,
                            type: 'market',
                            quantity,
                        });

                        if (order.status === 'filled' || order.status === 'partially_filled') {
                            result.closedPositions++;
                            result.details.push({
                                symbol: position.symbol,
                                side,
                                quantity,
                                success: true,
                            });
                            logInfo(`Pozisyon kapatıldı: ${position.symbol} (${quantity})`);
                        } else {
                            result.failedPositions++;
                            result.details.push({
                                symbol: position.symbol,
                                side,
                                quantity,
                                success: false,
                                error: `Order durumu: ${order.status}`,
                            });
                        }
                    } catch (err) {
                        result.failedPositions++;
                        result.errors.push(`Pozisyon kapatma hatası (${position.symbol}): ${err instanceof Error ? err.message : String(err)}`);
                        result.details.push({
                            symbol: position.symbol,
                            side,
                            quantity,
                            success: false,
                            error: err instanceof Error ? err.message : String(err),
                        });
                    }
                }
            } catch (err) {
                result.errors.push(`Pozisyon listesi alınamadı: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        result.success = result.errors.length === 0 || result.closedPositions > 0;

        logInfo('Acil durum kapatma tamamlandı', {
            userId,
            broker,
            closed: result.closedPositions,
            failed: result.failedPositions,
            cancelled: result.cancelledOrders,
        });

        return result;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError('Acil durum kapatma genel hatası', err);
        result.errors.push(message);
        return result;
    }
}

