/**
 * OpenStock Trading Bot Strateji Motoru
 * Gerçek piyasa verileriyle çalışan algoritmic trading stratejileri
 */

import type { IBot } from '@/database/models/Bot';
import { logError, logInfo, logWarn } from '@/lib/logger';

export type MarketData = {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    high: number;
    low: number;
    open: number;
    prevClose: number;
    volume: number;
    timestamp: Date;
    source: 'finnhub' | 'yahoo';
    targetWeight?: number; // Hedef ağırlık (noktaportfoy.com modeli)
    selectionReason?: string; // Seçimin gerekçesi
};

export type CandleData = {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
};

export type Signal = {
    symbol: string;
    action: 'buy' | 'sell' | 'hold';
    confidence: number;
    price: number;
    reason: string;
    strategy: string;
    timestamp: Date;
};

function calculateSMA(prices: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
    }
    return result;
}

function calculateRSI(prices: number[], period: number = 14): number[] {
    const result: number[] = [];
    if (prices.length < period + 1) return result;

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);

    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 0; i < changes.length; i++) {
        gains.push(changes[i] > 0 ? changes[i] : 0);
        losses.push(changes[i] < 0 ? Math.abs(changes[i]) : 0);
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < gains.length; i++) {
        const rs = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        result.push(rs);
        avgGain = (avgGain * (period - 1) + gains[i]) / period;
        avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    const rs = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    result.push(rs);
    return result;
}

function calculateEMA(prices: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    result.push(ema);
    for (let i = 1; i < prices.length; i++) {
        ema = prices[i] * multiplier + ema * (1 - multiplier);
        result.push(ema);
    }
    return result;
}

function extractClosePrices(candles: CandleData[]): number[] {
    return candles.map((c) => c.close);
}

function calculateMACD(prices: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    const emaFast = calculateEMA(prices, fastPeriod);
    const emaSlow = calculateEMA(prices, slowPeriod);
    const macdLine: number[] = [];
    const startIndex = emaSlow.length - emaFast.length;
    for (let i = 0; i < emaFast.length; i++) macdLine.push(emaFast[i] - emaSlow[startIndex + i]);
    const signalLine = calculateSMA(macdLine, signalPeriod);
    const histogram: number[] = [];
    const histStart = signalLine.length - macdLine.length;
    for (let i = 0; i < macdLine.length; i++) {
        if (signalLine[histStart + i] !== undefined) histogram.push(macdLine[i] - signalLine[histStart + i]);
    }
    return { macdLine, signalLine, histogram };
}

function marketDataChange(candles: CandleData[]): number {
    if (candles.length < 2) return 0;
    const prev = candles[candles.length - 2].close;
    const curr = candles[candles.length - 1].close;
    return ((curr - prev) / prev) * 100;
}

export function generateSignal(
    bot: IBot,
    marketData: MarketData,
    candles: CandleData[],
    currentPosition: 'long' | 'short' | 'none' = 'none'
): Signal {
    const { strategy, strategyConfig } = bot;
    const symbol = marketData.symbol;
    const price = marketData.price;

    switch (strategy) {
        case 'sma_cross':
            return smaCrossStrategy(symbol, price, candles, currentPosition, strategyConfig);
        case 'rsi_oversold':
            return rsiStrategy(symbol, price, candles, currentPosition, strategyConfig);
        case 'macd_cross':
            return macdStrategy(symbol, price, candles, currentPosition, strategyConfig);
        case 'price_threshold':
            return priceThresholdStrategy(symbol, price, candles, currentPosition, strategyConfig);
        case 'custom':
            return customStrategy(symbol, price, candles, currentPosition, strategyConfig);
        default:
            return {
                symbol, action: 'hold', confidence: 0, price,
                reason: 'Bilinmeyen strateji', strategy, timestamp: new Date(),
            };
    }
}

