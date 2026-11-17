import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import { getBrokerCredentials, updateBrokerLastSynced } from '@/lib/broker/broker.service';
import {
    createBrokerAdapter,
    normalizeBrokerUrl,
    type SupportedBroker,
} from '@/lib/broker/registry';

export const dynamic = 'force-dynamic';

/**
 * Sync broker account data: account info, positions, orders.
 * Read-only: reading a live account is allowed even when live trading is off.
 */
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`broker:sync:${session.user.id}`, 10, 60, 1)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const creds = await getBrokerCredentials();
        if (!creds || !creds.apiKey || !creds.apiSecret) {
            return NextResponse.json({ error: 'Broker kimlik bilgileri yapılandırılmamış' }, { status: 400 });
        }
        if (!creds.isConnected) {
            return NextResponse.json({ error: 'Broker bağlantısı doğrulanmamış' }, { status: 400 });
        }

        const broker = creds.broker as SupportedBroker;
        const apiUrl = normalizeBrokerUrl(broker, creds.apiUrl);

        const adapter = createBrokerAdapter(broker);
        if (!adapter) {
            return NextResponse.json({ error: `${broker} adaptörü desteklenmiyor` }, { status: 501 });
        }

        const connected = await adapter.connect(creds.apiKey, creds.apiSecret, apiUrl);
        if (!connected) {
            return NextResponse.json({ error: 'Broker bağlantısı kurulamadı' }, { status: 400 });
        }

        const synced = await adapter.sync();
        await updateBrokerLastSynced(creds.id);

        return NextResponse.json({
            success: true,
            account: synced.account,
            positions: synced.positions,
            orders: synced.orders,
            syncedAt: new Date(),
        });
    } catch (err) {
        console.error('Broker sync error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Broker senkronizasyonu başarısız' },
            { status: 400 },
        );
    }
}
