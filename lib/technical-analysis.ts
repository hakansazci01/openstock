/**
 * Professional Technical Analysis Library for OpenStock
 * RSI, MACD, Bollinger Bands, SMA/EMA, Stochastic, ATR, Volume, Support/Resistance
 */

export type OHLCV = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

export type SignalType = 'AL' | 'SAT' | 'BEKLE';

export type IndicatorResult = {
    name: string;
    value: number | null;
    signal: SignalType;
    strength: number;
    reason: string;
};

export type TechnicalAnalysis = {
    symbol: string;
    currentPrice: number;
    signal: SignalType;
    confidence: number;
    score: number;
    indicators: IndicatorResult[];
    support: number | null;
    resistance: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    prediction: {
        shortTerm: SignalType;
        mediumTerm: SignalType;
        longTerm: SignalType;
        predictedPrice: number | null;
        predictedChangePercent: number | null;
    };
    timestamp: number;
};

export function calculateRSI(prices: number[], period = 14): number | null {
    if (!prices || prices.length < period + 1) return null;
    let gains = 0; let losses = 0;
    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change; else losses += Math.abs(change);
    }
    let avgGain = gains / period; let avgLoss = losses / period;
    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
}

function calculateEMA(prices: number[], period: number): number[] {
    if (!prices || prices.length === 0) return [];
    const k = 2 / (period + 1);
    const ema: number[] = [prices[0]];
    for (let i = 1; i < prices.length; i++) {
        ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
}

export function calculateMACD(prices: number[]) {
    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macdLine = ema12.map((v, i) => v - (ema26[i] ?? 0));
    const signalLine = calculateEMA(macdLine, 9);
    const histogram = macdLine.map((v, i) => v - (signalLine[i] ?? 0));
    return { macdLine, signalLine, histogram };
}

export function calculateBollingerBands(prices: number[], period = 20, stdDev = 2) {
    if (!prices || prices.length < period) return null;
    const bands = [];
    for (let i = period - 1; i < prices.length; i++) {
        const window = prices.slice(i - period + 1, i + 1);
        const sma = window.reduce((a, b) => a + b, 0) / period;
        const variance = window.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
        const sd = Math.sqrt(variance);
        bands.push({ middle: sma, upper: sma + stdDev * sd, lower: sma - stdDev * sd });
    }
    return bands;
}

export function calculateSMA(prices: number[], period: number): number[] {
    if (!prices || prices.length < period) return [];
    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const window = prices.slice(i - period + 1, i + 1);
        sma.push(window.reduce((a, b) => a + b, 0) / period);
    }
    return sma;
}

export function calculateStochastic(data: OHLCV[], kPeriod = 14, dPeriod = 3) {
    if (!data || data.length < kPeriod) return null;
    const result = [];
    for (let i = kPeriod - 1; i < data.length; i++) {
        const window = data.slice(i - kPeriod + 1, i + 1);
        const lowestLow = Math.min(...window.map((d) => d.low));
        const highestHigh = Math.max(...window.map((d) => d.high));
        const close = data[i].close;
        let k = 0;
        if (highestHigh !== lowestLow) k = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
        result.push({ k, d: null as number | null });
    }
    const kValues = result.map((r) => r.k);
    const dValues = calculateSMA(kValues, dPeriod);
    for (let i = 0; i < result.length; i++) { if (dValues[i] !== undefined) result[i].d = dValues[i]; }
    return result;
}

export function calculateATR(data: OHLCV[], period = 14): number | null {
    if (!data || data.length < period + 1) return null;
    const tr: number[] = [];
    for (let i = 1; i < data.length; i++) {
        const high = data[i].high; const low = data[i].low; const prevClose = data[i - 1].close;
        tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
    }
    let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < tr.length; i++) { atr = (atr * (period - 1) + tr[i]) / period; }
    return atr;
}

export function detectSupportResistance(data: OHLCV[], lookback = 20) {
    if (!data || data.length < lookback * 2) return { support: null, resistance: null };
    const recent = data.slice(-lookback);
    return { support: Math.min(...recent.map((d) => d.low)), resistance: Math.max(...recent.map((d) => d.high)) };
}

export function analyzeVolume(data: OHLCV[]) {
    if (!data || data.length < 20) return null;
    const recent = data.slice(-20);
    const currentVolume = data[data.length - 1].volume;
    const avgVolume = recent.reduce((sum, d) => sum + d.volume, 0) / recent.length;
    return { currentVolume, avgVolume, volumeRatio: avgVolume > 0 ? currentVolume / avgVolume : 1, isHighVolume: currentVolume > avgVolume * 1.5 };
}

