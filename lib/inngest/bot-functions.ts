/**
 * OpenStock Bot Scheduler - Inngest
 * Belirli aralıklarla tüm çalışan botları tetikler
 */

import { inngest } from '@/lib/inngest/client';
import { Bot } from '@/database/models/Bot';
import { Alert } from '@/database/models/alert.model';
import { connectToDatabase } from '@/database/mongoose';
import { runBotCycle } from '@/lib/bot/paper-trading';
import { runAllBotsWithBroker } from '@/lib/bot/broker-execution';
import { sendBotSignalEmail } from '@/lib/nodemailer';
import { logError, logInfo } from '@/lib/logger';
import { getLiveQuotes } from '@/lib/actions/finnhub.actions';

// Minimal Inngest step type to avoid `any`
interface InngestStep {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

// Minimal Inngest event type
interface InngestEvent<T = unknown> {
    data: T;
}

// Her 15 dakikada bir tüm working botları çalıştır (paper + gerçek broker)
export const runAllBots = inngest.createFunction(
    { id: 'run-all-bots', name: 'Run All Trading Bots', triggers: [{ cron: '*/15 * * * *' }] },
    async ({ step }: { step: InngestStep }) => {
        await connectToDatabase();

        // Paper trading botları (yalnızca zamanı gelenler; intervalMinutes'a uyulur)
        const now = new Date();
        const paperBots = await Bot.find({
            status: 'running',
            isPaper: true,
            $or: [{ nextRunAt: { $exists: false } }, { nextRunAt: { $lte: now } }],
        }).lean();
        logInfo(`Bot scheduler: ${paperBots.length} paper trading bot bulundu`);

        for (const bot of paperBots) {
            try {
                await step.run(`run-paper-bot-${bot._id}`, async () => {
                    const result = await runBotCycle(bot._id.toString());
                    if (result.error) {
                        logError(`Bot "${bot.name}" çalıştırma hatası`, new Error(result.error));
                    } else {
                        logInfo(`Bot "${bot.name}" çalıştırıldı: ${result.signals.length} sinyal, ${result.trades.length} işlem`);
                    }
                });
            } catch (err) {
                logError(`Bot "${bot.name}" scheduler hatası`, err);
            }
        }

        // Gerçek broker botları
        try {
            await step.run('run-real-broker-bots', async () => {
                const results = await runAllBotsWithBroker();
                const successful = results.filter((r) => r.success).length;
                logInfo(`Gerçek broker: ${successful}/${results.length} başarılı`);
            });
        } catch (err) {
            logError('Gerçek broker scheduler hatası', err);
        }

        return { processed: paperBots.length };
    }
);

// Tüm alert'leri 15 dakikada bir kontrol et
export const checkAlerts = inngest.createFunction(
    { id: 'check-alerts', name: 'Check Price Alerts', triggers: [{ cron: '*/5 * * * *' }] },
    async ({ step }: { step: InngestStep }) => {
        await connectToDatabase();

        const activeAlerts = await Alert.find({ active: true, triggered: false }).lean();

        if (activeAlerts.length === 0) return { checked: 0, triggered: 0 };

        logInfo(`Alert check: ${activeAlerts.length} aktif alert bulundu`);

        let triggeredCount = 0;

        for (const alert of activeAlerts) {
            try {
                const quotes = await getLiveQuotes([alert.symbol]);
                const quote = quotes[alert.symbol];

                if (!quote?.c) continue;

                const currentPrice = quote.c;
                let triggered = false;

                if (alert.condition === 'ABOVE' && currentPrice >= alert.targetPrice) {
                    triggered = true;
                } else if (alert.condition === 'BELOW' && currentPrice <= alert.targetPrice) {
                    triggered = true;
                }

                if (triggered) {
                    await Alert.findByIdAndUpdate(alert._id, { triggered: true });
                    triggeredCount++;

                    // Kullanıcıya e-posta gönder
                    try {
                        const { getSession } = await import('@/lib/better-auth/auth');
                        const session = await getSession();
                        const userEmail = session?.user?.email;
                        if (userEmail) {
                            await sendBotSignalEmail({
                                email: userEmail,
                                symbol: alert.symbol,
                                signal: alert.condition === 'ABOVE' ? 'BUY' : 'SELL',
                                price: currentPrice,
                                reason: `Fiyat ${currentPrice} ${alert.condition === 'ABOVE' ? 'üstüne' : 'altına'} çıktı (hedef: ${alert.targetPrice})`,
                                confidence: 100,
                                strategy: 'Price Alert',
                                timestamp: new Date().toLocaleString('tr-TR'),
                            });
                        }
                    } catch (err) {
                        logError('Alert e-posta gönderme hatası', err);
                    }
                }
            } catch (err) {
                logError(`Alert kontrol hatası (${alert.symbol})`, err);
            }
        }

        return { checked: activeAlerts.length, triggered: triggeredCount };
    }
);

// Tek bot'u manuel çalıştırma (API'den çağrılır)
export const runSingleBot = inngest.createFunction(
    { id: 'run-single-bot', name: 'Run Single Trading Bot', triggers: [{ event: 'app/bot.run' }] },
    async ({ __event, step }: { __event: InngestEvent<{ botId: string }>; step: InngestStep }) => {
        await connectToDatabase();

        const { botId } = __event.data;

        try {
            const result = await step.run(`run-bot-${botId}`, async () => {
                return await runBotCycle(botId);
            });

            return result;
        } catch (err) {
            logError(`Bot "${botId}" çalıştırma hatası`, err);
            throw err;
        }
    }
);
