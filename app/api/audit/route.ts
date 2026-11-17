import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { AuditLog } from '@/database/models/audit.log.model';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        await connectToDatabase();
        const logs = await AuditLog.find({ userId: session.user.id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        return NextResponse.json({ logs });
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}