export function calculateProfessionalSignal(data: OHLCV[], currentPrice: number): TechnicalAnalysis {
    const prices = data.map((d) => d.close);
    const indicators: IndicatorResult[] = [];
    let score = 0; let totalWeight = 0;

    const rsi = calculateRSI(prices, 14);
    let rsiSignal: SignalType = 'BEKLE'; let rsiStrength = 0; let rsiReason = 'RSI verisi yetersiz';
    if (rsi !== null) {
        if (rsi <= 30) { rsiSignal = 'AL'; rsiStrength = 80; rsiReason = `RSI ${rsi.toFixed(1)} - asiri satim (AL)`; score += 20; }
        else if (rsi <= 40) { rsiSignal = 'AL'; rsiStrength = 50; rsiReason = `RSI ${rsi.toFixed(1)} - dusuk (AL)`; score += 10; }
        else if (rsi >= 70) { rsiSignal = 'SAT'; rsiStrength = 80; rsiReason = `RSI ${rsi.toFixed(1)} - asiri alim (SAT)`; score -= 20; }
        else if (rsi >= 60) { rsiSignal = 'SAT'; rsiStrength = 50; rsiReason = `RSI ${rsi.toFixed(1)} - yuksek (SAT)`; score -= 10; }
        else { rsiReason = `RSI ${rsi.toFixed(1)} - notr`; }
        totalWeight += 20;
    }
    indicators.push({ name: 'RSI (14)', value: rsi, signal: rsiSignal, strength: rsiStrength, reason: rsiReason });

    const macd = calculateMACD(prices);
    const cMACD = macd.macdLine[macd.macdLine.length - 1];
    const cSignal = macd.signalLine[macd.signalLine.length - 1];
    const cHist = macd.histogram[macd.histogram.length - 1];
    const pHist = macd.histogram[macd.histogram.length - 2];
    let macdSignal: SignalType = 'BEKLE'; let macdStrength = 0; let macdReason = 'MACD verisi yetersiz';
    if (cMACD !== undefined && cSignal !== undefined) {
        if (cMACD > cSignal && cHist > 0) {
            macdSignal = 'AL'; macdStrength = cHist > pHist ? 80 : 60;
            macdReason = `MACD pozitif ve sinyal cizgisi uzeri (AL)`; score += 20;
        } else if (cMACD < cSignal && cHist < 0) {
            macdSignal = 'SAT'; macdStrength = cHist < pHist ? 80 : 60;
            macdReason = `MACD negatif ve sinyal cizgisialti (SAT)`; score -= 20;
        } else { macdReason = `MACD notr`; }
        totalWeight += 20;
    }
    indicators.push({ name: 'MACD', value: cHist, signal: macdSignal, strength: macdStrength, reason: macdReason });

    const bb = calculateBollingerBands(prices, 20, 2);
    const currentBB = bb ? bb[bb.length - 1] : null;
    let bbSignal: SignalType = 'BEKLE'; let bbStrength = 0; let bbReason = 'Bollinger verisi yetersiz';
    if (currentBB) {
        const position = (currentPrice - currentBB.lower) / (currentBB.upper - currentBB.lower);
        if (position <= 0.2) { bbSignal = 'AL'; bbStrength = 70; bbReason = `Fiyat alt banda yakin (AL)`; score += 15; }
        else if (position >= 0.8) { bbSignal = 'SAT'; bbStrength = 70; bbReason = `Fiyat ust banda yakin (SAT)`; score -= 15; }
        else { bbReason = `Fiyat bantlar icinde`; }
        totalWeight += 15;
    }
    indicators.push({ name: 'Bollinger Bands', value: currentBB ? (currentPrice - currentBB.lower) / (currentBB.upper - currentBB.lower) : null, signal: bbSignal, strength: bbStrength, reason: bbReason });

    const sma20 = calculateSMA(prices, 20); const sma50 = calculateSMA(prices, 50);
    const curSMA20 = sma20[sma20.length - 1]; const curSMA50 = sma50[sma50.length - 1];
    let smaSignal: SignalType = 'BEKLE'; let smaStrength = 0; let smaReason = 'SMA verisi yetersiz';
    if (curSMA20 !== undefined && curSMA50 !== undefined) {
        if (currentPrice > curSMA20 && curSMA20 > curSMA50) { smaSignal = 'AL'; smaStrength = 70; smaReason = `Fiyat SMA20 uzeri, SMA20 > SMA50 (AL)`; score += 15; }
        else if (currentPrice < curSMA20 && curSMA20 < curSMA50) { smaSignal = 'SAT'; smaStrength = 70; smaReason = `Fiyat SMA20 altı, SMA20 < SMA50 (SAT)`; score -= 15; }
        else { smaReason = `SMA trend karisik`; }
        totalWeight += 15;
    }
    indicators.push({ name: 'SMA (20/50)', value: curSMA20, signal: smaSignal, strength: smaStrength, reason: smaReason });

    const stoch = calculateStochastic(data, 14, 3);
    const curStoch = stoch ? stoch[stoch.length - 1] : null;
    let stochSignal: SignalType = 'BEKLE'; let stochStrength = 0; let stochReason = 'Stokastik verisi yetersiz';
    if (curStoch) {
        if (curStoch.k <= 20 && curStoch.d !== null && curStoch.d <= 20) { stochSignal = 'AL'; stochStrength = 70; stochReason = `Stokastik asiri satim (AL)`; score += 15; }
        else if (curStoch.k >= 80 && curStoch.d !== null && curStoch.d >= 80) { stochSignal = 'SAT'; stochStrength = 70; stochReason = `Stokastik asiri alim (SAT)`; score -= 15; }
        else { stochReason = `Stokastik notr`; }
        totalWeight += 15;
    }
    indicators.push({ name: 'Stokastik (14,3)', value: curStoch?.k ?? null, signal: stochSignal, strength: stochStrength, reason: stochReason });

    const vol = analyzeVolume(data);
    let volSignal: SignalType = 'BEKLE'; let volStrength = 0; let volReason = 'Hacim verisi yetersiz';
    if (vol) {
        if (vol.isHighVolume) {
            if (score > 0) { volSignal = 'AL'; volStrength = 60; volReason = `Yuksek hacimle AL gucu`; score += 10; }
            else if (score < 0) { volSignal = 'SAT'; volStrength = 60; volReason = `Yuksek hacimle SAT gucu`; score -= 10; }
            else { volReason = `Yuksek hacim, yon belirsiz`; }
        } else { volReason = `Hacim normale yakin`; }
        totalWeight += 10;
    }
    indicators.push({ name: 'Hacim Analizi', value: vol?.volumeRatio ?? null, signal: volSignal, strength: volStrength, reason: volReason });

    const confidence = totalWeight > 0 ? Math.min(100, Math.abs(score) / totalWeight * 100) : 0;
    let signal: SignalType = 'BEKLE';
    if (score >= 25) signal = 'AL';
    else if (score <= -25) signal = 'SAT';

    const sr = detectSupportResistance(data);
    const atr = calculateATR(data);
    let stopLoss: number | null = null; let takeProfit: number | null = null;
    if (atr) {
        if (signal === 'AL') { stopLoss = currentPrice - atr * 2; takeProfit = currentPrice + atr * 3; }
        else if (signal === 'SAT') { stopLoss = currentPrice + atr * 2; takeProfit = currentPrice - atr * 3; }
    }

    const pred = generatePrediction(data, currentPrice, score, confidence);

    return {
        symbol: '', currentPrice, signal, confidence,
        score: totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0,
        indicators, support: sr.support, resistance: sr.resistance,
        stopLoss, takeProfit, prediction: pred, timestamp: Date.now(),
    };
}

