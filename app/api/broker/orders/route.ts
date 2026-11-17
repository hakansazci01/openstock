import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import { getBrokerCredentials, updateBrokerLastSynced } from '@/lib/broker/broker.service';
import {
    assertTradingAllowed as registryAssertTradingAllowed,
    createBrokerAdapter,
    getTradingLimits,
    normalizeBrokerSymbol,
    normalizeBrokerUrl,
    type SupportedBroker,
} from '@/lib/broker/registry';
import { assertTradingAllowed, recordDailyNotional, getTradingState } from '@/lib/trading/kill-switch';
import { checkDailyLossLimit, loadCircuitBreakerConfig, validateOrderNotional, validateDailyNotional } from '@/lib/trading/circuit-breaker';
import { validateStopLossRequired } from '@/lib/trading/validation';
import { checkAndRecordIdempotency } from '@/lib/trading/idempotency';
import {
    atrPositionSize,
    DEFAULT_RISK_CONFIG,
    type RiskManagementConfig,
} from '@/lib/trading/risk-management';
import { calculateSlippage, validateExecutionSlippage, DEFAULT_EXECUTION_CONFIG } from '@/lib/bot/execution-algorithms';
import { createTrailingStopState, checkTrailingStopHit } from '@/lib/bot/trailing-stop';
import { Trade } from '@/database/models/trade.model';
import { AuditLog } from '@/database/models/audit.log.model';
import { connectToDatabase } from '@/database/mongoose';

export const dynamic = 'force-dynamic';

type OrderType = 'market' | 'limit' | 'stop' | 'stop_limit';
const ORDER_TYPES: OrderType[] = ['market', 'limit', 'stop', 'stop_limit'];

const QUOTE_ASSETS = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'BTC', 'ETH', 'BNB', 'TRY', 'EUR', 'BRL'];

function baseAsset(symbol: string): string {
    const upper = symbol.toUpperCase();
    for (const quote of QUOTE_ASSETS) {
        if (upper.length > quote.length && upper.endsWith(quote)) return upper.slice(0, -quote.length);
    }
    return upper;
}

function toPositiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function writeAudit(userId: string, email: string, action: string, details: Record<string, unknown>) {
    try {
        await AuditLog.create({
            userId,
            userEmail: email,
            action,
            resource: 'broker_order',
            resourceId: details.orderId ? String(details.orderId) : undefined,
            details,
        });
    } catch {
        // Never block a broker action on audit storage.
    }
}

/**
 * Place a real order through the connected broker.
 * Body: { symbol, side, type, quantity, limitPrice?, stopPrice? }
 */
