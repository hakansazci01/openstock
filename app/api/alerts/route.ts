import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/better-auth/auth";
import { isRateLimited } from "@/lib/rate-limit";
import { createAlert, getUserAlerts, deleteAlert } from "@/lib/actions/alert.actions";

const ALERTS_LIMIT = 20; // 20 istek / dakika

export async function GET(_req: NextRequest) {
    void _req;
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (await isRateLimited(`alerts:user:${session.user.id}`, ALERTS_LIMIT, 60, 1)) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const alerts = await getUserAlerts();
        return NextResponse.json({ alerts });
    } catch {
        return NextResponse.json({ error: "Unauthorized or failed" }, { status: 401 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (await isRateLimited(`alerts:user:${session.user.id}`, ALERTS_LIMIT, 60, 1)) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const body = await req.json();
        const { symbol, targetPrice, condition } = body;

        if (!symbol || !targetPrice || !condition) {
            return NextResponse.json({ error: "symbol, targetPrice, and condition are required" }, { status: 400 });
        }

        const result = await createAlert({ symbol, targetPrice, condition });
        return NextResponse.json(result, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create alert" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        if (await isRateLimited(`alerts:user:${session.user.id}`, ALERTS_LIMIT, 60, 1)) {
            return NextResponse.json({ error: "Too many requests" }, { status: 429 });
        }

        const { searchParams } = new URL(req.url);
        const alertId = searchParams.get("alertId");

        if (!alertId) {
            return NextResponse.json({ error: "alertId is required" }, { status: 400 });
        }

        await deleteAlert(alertId);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to delete alert" }, { status: 500 });
    }
}