function smaCrossStrategy(symbol: string, price: number, candles: CandleData[], currentPosition: 'long' | 'short' | 'none', config: Record<string, unknown>): Signal {
    const fastPeriod = Number(config.fastPeriod) || 10;
    const slowPeriod = Number(config.slowPeriod) || 20;

    if (candles.length < slowPeriod + 1) {
        return { symbol, action: 'hold', confidence: 0, price, reason: `Yeterli veri yok (en az ${slowPeriod + 1} mum)`, strategy: 'sma_cross', timestamp: new Date() };
    }

    const closes = extractClosePrices(candles);
    const fastSMA = calculateSMA(closes, fastPeriod);
    const slowSMA = calculateSMA(closes, slowPeriod);

    if (fastSMA.length < 2 || slowSMA.length < 2) {
        return { symbol, action: 'hold', confidence: 0, price, reason: 'SMA hesaplanamadı', strategy: 'sma_cross', timestamp: new Date() };
    }

    const currentFast = fastSMA[fastSMA.length - 1];
    const previousFast = fastSMA[fastSMA.length - 2];
    const currentSlow = slowSMA[slowSMA.length - 1];
    const previousSlow = slowSMA[slowSMA.length - 2];

    if (previousFast <= previousSlow && currentFast > currentSlow && currentPosition !== 'long') {
        const confidence = Math.min(90, 60 + Math.abs(currentFast - currentSlow) / currentSlow * 100);
        return { symbol, action: 'buy', confidence, price, reason: `SMA kesişimi: Hızlı(${fastPeriod}) yavaş(${slowPeriod}) SMA'yı yukarı kesti`, strategy: 'sma_cross', timestamp: new Date() };
    }

    if (previousFast >= previousSlow && currentFast < currentSlow && currentPosition !== 'none') {
        const confidence = Math.min(90, 60 + Math.abs(currentFast - currentSlow) / currentSlow * 100);
        return { symbol, action: 'sell', confidence, price, reason: `SMA kesişimi: Hızlı(${fastPeriod}) yavaş(${slowPeriod}) SMA'yı aşağı kesti`, strategy: 'sma_cross', timestamp: new Date() };
    }

    return { symbol, action: 'hold', confidence: 30, price, reason: `SMA:${Math.round(currentFast * 100)/100} / ${Math.round(currentSlow * 100)/100} - Beklemede`, strategy: 'sma_cross', timestamp: new Date() };
}

