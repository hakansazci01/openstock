import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health - Sistem sağlık kontrolü (load balancer, monitoring için)
 */
export async function GET() {
    const checks: Record<string, boolean> = {};
    let overall = true;

    // MongoDB bağlantı kontrolü
    try {
        await connectToDatabase();
        checks.database = true;
    } catch {
        checks.database = false;
        overall = false;
    }

    // Zorunlu ortam değişkenleri kontrolü
    checks.encryptionKey = Boolean(process.env.ENCRYPTION_MASTER_KEY);
    checks.authSecret = Boolean(process.env.BETTER_AUTH_SECRET);
    checks.mongodbUri = Boolean(process.env.MONGODB_URI);

    if (!checks.encryptionKey || !checks.authSecret || !checks.mongodbUri) {
        overall = false;
    }

    return NextResponse.json(
        {
            status: overall ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            checks,
        },
        { status: overall ? 200 : 503 }
    );
}