/**
 * Order Validation Modülü
 *
 * Gerçek para işlemleri için kritik girdi doğrulama:
 * - Sembol validasyonu (injection koruması)
 * - Miktar ve fiyat doğrulama
 * - Order type validasyonu
 * - Side validasyonu
 * - MongoDB injection koruması
 * - XSS koruması
 */

import { z } from 'zod';

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
export type OrderStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'expired';

export const OrderSchema = z.object({
    symbol: z.string()
        .min(1, 'Sembol gereklidir')
        .max(20, 'Sembol en fazla 20 karakter olabilir')
        .regex(/^[A-Z0-9.\-]{1,20}$/, 'Geçersiz sembol formatı'),
    side: z.enum(['buy', 'sell'] as const, 'side buy veya sell olmalıdır'),
    type: z.enum(['market', 'limit', 'stop', 'stop_limit'] as const, 'Geçersiz order type'),
    quantity: z.number()
        .positive('Miktar sıfırdan büyük olmalıdır')
        .finite('Miktar geçerli bir sayı olmalıdır')
        .max(1_000_000, 'Miktar çok büyük'),
    limitPrice: z.number().positive().finite().optional(),
    stopPrice: z.number().positive().finite().optional(),
    clientOrderId: z.string().min(1).max(64).optional(),
});

export function validateSymbol(symbol: string): { valid: boolean; reason?: string } {
    if (!symbol || typeof symbol !== 'string') {
        return { valid: false, reason: 'Sembol gereklidir' };
    }

    const trimmed = symbol.trim().toUpperCase();

    if (trimmed.length < 1 || trimmed.length > 20) {
        return { valid: false, reason: 'Sembol uzunluğu 1-20 karakter arası olmalıdır' };
    }

    if (!/^[A-Z0-9.\-]+$/.test(trimmed)) {
        return { valid: false, reason: 'Sembol sadece harf, rakam, nokta ve tire içerebilir' };
    }

    const dangerousChars = [';', '--', '/*', '*/', '${', '}', '<', '>', '"', "'", '`'];
    for (const char of dangerousChars) {
        if (trimmed.includes(char)) {
            return { valid: false, reason: 'Sembol içinde izin verilmeyen karakter var' };
        }
    }

    return { valid: true };
}

/**
 * Miktar validasyonu
 */
export function validateQuantity(quantity: unknown): { valid: boolean; value?: number; reason?: string } {
    if (quantity === undefined || quantity === null) {
        return { valid: false, reason: 'Miktar gereklidir' };
    }

    const num = Number(quantity);
    if (!Number.isFinite(num)) {
        return { valid: false, reason: 'Miktar geçerli bir sayı olmalıdır' };
    }

    if (num <= 0) {
        return { valid: false, reason: 'Miktar sıfırdan büyük olmalıdır' };
    }

    if (num > 1_000_000) {
        return { valid: false, reason: 'Miktar çok büyük (maksimum 1.000.000)' };
    }

    return { valid: true, value: Math.round(num * 1e8) / 1e8 };
}

/**
 * Fiyat validasyonu
 */
export function validatePrice(price: unknown, fieldName: string = 'Fiyat'): { valid: boolean; value?: number; reason?: string } {
    if (price === undefined || price === null) {
        return { valid: false, reason: `${fieldName} gereklidir` };
    }

    const num = Number(price);
    if (!Number.isFinite(num)) {
        return { valid: false, reason: `${fieldName} geçerli bir sayı olmalıdır` };
    }

    if (num <= 0) {
        return { valid: false, reason: `${fieldName} sıfırdan büyük olmalıdır` };
    }

    if (num > 1_000_000_000) {
        return { valid: false, reason: `${fieldName} çok büyük` };
    }

    return { valid: true, value: Math.round(num * 1e8) / 1e8 };
}

/**
 * Order tip ve fiyat uyuşmazlık kontrolü
 */
export function validateOrderTypeAndPrices(
    type: OrderType,
    limitPrice?: number,
    stopPrice?: number
): { valid: boolean; reason?: string } {
    if (type === 'limit' || type === 'stop_limit') {
        if (!limitPrice || limitPrice <= 0) {
            return { valid: false, reason: `${type} order için limitPrice gereklidir` };
        }
    }

    if (type === 'stop' || type === 'stop_limit') {
        if (!stopPrice || stopPrice <= 0) {
            return { valid: false, reason: `${type} order için stopPrice gereklidir` };
        }
    }

    if (limitPrice && stopPrice && limitPrice === stopPrice) {
        return { valid: false, reason: 'limitPrice ve stopPrice aynı olamaz' };
    }

    return { valid: true };
}

/**
 * Order durumu geçiş validasyonu
 */
export function validateStatusTransition(
    currentStatus: OrderStatus,
    newStatus: OrderStatus
): { valid: boolean; reason?: string } {
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
        pending: ['filled', 'partially_filled', 'cancelled', 'rejected', 'expired'],
        partially_filled: ['filled', 'cancelled', 'expired'],
        filled: [],
        cancelled: [],
        rejected: [],
        expired: [],
    };

    const allowed = allowedTransitions[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
        return {
            valid: false,
            reason: `${currentStatus} durumundan ${newStatus} durumuna geçiş yapılamaz`,
        };
    }

    return { valid: true };
}

/**
 * Order oluşturma verisini doğrula ve temizle
 */
export function validateAndSanitizeOrder(body: unknown): {
    valid: boolean;
    data?: {
        symbol: string;
        side: OrderSide;
        type: OrderType;
        quantity: number;
        limitPrice?: number;
        stopPrice?: number;
        clientOrderId?: string;
    };
    reason?: string;
} {
    try {
        const input = body as any;
        // Sembolü önce büyük harfe çevir
        if (input.symbol && typeof input.symbol === 'string') {
            input.symbol = input.symbol.trim().toUpperCase();
        }

        const parsed = OrderSchema.parse(input);

        const symbolCheck = validateSymbol(parsed.symbol);
        if (!symbolCheck.valid) {
            return { valid: false, reason: symbolCheck.reason };
        }

        const quantityCheck = validateQuantity(parsed.quantity);
        if (!quantityCheck.valid) {
            return { valid: false, reason: quantityCheck.reason };
        }

        if (parsed.limitPrice !== undefined) {
            const limitPriceCheck = validatePrice(parsed.limitPrice, 'limitPrice');
            if (!limitPriceCheck.valid) {
                return { valid: false, reason: limitPriceCheck.reason };
            }
        }

        if (parsed.stopPrice !== undefined) {
            const stopPriceCheck = validatePrice(parsed.stopPrice, 'stopPrice');
            if (!stopPriceCheck.valid) {
                return { valid: false, reason: stopPriceCheck.reason };
            }
        }

        const typePriceCheck = validateOrderTypeAndPrices(
            parsed.type,
            parsed.limitPrice,
            parsed.stopPrice
        );
        if (!typePriceCheck.valid) {
            return { valid: false, reason: typePriceCheck.reason };
        }

        return {
            valid: true,
            data: {
                symbol: parsed.symbol,
                side: parsed.side,
                type: parsed.type,
                quantity: quantityCheck.value!,
                limitPrice: parsed.limitPrice,
                stopPrice: parsed.stopPrice,
                clientOrderId: parsed.clientOrderId,
            },
        };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const issues = (err as any).issues || (err as any).errors || [];
            return {
                valid: false,
                reason: issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', '),
            };
        }
        return { valid: false, reason: 'Geçersiz order verisi' };
    }
}