function rsiStrategy(symbol: string, price: number, candles: CandleData[], currentPosition: 'long' | 'short' | 'none', config: Record<string, unknown>): Signal {
    const period = Number(config.period) || 14;
    const oversold = Number(config.oversold) || 30;
    const overbought = Number(config.overbought) || 70;

    if (candles.length < period + 2) {
        return { symbol, action: 'hold', confidence: 0, price, reason: `Yeterli veri yok (en az ${period + 2} mum)`, strategy: 'rsi_oversold', timestamp: new Date() };
    }

    const closes = extractClosePrices(candles);
    const rsiValues = calculateRSI(closes, period);

    if (rsiValues.length === 0) {
        return { symbol, action: 'hold', confidence: 0, price, reason: 'RSI hesaplanamadı', strategy: 'rsi_oversold', timestamp: new Date() };
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    const previousRSI = rsiValues[rsiValues.length - 2] ?? currentRSI;

    if (previousRSI <= oversold && currentRSI > oversold && currentPosition !== 'long') {
        const confidence = Math.min(90, 50 + (oversold - Math.min(previousRSI, oversold)) * 2);
        return { symbol, action: 'buy', confidence, price, reason: `RSI:${currentRSI.toFixed(1)} - Aşırı satım(${oversold})'dan yukarı çıkış`, strategy: 'rsi_oversold', timestamp: new Date() };
    }

    if (previousRSI >= overbought && currentRSI < overbought && currentPosition !== 'none') {
        const confidence = Math.min(90, 50 + (Math.max(previousRSI, overbought) - overbought) * 2);
        return { symbol, action: 'sell', confidence, price, reason: `RSI:${currentRSI.toFixed(1)} - Aşırı alım(${overbought})'dan aşağı çıkış`, strategy: 'rsi_oversold', timestamp: new Date() };
    }

    return { symbol, action: 'hold', confidence: 40, price, reason: `RSI:${currentRSI.toFixed(1)} - Nötr`, strategy: 'rsi_oversold', timestamp: new Date() };
}

function macdStrategy(symbol: string, price: number, candles: CandleData[], currentPosition: 'long' | 'short' | 'none', config: Record<string, unknown>): Signal {
    const { macdLine, signalLine } = calculateMACD(
        extractClosePrices(candles),
        Number(config.fastPeriod) || 12,
        Number(config.slowPeriod) || 26,
        Number(config.signalPeriod) || 9
    );

    if (macdLine.length < 2 || signalLine.length < 2) {
        return { symbol, action: 'hold', confidence: 0, price, reason: 'MACD hesaplanamadı', strategy: 'macd_cross', timestamp: new Date() };
    }

    const currentMACD = macdLine[macdLine.length - 1];
    const previousMACD = macdLine[macdLine.length - 2];
    const currentSignal = signalLine[signalLine.length - 1];
    const previousSignal = signalLine[signalLine.length - 2];

    if (previousMACD <= previousSignal && currentMACD > currentSignal && currentPosition !== 'long') {
        const confidence = Math.min(90, 60 + Math.abs(currentMACD - currentSignal) * 100);
        return { symbol, action: 'buy', confidence, price, reason: `MACD:${currentMACD.toFixed(2)} sinyal:${currentSignal.toFixed(2)} - Yukarı kesişim`, strategy: 'macd_cross', timestamp: new Date() };
    }

    if (previousMACD >= previousSignal && currentMACD < currentSignal && currentPosition !== 'none') {
        const confidence = Math.min(90, 60 + Math.abs(currentMACD - currentSignal) * 100);
        return { symbol, action: 'sell', confidence, price, reason: `MACD:${currentMACD.toFixed(2)} sinyal:${currentSignal.toFixed(2)} - Aşağı kesişim`, strategy: 'macd_cross', timestamp: new Date() };
    }

    return { symbol, action: 'hold', confidence: 35, price, reason: `MACD:${currentMACD.toFixed(2)} / Sinyal:${currentSignal.toFixed(2)} - Beklemede`, strategy: 'macd_cross', timestamp: new Date() };
}

function priceThresholdStrategy(symbol: string, price: number, candles: CandleData[], currentPosition: 'long' | 'short' | 'none', config: Record<string, unknown>): Signal {
    const buyThreshold = Number(config.buyThreshold) || 0;
    const sellThreshold = Number(config.sellThreshold) || 0;
    const stopLoss = Number(config.stopLoss) || 0;
    const takeProfit = Number(config.takeProfit) || 0;

    if (currentPosition === 'long' && stopLoss > 0 && price <= stopLoss) {
        return { symbol, action: 'sell', confidence: 100, price, reason: `Stop Loss: ${price} <= ${stopLoss}`, strategy: 'price_threshold', timestamp: new Date() };
    }

    if (currentPosition === 'long' && takeProfit > 0 && price >= takeProfit) {
        return { symbol, action: 'sell', confidence: 100, price, reason: `Take Profit: ${price} >= ${takeProfit}`, strategy: 'price_threshold', timestamp: new Date() };
    }

    if (buyThreshold > 0 && price >= buyThreshold && currentPosition !== 'long') {
        return { symbol, action: 'buy', confidence: 95, price, reason: `Alış eşiği: ${price} >= ${buyThreshold}`, strategy: 'price_threshold', timestamp: new Date() };
    }

    if (sellThreshold > 0 && price <= sellThreshold && currentPosition !== 'none') {
        return { symbol, action: 'sell', confidence: 95, price, reason: `Satış eşiği: ${price} <= ${sellThreshold}`, strategy: 'price_threshold', timestamp: new Date() };
    }

    return { symbol, action: 'hold', confidence: 50, price, reason: `Fiyat:${price} - Eşikler: Alış${buyThreshold} / Satış${sellThreshold}`, strategy: 'price_threshold', timestamp: new Date() };
}

function customStrategy(symbol: string, price: number, candles: CandleData[], currentPosition: 'long' | 'short' | 'none', config: Record<string, unknown>): Signal {
    const rules = Array.isArray(config.rules) ? config.rules : [];
    for (const rule of rules) {
        const { condition, operator, value, action } = rule;
        let conditionMet = false;
        switch (condition) {
            case 'price':
                conditionMet = operator === '>' ? price > value : price < value;
                break;
            case 'change_percent':
                conditionMet = operator === '>' ? marketDataChange(candles) > value : marketDataChange(candles) < value;
                break;
        }
        if (conditionMet) {
            return { symbol, action: action as 'buy' | 'sell' | 'hold', confidence: 80, price, reason: `Özel kural: ${condition} ${operator} ${value}`, strategy: 'custom', timestamp: new Date() };
        }
    }
    return { symbol, action: 'hold', confidence: 50, price, reason: 'Özel kural karşılanmadı', strategy: 'custom', timestamp: new Date() };
}

export async function generateAllSignals(
    bots: IBot[],
    marketData: Record<string, MarketData>,
    candles: Record<string, CandleData[]>,
    positions: Record<string, 'long' | 'short' | 'none'>
): Promise<Signal[]> {
    const signals: Signal[] = [];

    for (const bot of bots) {
        for (const symbol of bot.symbols) {
            const data = marketData[symbol];
            const candleData = candles[symbol] || [];
            const position = positions[symbol] || 'none';

            if (!data || candleData.length === 0) {
                logWarn(`Bot "${bot.name}": ${symbol} için veri yok, atlanıyor`);
                continue;
            }

            try {
                const signal = generateSignal(bot, data, candleData, position);
                signals.push(signal);

                if (signal.action !== 'hold') {
                    logInfo(`Bot "${bot.name}": ${symbol} - ${signal.action.toUpperCase()} sinyali (${signal.confidence}%)`);
                }
            } catch (err) {
                logError(`Bot "${bot.name}" sinyal hatası (${symbol})`, err);
            }
        }
    }

    return signals;
}
