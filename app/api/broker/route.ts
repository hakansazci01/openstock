import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import {
    getBrokerSummary,
    markBrokerConnected,
    saveBrokerCredentials,
    verifyBrokerConnection,
} from '@/lib/broker/broker.service';
import { isSupportedBroker, isLiveTradingEnabled, normalizeBrokerUrl } from '@/lib/broker/registry';

export const dynamic = 'force-dynamic';

/**
 * Returns broker status only. API keys and secrets never leave the server.
 */
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        const credentials = await getBrokerSummary();
        return NextResponse.json({
            credentials,
            liveTradingEnabled: isLiveTradingEnabled(),
        });
    } catch (err) {
        console.error('Broker GET error:', err);
        return NextResponse.json({ error: 'Broker bilgileri alınamadı' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        if (await isRateLimited(`broker:save:${session.user.id}`, 10, 60, 1)) {
            return NextResponse.json({ error: 'Çok fazla istek, biraz sonra deneyin' }, { status: 429 });
        }

        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) {
            return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
        }

        const { broker, apiKey, apiSecret, apiUrl } = body;

        if (!isSupportedBroker(broker)) {
            return NextResponse.json({ error: 'Desteklenmeyen broker. Yalnızca alpaca ve binance kullanılabilir.' }, { status: 400 });
        }
        if (typeof apiKey !== 'string' || !apiKey.trim() || typeof apiSecret !== 'string' || !apiSecret.trim()) {
            return NextResponse.json({ error: 'API key ve API secret zorunludur' }, { status: 400 });
        }

        // Validate/normalise before saving so an unsupported host is rejected.
        const normalizedUrl = normalizeBrokerUrl(broker, typeof apiUrl === 'string' ? apiUrl : undefined);

        const saved = await saveBrokerCredentials({
            broker,
            apiKey,
            apiSecret,
            apiUrl: normalizedUrl,
        });

        const verification = await verifyBrokerConnection({
            broker,
            apiKey: apiKey.trim(),
            apiSecret: apiSecret.trim(),
            apiUrl: normalizedUrl,
        });

        await markBrokerConnected(session.user.id, verification.connected);
        const credentials = await getBrokerSummary();

        return NextResponse.json({
            success: true,
            connected: verification.connected,
            error: verification.connected ? undefined : verification.error,
            credentials,
            liveTradingEnabled: isLiveTradingEnabled(),
            warning: saved.isLive && !isLiveTradingEnabled()
                ? 'Canlı (gerçek para) endpoint kaydedildi ancak LIVE_TRADING_ENABLED=true olmadığı için emir gönderilemez.'
                : undefined,
        });
    } catch (err) {
        console.error('Broker POST error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Broker bilgileri kaydedilemedi' },
            { status: 400 },
        );
    }
}
