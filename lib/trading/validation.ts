/**
 * Order Validation - Emirlerin broker'a gitmeden önce doğrulanması.
 * Lot size, min notional, fiyat hassasiyeti ve zorunlu stop-loss kontrolleri.
 */

export interface ValidationResult {
    valid: boolean;
    reason?: string;
    adjustedQuantity?: number;
    adjustedPrice?: number;
}

/**
 * Bir emir için zorunlu stop-loss kontrolü.
 * Canlı trading'de tüm buy emirlerinde koruyucu stop-loss zorunludur.
 */
export function validateStopLossRequired(
    side: 'buy' | 'sell',
    stopPrice?: number,
    isLive: boolean = false
): ValidationResult {
    if (isLive && side === 'buy' && (!stopPrice || stopPrice <= 0)) {
        return {
            valid: false,
            reason: 'Canlı tradingde alış emirleri için koruyucu stop-loss (stopPrice) zorunludur',
        };
    }
    return { valid: true };
}

/**
 * Min notional kontrolü (broker'a özel minimum işlem değeri).
 * Binance: genellikle 5 USDT, Alpaca: yok (fractional izin verilir).
 */
export function validateMinNotional(
    notional: number,
    broker: 'alpaca' | 'binance',
    isLive: boolean
): ValidationResult {
    if (!isLive) return { valid: true };

    const minNotional = broker === 'binance' ? 5 : 0; // Binance spot min ~5 USDT
    if (notional < minNotional) {
        return {
            valid: false,
            reason: `İşlem değeri ($${notional.toFixed(2)}) minimum notional sınırının ($${minNotional.toFixed(2)}) altında`,
        };
    }
    return { valid: true };
}

/**
 * Miktarı lot büyüklüğine yuvarlar (Binance LOT_SIZE filtresi için).
 * stepSize ile bölüp tekrar çarparak geçerli bir miktar üretir.
 */
export function roundToStepSize(quantity: number, stepSize: number): number {
    if (!stepSize || stepSize <= 0) return quantity;
    return Math.floor(quantity / stepSize) * stepSize;
}

/**
 * Fiyatı tick size'a yuvarlar (price filter).
 */
export function roundToTickSize(price: number, tickSize: number): number {
    if (!tickSize || tickSize <= 0) return price;
    return Math.floor(price / tickSize) * tickSize;
}

