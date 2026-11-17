import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM;
const to = process.env.TWILIO_WHATSAPP_TO;

const hasWhatsAppConfig = Boolean(accountSid && authToken && from && to);

export const twilioClient = hasWhatsAppConfig
    ? twilio(accountSid, authToken)
    : null;

export const WATSAPP_FROM = from;
export const WATSAPP_TO = to;

if (!hasWhatsAppConfig) {
    console.warn('⚠️ WhatsApp credentials are not configured. WhatsApp alerts are disabled until TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM and TWILIO_WHATSAPP_TO are set.');
}

export async function sendWhatsAppAlert({
    symbol,
    currentPrice,
    targetPrice,
    condition,
}: {
    symbol: string;
    currentPrice: number;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
}): Promise<{ status: 'skipped' | 'sent'; messageId?: string; error?: string }> {
    if (!twilioClient || !WATSAPP_FROM || !WATSAPP_TO) {
        console.warn('⚠️ WhatsApp alert skipped: Twilio credentials are not configured.');
        return { status: 'skipped' };
    }

    try {
        const isUpper = condition === 'ABOVE';
        const direction = isUpper ? 'yukarı çıktı' : 'aşağı düştü';
        const money = (value: number) => value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USD';

        const messageBody = `🔔 OpenStock Fiyat Uyarısı\n\n${symbol} şu an ${money(currentPrice)} (${direction})\nHedef fiyatınız: ${money(targetPrice)}\n\nOpenStock ile takip etmeye devam edin.`;

        const message = await twilioClient.messages.create({
            body: messageBody,
            from: WATSAPP_FROM,
            to: WATSAPP_TO,
        });

        console.log('✅ WhatsApp alert sent successfully:', message.sid);
        return { status: 'sent', messageId: message.sid };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Failed to send WhatsApp alert:', message);
        return { status: 'skipped', error: message };
    }
}
