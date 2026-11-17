import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import {
    activateKillSwitch,
    deactivateKillSwitch,
    getTradingState,
} from '@/lib/trading/kill-switch';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trading/kill-switch - Mevcut trading durumunu döndürür
 */
export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        const state = await getTradingState(session.user.id);
        return NextResponse.json(state);
    } catch (err) {
        console.error('Kill switch GET error:', err);
        return NextResponse.json(
            { error: 'Trading durumu alınamadı' },
            { status: 500 }
        );
    }
}

/**
 * POST /api/trading/kill-switch - Kill switch'i aktive veya devre dışı bırakır
 * Body: { action: 'activate' | 'deactivate', reason?: string }
 */
export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        if (await isRateLimited(`trading:kill-switch:${session.user.id}`, 5, 60, 1)) {
            return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 });
        }

        const body = await req.json().catch(() => null) as Record<string, unknown> | null;
        if (!body) {
            return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 });
        }

        const action = String(body.action ?? '');
        if (action !== 'activate' && action !== 'deactivate') {
            return NextResponse.json(
                { error: "action 'activate' veya 'deactivate' olmalı" },
                { status: 400 }
            );
        }

        if (action === 'activate') {
            const reason = typeof body.reason === 'string' && body.reason.trim()
                ? body.reason.trim()
                : 'Kullanıcı tarafından aktive edildi';
            await activateKillSwitch(session.user.id, reason);
            return NextResponse.json({ success: true, action: 'activated', reason });
        } else {
            await deactivateKillSwitch(session.user.id);
            return NextResponse.json({ success: true, action: 'deactivated' });
        }
    } catch (err) {
        console.error('Kill switch POST error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Kill switch işlemi başarısız' },
            { status: 500 }
        );
    }
}