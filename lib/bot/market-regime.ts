/**
 * Piyasa Rejimi Tespiti Modülü
 *
 * Algoritmic trading'de strateji seçimi için kritik olan piyasa rejimi:
 * - TREND: Fiyat net bir yönde hareket ediyor (SMA eğimi etkili)
 * - RANGE: Fiyat yatay hareket ediyor (RSI, mean reversion etkili)
 * - VOLATILE: Yüksek volatilite, geniş aralıklar
 * - QUIET: Düşük volatilite, dar aralıklar
 *
 * Bu sayede bot, pişama rejimine göre stratejiyi değiştirebilir.
 */

export type MarketRegime = 'TREND' | 'RANGE' | 'VOLATILE' | 'QUIET' | 'UNKNOWN';

export interface RegimeDetectionConfig {
    adxPeriod: number;
    adxTrendThreshold: number;
    adxRangeThreshold: number;
    atrPercentThreshold: number;
    smaPeriod: number;
}

export interface RegimeResult {
    regime: MarketRegime;
    confidence: number;
    adx?: number;
    atrPercent?: number;
    smaSlope?: number;
    reason: string;
}

export const DEFAULT_REGIME_CONFIG: RegimeDetectionConfig = {
    adxPeriod: 14,
    adxTrendThreshold: 25,
    adxRangeThreshold: 20,
    atrPercentThreshold: 3.0,
    smaPeriod: 20,
};

function calculateATR(candles: { high: number; low: number; close: number }[], period: number): number {
    if (candles.length < period + 1) return 0;

    let trSum = 0;
    for (let i = 1; i <= period; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        trSum += tr;
    }

    return trSum / period;
}

function calculateADX(candles: { high: number; low: number; close: number }[], period: number): number {
    if (candles.length < period * 2) return 0;

    let plusDM = 0;
    let minusDM = 0;
    let trSum = 0;

    for (let i = 1; i <= period; i++) {
        const upMove = candles[i].high - candles[i - 1].high;
        const downMove = candles[i - 1].low - candles[i].low;

        if (upMove > downMove && upMove > 0) plusDM += upMove;
        if (downMove > upMove && downMove > 0) minusDM += downMove;

        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trSum += tr;
    }

    const atr = trSum / period;
    if (atr === 0) return 0;

    const plusDI = (plusDM / atr) * 100;
    const minusDI = (minusDM / atr) * 100;
    const dx = (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100;

    return dx;
}

function calculateSMASlope(candles: { close: number }[], period: number): number {
    if (candles.length < period + 1) return 0;

    const recent = candles.slice(candles.length - period).map(c => c.close);
    const previous = candles.slice(candles.length - period - 1, -1).map(c => c.close);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / period;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / period;

    return ((recentAvg - previousAvg) / previousAvg) * 100;
}

export function detectMarketRegime({
    candles,
    config = DEFAULT_REGIME_CONFIG,
}: {
    candles: { high: number; low: number; close: number }[];
    config?: RegimeDetectionConfig;
}): RegimeResult {
    if (candles.length < config.smaPeriod + 5) {
        return {
            regime: 'UNKNOWN',
            confidence: 0,
            reason: 'Yeterli mum verisi yok',
        };
    }

    const adx = calculateADX(candles, config.adxPeriod);
    const atr = calculateATR(candles, config.adxPeriod);
    const lastClose = candles[candles.length - 1].close;
    const atrPercent = lastClose > 0 ? (atr / lastClose) * 100 : 0;
    const smaSlope = calculateSMASlope(candles, config.smaPeriod);

    let regime: MarketRegime = 'UNKNOWN';
    let confidence = 0;
    let reason = '';

    if (atrPercent > config.atrPercentThreshold) {
        regime = 'VOLATILE';
        confidence = Math.min(0.9, atrPercent / 10);
        reason = `Yüksek volatilite: ATR %${atrPercent.toFixed(1)}`;
    }
    else if (adx > config.adxTrendThreshold && Math.abs(smaSlope) > 0.1) {
        regime = 'TREND';
        confidence = Math.min(0.9, adx / 50);
        reason = `Trend: ADX ${adx.toFixed(1)}, SMA eğimi %${smaSlope.toFixed(2)}`;
    }
    else if (adx < config.adxRangeThreshold && atrPercent <= config.atrPercentThreshold) {
        regime = 'RANGE';
        confidence = Math.min(0.9, (config.adxRangeThreshold - adx) / config.adxRangeThreshold + 0.3);
        reason = `Range: ADX ${adx.toFixed(1)}, düşük volatilite`;
    }
    else {
        regime = 'QUIET';
        confidence = 0.6;
        reason = `Sessiz piyasa: ADX ${adx.toFixed(1)}, ATR %${atrPercent.toFixed(1)}`;
    }

    return { regime, confidence, adx, atrPercent, smaSlope, reason };
}

export function recommendStrategyForRegime(regime: MarketRegime): string[] {
    switch (regime) {
        case 'TREND':
            return ['sma_cross', 'macd_cross'];
        case 'RANGE':
            return ['rsi_oversold', 'price_threshold'];
        case 'VOLATILE':
            return ['price_threshold'];
        case 'QUIET':
            return ['rsi_oversold'];
        default:
            return ['sma_cross', 'rsi_oversold'];
    }
}

