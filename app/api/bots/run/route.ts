import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import { runAllBotsWithBroker } from '@/lib/bot/broker-execution';

export const dynamic = 'force-dynamic';

/**
 * Runs the signed-in user's live bots only. There is intentionally no
 * unauthenticated/scheduler path here; Inngest calls the engine directly.
 */
export async function POST() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`bots:run:${session.user.id}`, 3, 60, 1)) {
            return NextResponse.json({ error: 'Çok fazla çalıştırma isteği, biraz sonra deneyin' }, { status: 429 });
        }

        const results = await runAllBotsWithBroker(session.user.id);
        return NextResponse.json({
            success: true,
            executed: results.length,
            successful: results.filter((result) => result.success).length,
            results,
        });
    } catch (err) {
        console.error('Bot run error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Botlar çalıştırılamadı' },
            { status: 400 },
        );
    }
}
