import nodemailer from 'nodemailer';
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";
import { BOT_SIGNAL_EMAIL_TEMPLATE } from "@/lib/nodemailer/templates-bot";
import { escapeHtml, formatPrice, sanitizeEmailIntro } from "@/lib/utils";
import { logError, logInfo, logWarn } from "@/lib/logger";

type EmailSendResult =
    | { status: 'skipped' }
    | { status: 'sent'; messageId: string };

const PLACEHOLDER_PASSWORDS = new Set([
    'YOUR_GMAIL_APP_PASSWORD_HERE',
    'your_gmail_app_password_here',
]);

const rawPassword = process.env.NODEMAILER_PASSWORD ?? '';
const hasEmailConfig = Boolean(
    process.env.NODEMAILER_EMAIL &&
    rawPassword &&
    !PLACEHOLDER_PASSWORDS.has(rawPassword)
);

if (!hasEmailConfig) {
    logWarn('⚠️ Email credentials are not configured. Welcome and news summary emails are disabled until NODEMAILER_EMAIL and NODEMAILER_PASSWORD are set.');
}

export const transporter = hasEmailConfig
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.NODEMAILER_EMAIL!,
            pass: process.env.NODEMAILER_PASSWORD!,
        },
        // Keep the pool small because email volume is low in this app.
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
    })
    : null;

if (transporter) {
    transporter.verify((error) => {
        if (error) {
            logError('❌ Nodemailer transporter verification failed', error);
        } else {
            logInfo('✅ Nodemailer transporter is ready to send emails');
        }
    });
}

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    try {
        if (!transporter) {
            logWarn('⚠️ Welcome email skipped: email credentials are not configured.');
            return { status: 'skipped' } satisfies EmailSendResult;
        }

        // Function replacements: a string would expand $& or $' inside the name
        const htmlTemplate = WELCOME_EMAIL_TEMPLATE
            .replace('{{name}}', () => escapeHtml(name))
            .replace('{{intro}}', () => sanitizeEmailIntro(intro));

        const mailOptions = {
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `Welcome to Openstock - your open-source stock market toolkit!`,
            text: 'Thanks for joining OpenStock - your stock market toolkit by Hakan Borsa Analizi',
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        logInfo('✅ Welcome email sent successfully', { messageId: info.messageId });
        return { status: 'sent', messageId: info.messageId } satisfies EmailSendResult;
    } catch (error) {
        logError('❌ Failed to send welcome email', error);
        throw error;
    }
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent }: { email: string; date: string; newsContent: string }
) => {
    try {
        if (!transporter) {
            logWarn('⚠️ News summary email skipped: email credentials are not configured.');
            return { status: 'skipped' } satisfies EmailSendResult;
        }

        const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
            .replace('{{date}}', date)
            .replace('{{newsContent}}', newsContent);

        const mailOptions = {
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `📈 Market News Summary Today - ${date}`,
            text: `Today's market news summary from Openstock`,
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        logInfo('✅ News summary email sent successfully', { messageId: info.messageId });
        return { status: 'sent', messageId: info.messageId } satisfies EmailSendResult;
    } catch (error) {
        logError('❌ Failed to send news summary email', error);
        throw error;
    }
};

export const sendStockAlertEmail = async (
    { email, symbol, currentPrice, targetPrice, condition }:
    { email: string; symbol: string; currentPrice: number; targetPrice: number; condition: 'ABOVE' | 'BELOW' }
) => {
    try {
        if (!transporter) {
            logWarn('⚠️ Stock alert email skipped: email credentials are not configured.');
            return { status: 'skipped' } satisfies EmailSendResult;
        }

        const isUpper = condition === 'ABOVE';
        // Binance pairs are quoted in USDT, everything else Finnhub prices here is USD
        const money = (value: number) => symbol.startsWith('BINANCE:')
            ? `${value.toLocaleString('en-US', { maximumFractionDigits: value < 1 ? 6 : 2 })} USDT`
            : formatPrice(value);
        const htmlTemplate = (isUpper ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE)
            .replaceAll('{{symbol}}', escapeHtml(symbol))
            .replaceAll('{{company}}', '') // Alerts don't store the company name
            .replaceAll('{{currentPrice}}', money(currentPrice))
            .replaceAll('{{targetPrice}}', money(targetPrice))
            .replaceAll('{{timestamp}}', new Date().toUTCString());

        const mailOptions = {
            from: `"Openstock" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `🔔 Price Alert: ${symbol} is ${isUpper ? 'above' : 'below'} ${money(targetPrice)}`,
            text: `${symbol} is now ${money(currentPrice)}, ${isUpper ? 'above' : 'below'} your target of ${money(targetPrice)}.`,
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        logInfo('✅ Stock alert email sent successfully', { messageId: info.messageId });
        return { status: 'sent', messageId: info.messageId } satisfies EmailSendResult;
    } catch (error) {
        logError('❌ Failed to send stock alert email', error);
        throw error;
    }
};

export const sendBotSignalEmail = async ({
    email,
    symbol,
    signal,
    price,
    reason,
    confidence,
    strategy,
    timestamp,
}: {
    email: string;
    symbol: string;
    signal: 'BUY' | 'SELL';
    price: number;
    reason: string;
    confidence: number;
    strategy: string;
    timestamp: string;
}) => {
    try {
        if (!transporter) {
            logWarn('⚠️ Bot signal email skipped: email credentials are not configured.');
            return { status: 'skipped' } satisfies EmailSendResult;
        }

        const signalColor = signal === 'BUY' ? '#22c55e' : '#ef4444';

        const htmlTemplate = BOT_SIGNAL_EMAIL_TEMPLATE
            .replace('{{symbol}}', symbol)
            .replace('{{signal}}', signal)
            .replace('{{signalColor}}', signalColor)
            .replace('{{currentPrice}}', price.toFixed(2))
            .replace('{{reason}}', reason)
            .replace('{{confidence}}', String(confidence))
            .replace('{{strategy}}', strategy)
            .replace('{{timestamp}}', timestamp)
            .replace('{{dashboardUrl}}', `${process.env.BETTER_AUTH_URL || 'http://localhost:3000'}/bots`);

        const mailOptions = {
            from: `"OpenStock Trading Bot" <${process.env.NODEMAILER_EMAIL}>`,
            to: email,
            subject: `🔔 Trading Signal: ${signal} ${symbol}`,
            text: `Trading signal: ${signal} ${symbol} at ${price}. Reason: ${reason}`,
            html: htmlTemplate,
        };

        const info = await transporter.sendMail(mailOptions);
        logInfo('✅ Bot signal email sent successfully', { messageId: info.messageId });
        return { status: 'sent', messageId: info.messageId } satisfies EmailSendResult;
    } catch (error) {
        logError('❌ Failed to send bot signal email', error);
        throw error;
    }
};
