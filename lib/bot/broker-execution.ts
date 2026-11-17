'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Bot, Trade, type IBot } from '@/database/models/Bot';
import { AuditLog } from '@/database/models/audit.log.model';
import { BaseBrokerAdapter, BrokerPosition } from '@/lib/broker/broker-adapter';
import { getBrokerCredentialsForUser, updateBrokerLastSynced } from '@/lib/broker/broker.service';
import {
    assertTradingAllowed,
    createBrokerAdapter,
    getTradingLimits,
    normalizeBrokerSymbol,
    normalizeBrokerUrl,
    type SupportedBroker,
    type TradingLimits,
} from '@/lib/broker/registry';
import { fetchCandles } from '@/lib/bot/data-fetch';
import { computePortfolio, positionSizePercent, type TradeLike } from '@/lib/bot/portfolio';
import { generateSignal, type CandleData, type MarketData } from '@/lib/bot/strategy';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { assertTradingAllowed as killSwitchAssertTradingAllowed, getTradingState } from '@/lib/trading/kill-switch';

/**
 * Live (real-money) bot execution.
 *
 * Safety rules enforced here:
 * - Only the owner's `isConnected` credentials are ever used; there is no
 *   "first connected user" fallback.
 * - Live endpoints are refused unless LIVE_TRADING_ENABLED=true.
 * - Every order is checked against per-order and per-day notional caps.
 * - Buys are blocked without buying power and when the bot is already long.
 * - Sells can never exceed the bot's tracked position *and* the broker position.
 * - A protective stop is placed right after every buy; if the stop cannot be
 *   placed the position is closed immediately (fail-safe).
 * - Signals come from the same strategy engine the paper bot uses, with real
 *   broker quotes, and are skipped when data is missing.
 */

export interface BrokerTradeResult {
    success: boolean;
    botId?: string;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    orderId?: string;
    message: string;
}

export interface RiskCheckResult {
    allowed: boolean;
    reason?: string;
    maxQuantity?: number;
}

type BrokerContext = {
    adapter: BaseBrokerAdapter;
    broker: SupportedBroker;
    apiUrl: string;
    credentialsId: string;
    limits: TradingLimits;
    isLive: boolean;
};

/** Prevents the scheduler and a manual click from running the same bot at once. */
const runningBots = new Set<string>();
const MIN_TRADE_VALUE = 1;

const QUOTE_ASSETS = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'BTC', 'ETH', 'BNB', 'TRY', 'EUR', 'BRL'];

function baseAsset(symbol: string): string {
    const upper = symbol.toUpperCase();
    for (const quote of QUOTE_ASSETS) {
        if (upper.length > quote.length && upper.endsWith(quote)) return upper.slice(0, -quote.length);
    }
    return upper;
}

function sameInstrument(a: string, b: string): boolean {
    return a.toUpperCase() === b.toUpperCase() || baseAsset(a) === baseAsset(b);
}

function findPosition(positions: BrokerPosition[], symbol: string): BrokerPosition | undefined {
    return positions.find((position) => sameInstrument(position.symbol, symbol));
}

