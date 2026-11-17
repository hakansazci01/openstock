import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/better-auth/auth";
import { connectToDatabase } from "@/database/mongoose";

export async function GET(_req: NextRequest) {
    void _req;
    try {
        const userId = await requireUserId();
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;

        if (!db) {
            return NextResponse.json({ error: "Database connection not found" }, { status: 500 });
        }

        const user = await db.collection("user").findOne(
            { id: userId },
            { projection: { password: 0 } }
        );

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: "Unauthorized or failed" }, { status: 401 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const userId = await requireUserId();
        const body = await req.json();
        const { country, investmentGoals, riskTolerance, preferredIndustry, name } = body;

        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;

        if (!db) {
            return NextResponse.json({ error: "Database connection not found" }, { status: 500 });
        }

        const updateFields: Record<string, unknown> = {};
        if (country !== undefined) updateFields.country = country;
        if (investmentGoals !== undefined) updateFields.investmentGoals = investmentGoals;
        if (riskTolerance !== undefined) updateFields.riskTolerance = riskTolerance;
        if (preferredIndustry !== undefined) updateFields.preferredIndustry = preferredIndustry;
        if (name !== undefined) updateFields.name = name;

        await db.collection("user").updateOne(
            { id: userId },
            { $set: updateFields }
        );

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }
}