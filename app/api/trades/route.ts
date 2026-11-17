import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { isRateLimited } from '@/lib/rate-limit';
import { connectToDatabase } from '@/database/mongoose';
import { Trade } from '@/database/models/trade.model';

export const dynamic = 'force-dynamic';

/**
 * GET /api/trades - Kullanıcının işlem geçmişini döndürür
 * Query: ?symbol=...&status=...&limit=...&page=...
 */
export async function GET(req: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 401 });
        }

        if (await isRateLimited(`trades:list:${session.user.id}`, 30, 60, 1)) {
            return NextResponse.json({ error: 'Çok fazla istek' }, { status: 429 });
        }

        await connectToDatabase();

        const { searchParams } = new URL(req.url);
        const symbol = (searchParams.get('symbol') ?? '').toUpperCase().trim();
        const status = searchParams.get('status') ?? '';
        const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
        const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = { userId: session.user.id };
        if (symbol) filter.symbol = symbol;
        if (status) filter.status = status;

        const [trades, total] = await Promise.all([
            Trade.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Trade.countDocuments(filter),
        ]);

        // Hassas olmayan alanları döndür
        const sanitized = trades.map((t) => ({
            id: t._id.toString(),
            broker: t.broker,
            brokerOrderId: t.brokerOrderId,
            symbol: t.symbol,
            side: t.side,
            type: t.type,
            quantity: t.quantity,
            limitPrice: t.limitPrice,
            stopPrice: t.stopPrice,
            filledQuantity: t.filledQuantity,
            averagePrice: t.averagePrice,
            notional: t.notional,
            fee: t.fee,
            status: t.status,
            source: t.source,
            botId: t.botId?.toString(),
            errorMessage: t.errorMessage,
            executedAt: t.executedAt,
            createdAt: t.createdAt,
        }));

        return NextResponse.json({
            trades: sanitized,
            pagination: { total, page, limit, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error('Trades GET error:', err);
        return NextResponse.json(
            { error: 'İşlem geçmişi alınamadı' },
            { status: 500 }
        );
    }
}