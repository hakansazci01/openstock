import { inngest } from "@/lib/inngest/client";
import { PERSONALIZED_WELCOME_EMAIL_PROMPT } from "@/lib/inngest/prompts";
import { sendWelcomeEmail } from "@/lib/nodemailer";
import { callAIProviderWithFallback } from "@/lib/ai-provider";
import { connectToDatabase } from "@/database/mongoose";
import { Alert } from "@/database/models/alert.model";
import { getLiveQuotes } from "@/lib/actions/finnhub.actions";
import { logError, logInfo } from "@/lib/logger";

// Minimal Inngest step type to avoid `any`
interface InngestStep {
    run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

type AlertDocument = {
    _id: import("mongoose").Types.ObjectId;
    userId: string;
    symbol: string;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
};

type ActiveAlert = Omit<AlertDocument, '_id'> & { _id: string };

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email', triggers: [{ event: 'app/user.created' }] },
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `;

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile);

        const introText = await step.run('generate-welcome-intro', async () => {
            try {
                return await callAIProviderWithFallback(prompt);
            } catch (error) {
                console.error("⚠️ All AI providers failed for welcome email", error);
                return 'Thanks for joining Openstock. You now have the tools to track markets and make smarter moves.';
            }
        });

        const emailResult = await step.run('send-welcome-email', async () => {
            try {
                const { data: { email, name } } = event;
                const result = await sendWelcomeEmail({ email, name, intro: introText });
                if (result.status !== 'sent') {
                    console.log(`Welcome email skipped for: ${email}`);
                    return result;
                }
                console.log(`✅ Welcome email sent successfully to: ${email}`);
                return result;
            } catch (error) {
                console.error('❌ Error sending welcome email:', error);
                throw error;
            }
        });

        return emailResult.status === 'sent'
            ? { success: true, message: 'Welcome email sent successfully' }
            : { success: true, message: 'Welcome email skipped because email credentials are not configured' };
    }
);

export const sendWeeklyNewsSummary = inngest.createFunction(
    { id: 'weekly-news-summary', triggers: [{ event: 'app/send.weekly.news' }, { cron: '0 9 * * 1' }] },
    async ({ step }) => {
        const articles = await step.run('fetch-general-news', async () => {
            const { getNews } = await import("@/lib/actions/finnhub.actions");
            const news = await getNews();
            return (news || []).slice(0, 10);
        });

        if (!articles || articles.length === 0) {
            return { message: 'No news available to summarize.' };
        }

        return { processed: articles.length, message: 'Weekly news summary generated' };
    }
);

export const checkStockAlerts = inngest.createFunction(
    { id: 'check-stock-alerts', triggers: [{ cron: '*/5 * * * *' }] },
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

                    try {
                        const { sendBotSignalEmail } = await import("@/lib/nodemailer");
                        await sendBotSignalEmail({
                            email: alert.userId,
                            symbol: alert.symbol,
                            signal: alert.condition === 'ABOVE' ? 'BUY' : 'SELL',
                            price: currentPrice,
                            reason: `Fiyat ${currentPrice} ${alert.condition === 'ABOVE' ? 'üstüne' : 'altına'} çıktı (hedef: ${alert.targetPrice})`,
                            confidence: 100,
                            strategy: 'Price Alert',
                            timestamp: new Date().toLocaleString('tr-TR'),
                        });
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

export const checkInactiveUsers = inngest.createFunction(
    { id: 'check-inactive-users', triggers: [{ cron: '0 10 * * 0' }] },
    async ({ step }: { step: InngestStep }) => {
        const { getAllUsersForNewsEmail } = await import("@/lib/actions/user.actions");
        const users = await getAllUsersForNewsEmail();

        const inactiveUsers = (users as { lastActiveAt?: string | Date }[]).filter((user) => {
            const lastActive = new Date(user.lastActiveAt || 0);
            const daysInactive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
            return daysInactive > 7;
        });

        if (inactiveUsers.length === 0) {
            return { message: 'No inactive users to re-engage.' };
        }

        return { processed: inactiveUsers.length, message: `${inactiveUsers.length} inactive users found` };
    }
);