function roundQuantity(value: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.floor(value * 1_000_000) / 1_000_000;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

async function getBrokerContext(userId: string): Promise<BrokerContext | null> {
    const creds = await getBrokerCredentialsForUser(userId);
    if (!creds) return null;
    if (!creds.isConnected) {
        logWarn('Canlı bot: broker bağlantısı doğrulanmamış', { userId });
        return null;
    }

    const broker = creds.broker as SupportedBroker;
    const apiUrl = normalizeBrokerUrl(broker, creds.apiUrl);

    // Must run before any request so a disabled live endpoint is never contacted.
    assertTradingAllowed(broker, apiUrl);

    const adapter = createBrokerAdapter(broker);
    if (!adapter) return null;

    const connected = await adapter.connect(creds.apiKey, creds.apiSecret, apiUrl);
    if (!connected) {
        logWarn('Canlı bot: broker bağlantısı kurulamadı', { userId, broker });
        return null;
    }

    return {
        adapter,
        broker,
        apiUrl,
        credentialsId: creds.id,
        limits: getTradingLimits(broker, apiUrl),
        isLive: true,
    };
}

async function getDailyNotional(userId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const liveBotIds = (await Bot.find({ userId, isPaper: false }).distinct('_id')).map(String);

    const [botTrades, manualOrders] = await Promise.all([
        liveBotIds.length === 0
            ? Promise.resolve([] as { total: number }[])
            : Trade.aggregate<{ total: number }>([
                { $match: { userId, botId: { $in: liveBotIds }, executedAt: { $gte: start } } },
                { $group: { _id: null, total: { $sum: '$total' } } },
            ]),
        // Manual orders never create Trade rows, so their notional is read from the audit trail.
        AuditLog.aggregate<{ total: number }>([
            { $match: { userId, action: 'manual_buy', createdAt: { $gte: start } } },
            { $group: { _id: null, total: { $sum: { $toDouble: '$details.notional' } } } },
        ]),
    ]);

    const total = Number(botTrades[0]?.total ?? 0) + Number(manualOrders[0]?.total ?? 0);
    return Number.isFinite(total) ? total : 0;
}

/** Today's live notional for a user, used by the manual order route. */
export async function getDailyTradedNotional(userId: string): Promise<number> {
    await connectToDatabase();
    return getDailyNotional(userId);
}

/**
 * Pure guard used before every live order. Kept async so it can live next to the
 * other server actions and read the persisted daily notional.
 */
export async function checkTradeRisk(params: {
    userId: string;
    context: BrokerContext;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    accountEquity: number;
    buyingPower: number;
    existingPositionValue?: number;
    config?: Record<string, unknown>;
}): Promise<RiskCheckResult> {
    const { quantity, price } = params;

    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { allowed: false, reason: 'Emir adedi geçersiz' };
    }
    if (!Number.isFinite(price) || price <= 0) {
        return { allowed: false, reason: 'Fiyat geçersiz' };
    }

    const notional = quantity * price;
    if (notional < MIN_TRADE_VALUE) {
        return { allowed: false, reason: `İşlem tutarı çok küçük (minimum $${MIN_TRADE_VALUE})` };
    }

    // Caps limit exposure-increasing orders. Sells must always be allowed so a
    // position can be exited, even after the daily cap has been reached.
    if (params.side === 'buy') {
        if (notional > params.context.limits.maxOrderNotional) {
            return {
                allowed: false,
                reason: `Emir tutarı ${notional.toFixed(2)} tek emir limitini aşıyor (${params.context.limits.maxOrderNotional})`,
            };
        }

        const used = await getDailyNotional(params.userId);
        if (used + notional > params.context.limits.maxDailyNotional) {
            return {
                allowed: false,
                reason: `Günlük işlem limiti aşıldı (kullanılan ${used.toFixed(2)} + ${notional.toFixed(2)} > ${params.context.limits.maxDailyNotional})`,
            };
        }
    }

    if (params.side === 'buy') {
        if (notional > params.buyingPower) {
            return { allowed: false, reason: `Alım gücü yetersiz (${params.buyingPower.toFixed(2)} < ${notional.toFixed(2)})` };
        }

        const config = params.config ?? {};
        const percent = Number(config.maxPositionPercent ?? config.positionSizePercent ?? 20);
        const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(1, percent)) : 20;
        const cap = params.accountEquity * (safePercent / 100);
        const existing = Number(params.existingPositionValue ?? 0);
        // Enforced on the first entry too: maxPositionPercent is the ceiling for a
        // symbol's share of equity, not just the amount that can be added.
        if (cap > 0 && existing + notional > cap) {
            return {
                allowed: false,
                reason: `Pozisyon büyüklüğü sınırı aşıldı (${(existing + notional).toFixed(2)} > ${cap.toFixed(2)})`,
                maxQuantity: Math.floor(Math.max(0, cap - existing) / price),
            };
        }
    }

    return { allowed: true, maxQuantity: quantity };
}

