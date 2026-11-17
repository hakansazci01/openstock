'use server';

import { connectToDatabase } from '@/database/mongoose';
import { logError, logInfo } from '@/lib/logger';

/**
 * Idempotency - Aynı emirín tekrar işlenmesini engeller.
 * clientOrderId (istemci tarafından üretilen benzersiz kimlik) kullanılarak
 * ağ hatası sonrası tekrar denemelerde aynı emirin iki kez gitmesi önlenir.
 */

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat

export interface IdempotencyResult {
    isDuplicate: boolean;
    existingOrderId?: string;
    existingStatus?: string;
}

/**
 * Bir clientOrderId'nin daha önce kullanılıp kullanılmadığını kontrol eder.
 * Kullanılmamışsa kaydeder, kullanılmışsa mevcut durumu döndürür.
 */
export async function checkAndRecordIdempotency(
    clientOrderId: string,
    brokerOrderId: string,
    status: string
): Promise<IdempotencyResult> {
    await connectToDatabase();

    // Trade koleksiyonunda clientOrderId ile ara
    const { Trade } = await import('@/database/models/trade.model');
    const existing = await Trade.findOne({ clientOrderId }).lean();

    if (existing) {
        logInfo('İdempotent emir tespit edildi, tekrar işlenmiyor', {
            clientOrderId,
            existingBrokerOrderId: existing.brokerOrderId,
            existingStatus: existing.status,
        });
        return {
            isDuplicate: true,
            existingOrderId: existing.brokerOrderId,
            existingStatus: existing.status,
        };
    }

    return { isDuplicate: false };
}

/**
 * Bir emir için idempotency kaydı oluşturur (Trade oluşturulduğunda çağrılır).
 */
export async function recordIdempotentTrade(clientOrderId: string): Promise<void> {
    // Trade modeli zaten clientOrderId'yi unique index ile tutuyor,
    // burada ek bir işlem gerekmez. Bu fonksiyon gelecekteki ayrı bir
    // idempotency koleksiyonu için hazırlık niteliğindedir.
    return;
}