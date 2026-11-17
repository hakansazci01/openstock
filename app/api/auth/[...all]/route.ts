import { auth } from "@/lib/better-auth/auth";
import { logError } from "@/lib/logger";

export const GET = async (request: Request) => {
    try {
        return await auth.handler(request);
    } catch (e) {
        logError("Auth GET error", e);
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};

export const POST = async (request: Request) => {
    try {
        return await auth.handler(request);
    } catch (e) {
        logError("Auth POST error", e);
        return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
};
