/**
 * Trailing Stop-Loss ve Break-Even Modülü
 *
 * Profesyonel trading'de kritik olan koruyucu emirler:
 * - Trailing Stop-Loss: Fiyat Kunstuğunda stop'u yukarı kaydırır (long için)
 * - Break-Even Stop: Kar一定 seviyesine ulaştığında stop'u giriş fiyatına taşır
 * - Trailing Take Profit: Kar hedefini dinamik olarak artırır
 */

export interface TrailingStopConfig {
    trailingPercent: number;       // % cinsinden trailing mesafe
    trailingActivationPercent: number; // Trailing'ı aktive eden kar yüzdesi
    breakEvenPercent: number;      // Break-even'e geçiş kar yüzdesi
    breakEvenOffsetPercent: number; // Break-even'de girişten kaç % fazla koruma
    trailingTakeProfitPercent: number; // Trailing take profit yüzdesi
}

export interface TrailingStopState {
    activated: boolean;
    highestPrice: number;          // Long için görülen en yüksek fiyat
    currentStopPrice: number;      // Güncel stop fiyatı
    breakEvenApplied: boolean;     // Break-even uygulandı mı?
    takeProfitTarget?: number;     // Take profit hedefi
    trailingTakeProfitActivated: boolean;
}

export const DEFAULT_TRAILING_CONFIG: TrailingStopConfig = {
    trailingPercent: 2.0,           // %2 trailing mesafe
    trailingActivationPercent: 1.0, // %1 kar után trailing aktif
    breakEvenPercent: 1.0,          // %1 kar sonrası break-even
    breakEvenOffsetPercent: 0.1,    // %0.1 offset (küçük kar koruması)
    trailingTakeProfitPercent: 3.0, // %3 trailing take profit
};

/**
 * Trailing stop-loss hesaplaması (Long pozisyon için).
 * Fiyat yükseldikçe stop da yukarı kayar, düşüşte sabit kalır.
 */
export function updateTrailingStop({
    config,
    state,
    currentPrice,
    entryPrice,
}: {
    config: TrailingStopConfig;
    state: TrailingStopState;
    currentPrice: number;
    entryPrice: number;
}): TrailingStopState {
    const newState = { ...state };

    // En yüksek fiyatı güncelle
    if (currentPrice > newState.highestPrice) {
        newState.highestPrice = currentPrice;
    }

    // Trailing aktivasyon kontrolü
    const currentGainPercent = ((currentPrice - entryPrice) / entryPrice) * 100;

    if (!newState.activated && currentGainPercent >= config.trailingActivationPercent) {
        newState.activated = true;
        newState.currentStopPrice = entryPrice * (1 - config.trailingPercent / 100);
    }

    // Break-even kontrolü
    if (!newState.breakEvenApplied && currentGainPercent >= config.breakEvenPercent) {
        newState.breakEvenApplied = true;
        newState.currentStopPrice = entryPrice * (1 + config.breakEvenOffsetPercent / 100);
    }

    // Trailing stop'u güncelle (sadece yukarı doğru hareket eder)
    if (newState.activated) {
        const trailingStop = newState.highestPrice * (1 - config.trailingPercent / 100);
        // Stop sadece yukarı doğru hareket etsin (düşüşte sabit)
        if (trailingStop > newState.currentStopPrice) {
            newState.currentStopPrice = trailingStop;
        }
    }

    // Break-even uygulandıysa ve trailing daha yüksekse trailing'e geç
    if (newState.breakEvenApplied && newState.activated) {
        newState.currentStopPrice = Math.max(
            newState.currentStopPrice,
            newState.highestPrice * (1 - config.trailingPercent / 100)
        );
    }

    return newState;
}

/**
 * Trailing stop'a göre satış sinyali kontrolü.
 */
export function checkTrailingStopHit({
    state,
    currentPrice,
}: {
    state: TrailingStopState;
    currentPrice: number;
}): { hit: boolean; stopPrice: number; reason?: string } {
    if (currentPrice <= state.currentStopPrice) {
        return {
            hit: true,
            stopPrice: state.currentStopPrice,
            reason: state.breakEvenApplied
                ? `Break-even stop tetiklendi ($${state.currentStopPrice.toFixed(2)})`
                : `Trailing stop tetiklendi ($${state.currentStopPrice.toFixed(2)})`,
        };
    }
    return { hit: false, stopPrice: state.currentStopPrice };
}

/**
 * Trailing Take Profit hesaplaması.
 * Fiyat yükseldikçe take profit hedefi de yukarı kayar.
 */
export function updateTrailingTakeProfit({
    config,
    state,
    currentPrice,
    entryPrice,
}: {
    config: TrailingStopConfig;
    state: TrailingStopState;
    currentPrice: number;
    entryPrice: number;
}): TrailingStopState {
    const newState = { ...state };

    if (!newState.trailingTakeProfitActivated) {
        const gainPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
        if (gainPercent >= config.trailingActivationPercent) {
            newState.trailingTakeProfitActivated = true;
            newState.takeProfitTarget = currentPrice * (1 + config.trailingTakeProfitPercent / 100);
        }
    } else if (newState.takeProfitTarget) {
        const newTarget = currentPrice * (1 + config.trailingTakeProfitPercent / 100);
        // Take profit hedefi sadece yukarı hareket eder
        if (newTarget > newState.takeProfitTarget) {
            newState.takeProfitTarget = newTarget;
        }
    }

    return newState;
}

/**
 * Trailing take profit hedefine ulaşılıp ulaşılmadığını kontrol eder.
 */
export function checkTrailingTakeProfitHit({
    state,
    currentPrice,
}: {
    state: TrailingStopState;
    currentPrice: number;
}): { hit: boolean; targetPrice?: number } {
    if (state.trailingTakeProfitActivated && state.takeProfitTarget && currentPrice >= state.takeProfitTarget) {
        return { hit: true, targetPrice: state.takeProfitTarget };
    }
    return { hit: false };
}

/**
 * Yeni trailing stop state'i oluşturur.
 */
export function createTrailingStopState(entryPrice: number): TrailingStopState {
    return {
        activated: false,
        highestPrice: entryPrice,
        currentStopPrice: entryPrice,
        breakEvenApplied: false,
        trailingTakeProfitActivated: false,
    };
}

