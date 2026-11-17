import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/better-auth/auth';
import { getStockSignal } from '@/lib/actions/finnhub.actions';
import { calculateProfessionalSignal } from '@/lib/technical-analysis';
import { isRateLimited } from '@/lib/rate-limit';

const MAX_SYMBOLS = 12;
const SYMBOL_PATTERN = /^[A-Z0-9.:\-]{1,20}$/;
const CACHE_TTL_MS = 5 * 60 * 1000;

type SignalPayload = {
    symbol: string;
    signal: 'AL' | 'SAT' | 'BEKLE';
    price: number;
    confidence: number;
    reason: string;
};

// Candles cost one Finnhub request each, so computed signals are cached per symbol
// for five minutes and shared by every tab of the dev process.
const cache = new Map<string, { at: number; payload: SignalPayload }>();

async function signalFor(symbol: string): Promise<SignalPayload | null> {
    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.payload;

    try {
        const { quote, candles } = await getStockSignal(symbol);
        if (!quote?.c) return null;

        let payload: SignalPayload;
        if (Array.isArray(candles) && candles.length >= 50) {
            const analysis = calculateProfessionalSignal(candles, quote.c);
            payload = {
                symbol,
                signal: analysis.signal,
                price: quote.c,
                confidence: analysis.confidence,
                reason: analysis.indicators.map((item) => item.reason).filter(Boolean).slice(0, 2).join(' · ') || 'Teknik analiz',
            };
        } else {
            // No daily candles (BIST, crypto): fall back to the day change.
            const dp = Number(quote.dp ?? 0);
            const signal = dp <= -3 ? 'AL' : dp >= 3 ? 'SAT' : 'BEKLE';
            payload = {
                symbol,
                signal,
                price: quote.c,
                confidence: signal === 'BEKLE' ? 0 : 30,
                reason: `Günlük değişim ${dp >= 0 ? '+' : ''}${dp.toFixed(2)}%`,
            };
        }

        cache.set(symbol, { at: Date.now(), payload });
        return payload;
    } catch {
        return null;
    }
}

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const symbols = [...new Set(
        (req.nextUrl.searchParams.get('symbols') ?? '')
            .split(',')
            .map((value) => value.trim().toUpperCase())
            .filter((value) => SYMBOL_PATTERN.test(value)),
    )].slice(0, MAX_SYMBOLS);

    if (symbols.length === 0) return NextResponse.json({ signals: {} });

    if (await isRateLimited(`signals:user:${session.user.id}`, 60, 60, symbols.length)) {
        return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const results = await Promise.all(symbols.map((symbol) => signalFor(symbol)));
    const signals: Record<string, SignalPayload> = {};
    results.forEach((payload) => {
        if (payload) signals[payload.symbol] = payload;
    });

    return NextResponse.json(
        { signals, at: Date.now() },
        { headers: { 'Cache-Control': 'private, max-age=30' } },
    );
}