function generatePrediction(data: OHLCV[], currentPrice: number, score: number, confidence: number) {
    const prices = data.map((d) => d.close);
    const sma20 = calculateSMA(prices, 20);
    const curSMA20 = sma20[sma20.length - 1];
    let shortTerm: SignalType = 'BEKLE';
    if (score >= 15) shortTerm = 'AL'; else if (score <= -15) shortTerm = 'SAT';
    let mediumTerm: SignalType = 'BEKLE';
    if (currentPrice > curSMA20 && score > 0) mediumTerm = 'AL';
    else if (currentPrice < curSMA20 && score < 0) mediumTerm = 'SAT';
    let longTerm: SignalType = 'BEKLE';
    if (score >= 30) longTerm = 'AL'; else if (score <= -30) longTerm = 'SAT';
    const momentum = Math.round((score / 100) * 15 * (confidence / 100) * 10) / 10;
    const predictedPrice = currentPrice * (1 + momentum / 100);
    return {
        shortTerm, mediumTerm, longTerm, predictedPrice,
        predictedChangePercent: Math.round((predictedPrice - currentPrice) / currentPrice * 1000) / 10,
    };
}

export function toOHLCV(rawData: { close: number; high?: number; low?: number; open?: number; volume?: number; timestamp?: number }[]): OHLCV[] {
    return rawData.map((d, i) => ({
        timestamp: d.timestamp ?? Date.now() - (rawData.length - 1 - i) * 86400000,
        open: d.open ?? d.close, high: d.high ?? d.close, low: d.low ?? d.close,
        close: d.close, volume: d.volume ?? 0,
    }));
}