export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`broker:orders:${session.user.id}`, 30, 60, 1)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        // Kill switch ve circuit breaker kontrolü
        await assertTradingAllowed(session.user.id);
        const tradingState = await getTradingState(session.user.id);
        const isLive = tradingState.status !== 'killed' && process.env.LIVE_TRADING_ENABLED === 'true';
        const cbConfig = loadCircuitBreakerConfig();

        const creds = await getBrokerCredentials();
        if (!creds || !creds.apiKey || !creds.apiSecret) {
            return NextResponse.json({ error: 'Broker kimlik bilgileri yapılandırılmamış' }, { status: 400 });
        }
        if (!creds.isConnected) {
            return NextResponse.json({ error: 'Broker bağlantısı doğrulanmamış. Önce broker ayarlarından bağlanın.' }, { status: 400 });
        }

        const broker = creds.broker as SupportedBroker;
        const apiUrl = normalizeBrokerUrl(broker, creds.apiUrl);
        registryAssertTradingAllowed(broker, apiUrl);

        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });

        const sideRaw = String(body.side ?? '').toLowerCase();
        if (sideRaw !== 'buy' && sideRaw !== 'sell') {
            return NextResponse.json({ error: 'side buy veya sell olmalı' }, { status: 400 });
        }
        const side = sideRaw as 'buy' | 'sell';

        const typeRaw = String(body.type ?? '').toLowerCase();
        if (!ORDER_TYPES.includes(typeRaw as OrderType)) {
            return NextResponse.json({ error: 'type market, limit, stop veya stop_limit olmalı' }, { status: 400 });
        }
        const type = typeRaw as OrderType;

        const quantity = toPositiveNumber(body.quantity);
        if (quantity === null) {
            return NextResponse.json({ error: 'quantity sıfırdan büyük geçerli bir sayı olmalı' }, { status: 400 });
        }

        const symbol = normalizeBrokerSymbol(broker as string, String(body.symbol ?? ''));

        const limitPrice = body.limitPrice === undefined || body.limitPrice === null
            ? null
            : toPositiveNumber(body.limitPrice);
        const stopPrice = body.stopPrice === undefined || body.stopPrice === null
            ? null
            : toPositiveNumber(body.stopPrice);

        if ((type === 'limit' || type === 'stop_limit') && limitPrice === null) {
            return NextResponse.json({ error: 'Limit emri için geçerli limitPrice gerekli' }, { status: 400 });
        }
        if ((type === 'stop' || type === 'stop_limit') && stopPrice === null) {
            return NextResponse.json({ error: 'Stop emri için geçerli stopPrice gerekli' }, { status: 400 });
        }

        // Zorunlu stop-loss kontrolü (canlı alış emirleri için)
        const stopLossCheck = validateStopLossRequired(side, stopPrice ?? undefined, isLive);
        if (!stopLossCheck.valid) {
            return NextResponse.json({ error: stopLossCheck.reason }, { status: 400 });
        }

        const adapter = createBrokerAdapter(broker);
        if (!adapter) {
            return NextResponse.json({ error: `${broker} adaptörü desteklenmiyor` }, { status: 501 });
        }

        const connected = await adapter.connect(creds.apiKey, creds.apiSecret, apiUrl);
        if (!connected) {
            return NextResponse.json({ error: 'Broker bağlantısı kurulamadı' }, { status: 400 });
        }

        const [account, positions] = await Promise.all([
            adapter.getAccount(),
            adapter.getPositions(),
        ]);

        // Reference price is used only for risk checks; the broker executes at market.
        let referencePrice = limitPrice ?? stopPrice;
        if (!referencePrice) {
            const quote = await adapter.getQuote(symbol);
            referencePrice = quote.price;
        }
        if (!Number.isFinite(referencePrice) || referencePrice <= 0) {
            return NextResponse.json({ error: 'Referans fiyat alınamadı' }, { status: 400 });
        }

        const notional = quantity * referencePrice;
        const limits = getTradingLimits(broker, apiUrl);

        // Idempotency kontrolü
        const clientOrderId = typeof body.clientOrderId === 'string' && body.clientOrderId.trim()
            ? body.clientOrderId.trim()
            : undefined;
        if (clientOrderId) {
            const idempotent = await checkAndRecordIdempotency(clientOrderId, '', 'pending');
            if (idempotent.isDuplicate) {
                return NextResponse.json({
                    error: 'Aynı clientOrderId ile daha önce bir emir gönderilmiş',
                    existingOrderId: idempotent.existingOrderId,
                    existingStatus: idempotent.existingStatus,
                }, { status: 409 });
            }
        }

        let orderQuantity = quantity;

        if (side === 'buy') {
            // Circuit breaker: emir notional limiti
            const orderNotionalCheck = validateOrderNotional(notional, cbConfig);
            if (!orderNotionalCheck.allowed) {
                return NextResponse.json({ error: orderNotionalCheck.reason }, { status: 400 });
            }

            // Circuit breaker: günlük notional limiti
            const dailyNotionalCheck = validateDailyNotional(
                Number(tradingState.dailyTradedNotional || 0),
                notional,
                cbConfig
            );
            if (!dailyNotionalCheck.allowed) {
                return NextResponse.json({ error: dailyNotionalCheck.reason }, { status: 400 });
            }

            if (notional > limits.maxOrderNotional) {
                return NextResponse.json({
                    error: `Emir tutarı ${notional.toFixed(2)} tek emir limitini aşıyor (${limits.maxOrderNotional})`,
                }, { status: 400 });
            }
            if (notional > account.buyingPower) {
                return NextResponse.json({
                    error: `Alım gücü yetersiz (${account.buyingPower.toFixed(2)} < ${notional.toFixed(2)})`,
                }, { status: 400 });
            }
            if (notional > cbConfig.maxDailyNotionalUSD) {
                return NextResponse.json({
                    error: `Emir tutarı günlük maksimum notional limitini aşıyor`,
                }, { status: 400 });
            }
        } else {
            const position = positions.find((item) =>
                item.symbol.toUpperCase() === symbol.toUpperCase()
                || baseAsset(item.symbol) === baseAsset(symbol));
            if (!position || position.quantity <= 0) {
                return NextResponse.json({ error: `${symbol} için açık pozisyon yok` }, { status: 400 });
            }
            if (quantity > position.quantity + 1e-9) {
                return NextResponse.json({
                    error: `Satış adedi pozisyondan büyük olamaz (pozisyon: ${position.quantity})`,
                }, { status: 400 });
            }
        }

            // --- Pozisyon Sizing (ATR bazlı risk yönetimi) ---
            const riskConfig: RiskManagementConfig = {
                ...DEFAULT_RISK_CONFIG,
                maxPositionPercent: cbConfig.maxPositionPercent,
            };
            const atrStopDistance = referencePrice * 0.02;
            const sizingResult = atrPositionSize({
                equity: account.equity,
                price: referencePrice,
                atr: atrStopDistance,
                riskPerTradePercent: cbConfig.maxPositionPercent,
            });
            const maxQtyByRisk = sizingResult.quantity > 0 ? sizingResult.quantity : quantity;
            const finalQuantity = Math.min(quantity, maxQtyByRisk);
            orderQuantity = finalQuantity;
            if (finalQuantity <= 0) {
                return NextResponse.json({ error: 'Pozisyon büyüklüğü sıfır oldu. Risk limitleri çok sıkı.' }, { status: 400 });
            }

            const adjustedNotional = finalQuantity * referencePrice;
            const adjustedOrderNotionalCheck = validateOrderNotional(adjustedNotional, cbConfig);
            if (!adjustedOrderNotionalCheck.allowed) {
                return NextResponse.json({ error: adjustedOrderNotionalCheck.reason }, { status: 400 });
            }

        // Slippage toleransı kontrolü
        const slippageCheck = calculateSlippage({
            expectedPrice: referencePrice,
            executedPrice: referencePrice,
            side,
        });
        if (!slippageCheck.withinTolerance) {
            return NextResponse.json({
                error: `Slippage toleransı aşıldı (%${slippageCheck.slippagePercent.toFixed(2)} > %${slippageCheck.config.slippageTolerancePercent.toFixed(1)})`,
            }, { status: 400 });
        }

        const order = await adapter.placeOrder({
            symbol,
            side,
            type,
            quantity,
            limitPrice: limitPrice ?? undefined,
            stopPrice: stopPrice ?? undefined,
        });

        // Değişmez trade kaydını veritabanına yaz (audit trail)
        await connectToDatabase();
        await Trade.create({
            userId: session.user.id,
            broker: broker as any,
            brokerOrderId: order.orderId,
            clientOrderId,
            symbol,
            side,
            type,
            quantity,
            limitPrice: limitPrice ?? undefined,
            stopPrice: stopPrice ?? undefined,
            filledQuantity: order.filledQuantity ?? 0,
            averagePrice: order.averagePrice,
            notional,
            status: order.status,
            source: 'manual',
            executedAt: order.updatedAt ?? new Date(),
        });

        // Günlük notional sayacını artır
        await recordDailyNotional(session.user.id, notional);

        await updateBrokerLastSynced(creds.id);
        await writeAudit(session.user.id, session.user.email ?? '', `manual_${side}`, {
            broker,
            symbol,
            side,
            type,
            quantity,
            referencePrice,
            notional,
            orderId: order.orderId,
            status: order.status,
        });

        return NextResponse.json({ success: true, order });
    } catch (err) {
        console.error('Broker order error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Emir gönderilemedi' },
            { status: 400 },
        );
    }
}

