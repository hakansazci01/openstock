import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/better-auth/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { addToWatchlist, removeFromWatchlist, getUserWatchlist, isStockInWatchlist } from "@/lib/actions/watchlist.actions";

const WATCHLIST_LIMIT = 30; // 30 istek / dakika

export async function GET(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (await isRateLimited(`watchlist:user:${session.user.id}`, WATCHLIST_LIMIT, 60, 1)) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get("symbol");

        if (symbol) {
            const inWatchlist = await isStockInWatchlist(symbol);
            return NextResponse.json({ inWatchlist });
        }

        const watchlist = await getUserWatchlist();
        return NextResponse.json({ watchlist });
    } catch {
        return NextResponse.json({ error: "Unauthorized or failed" }, { status: 401 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (await isRateLimited(`watchlist:user:${session.user.id}`, WATCHLIST_LIMIT, 60, 1)) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await req.json();
        const { symbol, company } = body;

        if (!symbol || !company) {
            return NextResponse.json({ error: "symbol and company are required" }, { status: 400 });
        }

        const result = await addToWatchlist(symbol, company);
        return NextResponse.json(result, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (await isRateLimited(`watchlist:user:${session.user.id}`, WATCHLIST_LIMIT, 60, 1)) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const symbol = searchParams.get("symbol");

        if (!symbol) {
            return NextResponse.json({ error: "symbol is required" }, { status: 400 });
        }

        await removeFromWatchlist(symbol);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 });
    }
}