async function cancelOpenSellOrders(
    context: BrokerContext,
    symbol: string,
): Promise<void> {
    try {
        const orders = await context.adapter.getOrders(symbol);
        for (const order of orders) {
            if (order.side !== 'sell') continue;
            if (order.status !== 'pending' && order.status !== 'partially_filled') continue;
            if (!sameInstrument(order.symbol, symbol)) continue;
            try {
                await context.adapter.cancelOrder(order.orderId, order.symbol);
            } catch (err) {
                logWarn('Canlı bot: koruma emri iptal edilemedi', {
                    symbol,
                    orderId: order.orderId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
    } catch (err) {
        logWarn('Canlı bot: açık emirler okunamadı', {
            symbol,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

async function recordTrade(params: {
    bot: IBot;
    symbol: string;
    side: 'buy' | 'sell';
    quantity: number;
    price: number;
    orderId: string;
    pnl?: number;
    pnlPercent?: number;
}): Promise<void> {
    const total = params.quantity * params.price;
    await Trade.create({
        botId: params.bot._id.toString(),
        userId: params.bot.userId,
        symbol: params.symbol,
        side: params.side,
        price: params.price,
        quantity: params.quantity,
        total,
        strategy: params.bot.strategy,
        signal: params.side,
        executedAt: new Date(),
        status: 'executed',
        pnl: params.pnl,
        pnlPercent: params.pnlPercent,
    });

    try {
        await AuditLog.create({
            userId: params.bot.userId,
            userEmail: '',
            action: `live_${params.side}`,
            resource: 'broker_order',
            resourceId: params.orderId,
            details: {
                botId: String(params.bot._id),
                botName: params.bot.name,
                symbol: params.symbol,
                side: params.side,
                quantity: params.quantity,
                price: params.price,
                notional: total,
            },
        });
    } catch {
        // Audit storage must never block or roll back a broker fill.
    }
}

type StopResult =
    | { status: 'placed'; stopPrice: number; quantity: number }
    | { status: 'skipped'; reason: string }
    | { status: 'failed'; error: string };

async function placeProtectiveStop(params: {
    context: BrokerContext;
    symbol: string;
    quantity: number;
    entryPrice: number;
    stopLossPercent?: number;
    stopLossPrice?: number;
}): Promise<StopResult> {
    const percent = Number(params.stopLossPercent);
    const absolute = Number(params.stopLossPrice);

    let stopPrice = 0;
    if (Number.isFinite(percent) && percent > 0 && percent < 100) {
        stopPrice = params.entryPrice * (1 - percent / 100);
    } else if (Number.isFinite(absolute) && absolute > 0 && absolute < params.entryPrice) {
        stopPrice = absolute;
    } else {
        return { status: 'skipped', reason: 'Stop-loss yapılandırılmamış' };
    }

    let quantity = params.quantity;
    // Alpaca does not accept fractional quantities on stop orders; a partial
    // stop would leave the rest unprotected, so only whole shares are covered.
    if (params.context.broker === 'alpaca') {
        quantity = Math.floor(quantity);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return { status: 'skipped', reason: 'Pozisyon koruma emri için çok küçük' };
    }

    stopPrice = Number(stopPrice.toFixed(8));
    if (!Number.isFinite(stopPrice) || stopPrice <= 0) {
        return { status: 'failed', error: 'Stop fiyatı hesaplanamadı' };
    }

    try {
        await params.context.adapter.placeOrder({
            symbol: params.symbol,
            side: 'sell',
            type: 'stop',
            quantity,
            stopPrice,
        });
        return { status: 'placed', stopPrice, quantity };
    } catch (err) {
        return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
}

async function buildMarketData(
    context: BrokerContext,
    symbol: string,
    brokerSymbol: string,
): Promise<{ data: MarketData; candles: CandleData[] } | { error: string }> {
    let quote;
    try {
        quote = await context.adapter.getQuote(brokerSymbol);
    } catch (err) {
        return { error: `Fiyat alınamadı: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (!Number.isFinite(quote.price) || quote.price <= 0) {
        return { error: 'Broker geçerli fiyat döndürmedi' };
    }

    let candles = await fetchCandles(symbol, 120).catch(() => [] as CandleData[]);
    if (candles.length === 0 && brokerSymbol !== symbol) {
        candles = await fetchCandles(brokerSymbol, 120).catch(() => [] as CandleData[]);
    }

    const lastClose = candles.length > 0 ? candles[candles.length - 1].close : quote.price;
    const prevClose = candles.length > 1 ? candles[candles.length - 2].close : lastClose;
    const change = quote.price - lastClose;

    return {
        data: {
            symbol,
            price: quote.price,
            change,
            changePercent: lastClose > 0 ? (change / lastClose) * 100 : 0,
            high: Math.max(quote.price, lastClose),
            low: Math.min(quote.price, lastClose),
            open: lastClose,
            prevClose,
            volume: candles.length > 0 ? candles[candles.length - 1].volume : 0,
            timestamp: new Date(),
            source: 'yahoo',
        },
        candles,
    };
}

async function executeBotCycle(
    bot: IBot,
    context: BrokerContext,
): Promise<BrokerTradeResult[]> {
    const results: BrokerTradeResult[] = [];
    const symbols = (bot.symbols ?? []).map(String).filter(Boolean);
    if (symbols.length === 0) {
        return [{ success: false, botId: String(bot._id), symbol: '', side: 'buy', quantity: 0, price: 0, message: 'Sembol listesi boş' }];
    }

    const [account, brokerPositions, previousTrades] = await Promise.all([
        context.adapter.getAccount(),
        context.adapter.getPositions(),
        Trade.find({ botId: bot._id.toString() }).sort({ executedAt: 1 }).lean(),
    ]);

    const equity = Number(account.equity);
    const buyingPower = Number(account.buyingPower);
    if (!Number.isFinite(equity) || equity <= 0) {
        return [{ success: false, botId: String(bot._id), symbol: '', side: 'buy', quantity: 0, price: 0, message: 'Hesap özkaynağı okunamadı' }];
    }

    const config = asRecord(bot.strategyConfig);
    const sizePercent = positionSizePercent(config);

    for (const symbol of symbols) {
        try {
            const brokerSymbol = normalizeBrokerSymbol(context.broker, symbol);
            const market = await buildMarketData(context, symbol, brokerSymbol);
            if ('error' in market) {
                results.push({
                    success: false,
                    botId: String(bot._id),
                    symbol,
                    side: 'buy',
                    quantity: 0,
                    price: 0,
                    message: market.error,
                });
                continue;
            }

            // The bot's own book decides long/flat, so two bots sharing one broker
            // account cannot buy or sell each other's positions.
            const marks = { [symbol]: market.data.price };
            const book = computePortfolio(
                bot.initialCapital,
                previousTrades as TradeLike[],
                marks,
            );
            const botPosition = book.positions.find((position) => sameInstrument(position.symbol, symbol));
            const brokerPosition = findPosition(brokerPositions, brokerSymbol);
            const isLong = Boolean(botPosition && botPosition.quantity > 0);

            const signal = generateSignal(bot, market.data, market.candles, isLong ? 'long' : 'none');

            if (signal.action === 'hold') continue;

            if (signal.action === 'buy') {
                if (isLong) {
                    logInfo(`Canlı bot "${bot.name}": ${symbol} zaten pozisyonda, alım atlandı`);
                    continue;
                }

                const weight = Number(bot.symbolWeights?.[symbol]);
                const targetPercent = Number.isFinite(weight) && weight > 0
                    ? Math.min(100, weight)
                    : sizePercent;

                const maxOrder = context.limits.maxOrderNotional;
                const allocation = Math.min(
                    equity * (targetPercent / 100),
                    buyingPower * 0.98,
                    maxOrder * 0.98,
                );
                if (!Number.isFinite(allocation) || allocation < MIN_TRADE_VALUE) continue;

                const quantity = roundQuantity(allocation / market.data.price);
                if (quantity <= 0) continue;

                const risk = await checkTradeRisk({
                    userId: bot.userId,
                    context,
                    side: 'buy',
                    quantity,
                    price: market.data.price,
                    accountEquity: equity,
                    buyingPower,
                    existingPositionValue: botPosition?.marketValue ?? 0,
                    config,
                });
                if (!risk.allowed) {
                    results.push({
                        success: false,
                        botId: String(bot._id),
                        symbol,
                        side: 'buy',
                        quantity: 0,
                        price: market.data.price,
                        message: `Risk engeli: ${risk.reason ?? 'bilinmeyen'}`,
                    });
                    continue;
                }

                // A stale protective stop from a previous cycle would reserve the
                // shares this sell needs, so clear it before changing the position.
                await cancelOpenSellOrders(context, brokerSymbol);

                const order = await context.adapter.placeOrder({
                    symbol: brokerSymbol,
                    side: 'buy',
                    type: 'market',
                    quantity,
                });

                const filled = Number.isFinite(order.filledQuantity) && order.filledQuantity > 0
                    ? order.filledQuantity
                    : quantity;
                const fillPrice = Number.isFinite(order.averagePrice) && Number(order.averagePrice) > 0
                    ? Number(order.averagePrice)
                    : market.data.price;

                await recordTrade({
                    bot,
                    symbol,
                    side: 'buy',
                    quantity: filled,
                    price: fillPrice,
                    orderId: order.orderId,
                });

                const stop = await placeProtectiveStop({
                    context,
                    symbol: brokerSymbol,
                    quantity: filled,
                    entryPrice: fillPrice,
                    stopLossPercent: config.stopLossPercent as number | undefined,
                    stopLossPrice: config.stopLoss as number | undefined,
                });

                if (stop.status !== 'placed') {
                    // Fail-safe: never leave a live position unprotected. A skipped stop
                    // (missing config or a size the broker cannot protect) is treated
                    // exactly like a failed one.
                    const stopProblem = stop.status === 'failed' ? stop.error : stop.reason;
                    let closeMessage = '';
                    try {
                        const closeOrder = await context.adapter.placeOrder({
                            symbol: brokerSymbol,
                            side: 'sell',
                            type: 'market',
                            quantity: filled,
                        });
                        await recordTrade({
                            bot,
                            symbol,
                            side: 'sell',
                            quantity: Number.isFinite(closeOrder.filledQuantity) && closeOrder.filledQuantity > 0
                                ? closeOrder.filledQuantity
                                : filled,
                            price: Number(closeOrder.averagePrice) > 0 ? Number(closeOrder.averagePrice) : fillPrice,
                            orderId: closeOrder.orderId,
                        });
                        closeMessage = `Pozisyon güvenlik nedeniyle kapatıldı (${closeOrder.orderId})`;
                    } catch (closeErr) {
                        closeMessage = `ACİL KAPATMA BAŞARISIZ: ${closeErr instanceof Error ? closeErr.message : String(closeErr)}`;
                        logError(`Canlı bot "${bot.name}" ${symbol}: stop konulamadı ve kapatma başarısız`, closeErr);
                    }

                    results.push({
                        success: false,
                        botId: String(bot._id),
                        symbol,
                        side: 'buy',
                        quantity: filled,
                        price: fillPrice,
                        orderId: order.orderId,
                        message: `Koruma emri konulamadı (${stopProblem}). ${closeMessage}`,
                    });
                    continue;
                }

                results.push({
                    success: true,
                    botId: String(bot._id),
                    symbol,
                    side: 'buy',
                    quantity: filled,
                    price: fillPrice,
                    orderId: order.orderId,
                    message: `Canlı alım: ${filled} ${symbol} @ ${fillPrice} (stop ${stop.stopPrice})`,
                });
                logInfo(`Canlı bot "${bot.name}": ${symbol} ALIŞ ${filled} @ ${fillPrice}`, {
                    stop: stop.stopPrice,
                });
                continue;
            }

            // SELL
            if (!isLong || !botPosition) continue;

            const brokerQty = brokerPosition?.quantity ?? 0;
            if (!Number.isFinite(brokerQty) || brokerQty <= 0) {
                results.push({
                    success: false,
                    botId: String(bot._id),
                    symbol,
                    side: 'sell',
                    quantity: 0,
                    price: market.data.price,
                    message: 'Bot pozisyonu var ama broker pozisyonu yok; satış atlandı',
                });
                continue;
            }

            const quantity = roundQuantity(Math.min(botPosition.quantity, brokerQty));
            if (quantity <= 0) continue;

            const risk = await checkTradeRisk({
                userId: bot.userId,
                context,
                side: 'sell',
                quantity,
                price: market.data.price,
                accountEquity: equity,
                buyingPower,
                config,
            });
            if (!risk.allowed) {
                results.push({
                    success: false,
                    botId: String(bot._id),
                    symbol,
                    side: 'sell',
                    quantity: 0,
                    price: market.data.price,
                    message: `Risk engeli: ${risk.reason ?? 'bilinmeyen'}`,
                });
                continue;
            }

            await cancelOpenSellOrders(context, brokerSymbol);

            const order = await context.adapter.placeOrder({
                symbol: brokerSymbol,
                side: 'sell',
                type: 'market',
                quantity,
            });

            const filled = Number.isFinite(order.filledQuantity) && order.filledQuantity > 0
                ? order.filledQuantity
                : quantity;
            const fillPrice = Number.isFinite(order.averagePrice) && Number(order.averagePrice) > 0
                ? Number(order.averagePrice)
                : market.data.price;
            const pnl = botPosition.avgCost > 0 ? (fillPrice - botPosition.avgCost) * filled : undefined;
            const pnlPercent = botPosition.avgCost > 0 ? ((fillPrice - botPosition.avgCost) / botPosition.avgCost) * 100 : undefined;

            await recordTrade({
                bot,
                symbol,
                side: 'sell',
                quantity: filled,
                price: fillPrice,
                orderId: order.orderId,
                pnl,
                pnlPercent,
            });

            results.push({
                success: true,
                botId: String(bot._id),
                symbol,
                side: 'sell',
                quantity: filled,
                price: fillPrice,
                orderId: order.orderId,
                message: `Canlı satış: ${filled} ${symbol} @ ${fillPrice}`,
            });
            logInfo(`Canlı bot "${bot.name}": ${symbol} SATIŞ ${filled} @ ${fillPrice}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logError(`Canlı bot "${bot.name}" ${symbol} emir hatası`, err);
            results.push({
                success: false,
                botId: String(bot._id),
                symbol,
                side: 'buy',
                quantity: 0,
                price: 0,
                message,
            });
        }
    }

    await updateBrokerLastSynced(context.credentialsId);
    return results;
}

type LiveRunOptions = { force?: boolean; userId?: string };

/**
 * Runs one live bot. `force` is only for a user-initiated "run now".
 * The context map is shared inside a single scheduler tick so one broker
 * connection is reused, but it never outlives the request.
 */
async function runLiveBotInternal(
    botId: string,
    options: LiveRunOptions,
    contexts?: Map<string, BrokerContext | null>,
): Promise<BrokerTradeResult[]> {
    await connectToDatabase();

    const bot = await Bot.findById(botId);
    if (!bot) return [{ success: false, botId, symbol: '', side: 'buy', quantity: 0, price: 0, message: 'Bot bulunamadı' }];
    if (options.userId && bot.userId !== options.userId) {
        return [{ success: false, botId, symbol: '', side: 'buy', quantity: 0, price: 0, message: 'Erişim reddedildi' }];
    }
    if (bot.isPaper || bot.type !== 'live') {
        return [{ success: false, botId, symbol: '', side: 'buy', quantity: 0, price: 0, message: 'Bu bot canlı (gerçek para) botu değil' }];
    }
    if (!options.force && bot.status !== 'running') {
        return [];
    }

    // Kill switch kontrolü - tüm canlı bot işlemlerini durdurur
    const tradingState = await getTradingState(bot.userId);
    if (tradingState.status === 'killed') {
        logWarn('Canlı bot kill switch tarafından engellendi', {
            botId,
            userId: bot.userId,
            reason: tradingState.reason,
        });
        return [{
            success: false,
            botId,
            symbol: '',
            side: 'buy',
            quantity: 0,
            price: 0,
            message: `Trading durduruldu (kill switch): ${tradingState.reason || 'bilinmeyen neden'}`,
        }];
    }

    const now = new Date();
    if (!options.force) {
        if (bot.nextRunAt && new Date(bot.nextRunAt).getTime() > now.getTime()) return [];
        // Atomic claim: only one scheduler instance can run this interval.
        const claimed = await Bot.findOneAndUpdate(
            {
                _id: bot._id,
                status: 'running',
                isPaper: false,
                $or: [{ nextRunAt: { $exists: false } }, { nextRunAt: { $lte: now } }],
            },
            {
                $set: {
                    nextRunAt: new Date(now.getTime() + Math.max(1, bot.intervalMinutes || 15) * 60_000),
                },
            },
            { new: true },
        );
        if (!claimed) return [];
    }

    if (runningBots.has(botId)) {
        return [{ success: false, botId, symbol: '', side: 'buy', quantity: 0, price: 0, message: 'Bot zaten çalışıyor' }];
    }
    runningBots.add(botId);

    try {
        let context: BrokerContext | null;
        if (contexts && contexts.has(bot.userId)) {
            context = contexts.get(bot.userId) ?? null;
        } else {
            context = await getBrokerContext(bot.userId);
            contexts?.set(bot.userId, context);
        }

        if (!context) {
            await Bot.findByIdAndUpdate(botId, {
                lastError: 'Broker bağlantısı yok veya canlı işlem kapalı',
                lastRunAt: new Date(),
            }).catch(() => undefined);
            return [{
                success: false,
                botId,
                symbol: '',
                side: 'buy',
                quantity: 0,
                price: 0,
                message: 'Broker bağlantısı yok veya canlı işlem kapalı',
            }];
        }

        const results = await executeBotCycle(bot, context);

        // Displayed equity comes from the broker, not from a local simulation.
        try {
            const account = await context.adapter.getAccount();
            const equity = Number(account.equity);
            const cash = Number(account.cash);
            if (Number.isFinite(equity)) {
                const totalReturn = equity - bot.initialCapital;
                const previousEquity = Number(bot.currentCapital) || bot.initialCapital;
                const cycleDrawdown = previousEquity > 0
                    ? Math.max(0, ((previousEquity - equity) / previousEquity) * 100)
                    : 0;
                const lastSignals = results
                    .filter((result) => result.success)
                    .map((result) => ({
                        symbol: result.symbol,
                        action: result.side,
                        confidence: 0,
                        price: result.price,
                        reason: result.message,
                        at: new Date(),
                    }));

                const update: Record<string, unknown> = {
                    currentCapital: equity,
                    totalReturn,
                    totalReturnPercent: bot.initialCapital > 0 ? (totalReturn / bot.initialCapital) * 100 : 0,
                    maxDrawdown: Math.max(Number(bot.maxDrawdown) || 0, cycleDrawdown),
                    lastRunAt: new Date(),
                    lastError: results.some((result) => !result.success)
                        ? results.filter((result) => !result.success).map((result) => result.message).join(' | ').slice(0, 500)
                        : undefined,
                };
                if (Number.isFinite(cash)) update.cash = cash;
                if (lastSignals.length > 0) update.lastSignals = lastSignals;

                await Bot.findByIdAndUpdate(botId, update);
            }
        } catch (err) {
            logWarn('Canlı bot: hesap özeti güncellenemedi', {
                botId,
                error: err instanceof Error ? err.message : String(err),
            });
        }

        return results;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`Canlı bot çalıştırma hatası (${botId})`, err);
        await Bot.findByIdAndUpdate(botId, { lastError: message, lastRunAt: new Date() }).catch(() => undefined);
        return [{ success: false, botId, symbol: '', side: 'buy', quantity: 0, price: 0, message }];
    } finally {
        runningBots.delete(botId);
    }
}

export async function runLiveBot(
    botId: string,
    options: LiveRunOptions = {},
): Promise<BrokerTradeResult[]> {
    return runLiveBotInternal(botId, options);
}

/**
 * Scheduler entry point. Pass `userId` for a user-initiated run so the query can
 * never touch another account's bots. Omitting it is reserved for Inngest.
 */
export async function runAllBotsWithBroker(userId?: string): Promise<BrokerTradeResult[]> {
    await connectToDatabase();

    const query: Record<string, unknown> = { status: 'running', isPaper: false };
    if (userId) query.userId = userId;

    const bots = await Bot.find(query).lean();
    if (bots.length === 0) return [];

    const results: BrokerTradeResult[] = [];
    const contexts = new Map<string, BrokerContext | null>();
    for (const bot of bots) {
        const botResults = await runLiveBotInternal(String(bot._id), { userId }, contexts);
        results.push(...botResults);
    }

    return results;
}