/**
 * Cancel a real order through the connected broker.
 * Query: ?orderId=...&symbol=... (symbol is required for Binance)
 */
export async function DELETE(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`broker:orders:${session.user.id}`, 30, 60, 1)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        // Kill switch kontrolü (iptal işlemi de engellenmeli)
        await assertTradingAllowed(session.user.id);

        const creds = await getBrokerCredentials();
        if (!creds || !creds.apiKey || !creds.apiSecret) {
            return NextResponse.json({ error: 'Broker kimlik bilgileri yapılandırılmamış' }, { status: 400 });
        }
        if (!creds.isConnected) {
            return NextResponse.json({ error: 'Broker bağlantısı doğrulanmamış' }, { status: 400 });
        }

        const broker = creds.broker as SupportedBroker;
        const apiUrl = normalizeBrokerUrl(broker, creds.apiUrl);
        registryAssertTradingAllowed(broker, apiUrl);

        const { searchParams } = new URL(req.url);
        const orderId = (searchParams.get('orderId') ?? '').trim();
        const rawSymbol = (searchParams.get('symbol') ?? '').trim();

        if (!orderId || orderId.length > 64) {
            return NextResponse.json({ error: 'Geçerli orderId gerekli' }, { status: 400 });
        }
        if ((broker === 'binance' || broker === 'bybit' || broker === 'kraken' || broker === 'coinbase') && !rawSymbol) {
            return NextResponse.json({ error: `${broker} iptali için symbol gerekli` }, { status: 400 });
        }

        const symbol = rawSymbol ? normalizeBrokerSymbol(broker as string, rawSymbol) : undefined;

        const adapter = createBrokerAdapter(broker);
        if (!adapter) {
            return NextResponse.json({ error: `${broker} adaptörü desteklenmiyor` }, { status: 501 });
        }

        const connected = await adapter.connect(creds.apiKey, creds.apiSecret, apiUrl);
        if (!connected) {
            return NextResponse.json({ error: 'Broker bağlantısı kurulamadı' }, { status: 400 });
        }

        const cancelled = await adapter.cancelOrder(orderId, symbol);
        await updateBrokerLastSynced(creds.id);
        await writeAudit(session.user.id, session.user.email ?? '', 'manual_cancel', {
            broker,
            symbol,
            orderId,
            cancelled,
        });

        return NextResponse.json({ success: cancelled });
    } catch (err) {
        console.error('Broker cancel error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Emir iptal edilemedi' },
            { status: 400 },
        );
    }
}

