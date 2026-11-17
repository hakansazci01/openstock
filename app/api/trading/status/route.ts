import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import { getTradingState } from '@/lib/trading/kill-switch';
import { loadCircuitBreakerConfig } from '@/lib/trading/circuit-breaker';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trading/status - Trading konfigürasyonu ve durumu
 */
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        if (await isRateLimited(`trading:status:${session.user.id}`, 30, 60, 1)) {
            return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 });
        }

        const state = await getTradingState(session.user.id);
        const config = loadCircuitBreakerConfig();

        return NextResponse.json({
            ...state,
            liveTradingEnabled: process.env.LIVE_TRADING_ENABLED === 'true',
            limits: config,
        });
    } catch (err) {
        console.error('Trading status error:', err);
        return NextResponse.json(
            { error: 'Trading durumu alınamadı' },
            { status: 500 }
        );
    }
}