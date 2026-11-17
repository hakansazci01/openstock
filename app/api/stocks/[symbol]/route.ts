import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/better-auth/auth";
import { getLiveQuotes } from "@/lib/actions/finnhub.actions";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ symbol: string }> }
) {
    try {
        await requireUserId();
        const { symbol } = await params;

        const quotes = await getLiveQuotes([symbol.toUpperCase()]);
        const quote = quotes[symbol.toUpperCase()];

        if (!quote) {
            return NextResponse.json({ error: "Quote not found" }, { status: 404 });
        }

        return NextResponse.json({ symbol: symbol.toUpperCase(), ...quote });
    } catch {
        return NextResponse.json({ error: "Unauthorized or failed" }, { status: 401 });
    }
}