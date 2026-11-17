import { NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { isRateLimited } from '@/lib/rate-limit';

const PORTFOLIO_LIMIT = 30;

interface PortfolioInput {
    symbol: string;
    company: string;
    quantity: number;
    averagePrice: number;
    exchange?: string;
}

export const dynamic = 'force-dynamic';

export async function GET() {
    let session: { user: { id: string } } | null = null;
    try {
        session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`portfolio:user:${session.user.id}`, PORTFOLIO_LIMIT, 60, 1)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        await connectToDatabase();
        const positions = await Portfolio.find({ userId: session.user.id }).lean();
        return NextResponse.json({ positions });
    } catch (err) {
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function POST(req: Request) {
    let session: { user: { id: string } } | null = null;
    try {
        session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`portfolio:user:${session.user.id}`, PORTFOLIO_LIMIT, 60, 1)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const body: PortfolioInput = await req.json();

        if (!body.symbol || !body.company || !body.quantity || !body.averagePrice) {
            return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });
        }

        await connectToDatabase();

        const position = await Portfolio.findOneAndUpdate(
            { userId: session.user.id, symbol: body.symbol.toUpperCase() },
            {
                $set: {
                    company: body.company,
                    quantity: body.quantity,
                    averagePrice: body.averagePrice,
                    exchange: body.exchange,
                },
                $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ).lean();

        return NextResponse.json({ position }, { status: 201 });
    } catch (err) {
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    let session: { user: { id: string } } | null = null;
    try {
        session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }

        if (await isRateLimited(`portfolio:user:${session.user.id}`, PORTFOLIO_LIMIT, 60, 1)) {
            return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get('symbol');

        if (!symbol) {
            return NextResponse.json({ error: 'Sembol gerekli' }, { status: 400 });
        }

        await connectToDatabase();

        await Portfolio.deleteOne({ userId: session.user.id, symbol: symbol.toUpperCase() });

        return NextResponse.json({ success: true });
    } catch (err) {
        if (!session?.user) {
            return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 });
        }
        return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
}