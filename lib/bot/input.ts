/**
 * Validation for bot create/update payloads.
 *
 * The API accepts both JSON (the client form) and form-encoded posts (older
 * bookmarks, curl, the `action` attribute fallback), so everything is coerced
 * here before it reaches Mongoose.
 */

export const STRATEGIES = ['sma_cross', 'rsi_oversold', 'macd_cross', 'price_threshold', 'custom'] as const;
export const BOT_TYPES = ['signal', 'paper', 'live'] as const;

export type StrategyId = (typeof STRATEGIES)[number];
export type BotTypeId = (typeof BOT_TYPES)[number];

const SYMBOL_PATTERN = /^[A-Z0-9][A-Z0-9.^=:_-]{0,19}$/;
const MAX_SYMBOLS = 20;

export type NormalizedBotInput = {
    name: string;
    description: string;
    type: BotTypeId;
    strategy: StrategyId;
    strategyConfig: Record<string, number>;
    symbols: string[];
    exchange: string;
    initialCapital: number;
    intervalMinutes: number;
};

export class BotInputError extends Error {
    field?: string;
    constructor(message: string, field?: string) {
        super(message);
        this.name = 'BotInputError';
        this.field = field;
    }
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Parses a JSON body or a form body, returning a plain object. */
export async function readRequestBody(req: Request): Promise<Record<string, unknown>> {
    const contentType = (req.headers.get('content-type') ?? '').toLowerCase();

    if (contentType.includes('application/json')) {
        const json = await req.json().catch(() => null);
        return asRecord(json);
    }

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const form = await req.formData().catch(() => null);
        if (!form) return {};
        const out: Record<string, unknown> = {};
        for (const [key, value] of form.entries()) {
            if (typeof value === 'string') out[key] = value;
        }
        return out;
    }

    // No/unknown content type: try JSON, then fall back to an empty body.
    const text = await req.text().catch(() => '');
    if (!text) return {};
    try {
        return asRecord(JSON.parse(text));
    } catch {
        return Object.fromEntries(new URLSearchParams(text).entries());
    }
}

export function normalizeSymbols(value: unknown): string[] {
    const raw = Array.isArray(value)
        ? value.map((item) => String(item))
        : String(value ?? '').split(/[\s,;]+/);

    const seen = new Set<string>();
    const symbols: string[] = [];
    for (const item of raw) {
        const symbol = item.trim().toUpperCase();
        if (!symbol) continue;
        if (!SYMBOL_PATTERN.test(symbol)) {
            throw new BotInputError(`Geçersiz sembol: ${symbol}`, 'symbols');
        }
        if (seen.has(symbol)) continue;
        seen.add(symbol);
        symbols.push(symbol);
    }

    if (symbols.length === 0) throw new BotInputError('En az bir sembol girin', 'symbols');
    if (symbols.length > MAX_SYMBOLS) throw new BotInputError(`En fazla ${MAX_SYMBOLS} sembol ekleyebilirsiniz`, 'symbols');
    return symbols;
}

export function normalizeStrategyConfig(strategy: StrategyId, value: unknown): Record<string, number> {
    const input = asRecord(value);
    const num = (key: string, fallback: number, min: number, max: number) => {
        const n = Number(input[key]);
        if (!Number.isFinite(n)) return fallback;
        return Math.min(max, Math.max(min, n));
    };

    // Risk fields are shared by every strategy. Live bots require a stop-loss,
    // which the execution engine enforces again before an order is sent.
    const risk = {
        positionSizePercent: num('positionSizePercent', 20, 1, 100),
        maxPositionPercent: num('maxPositionPercent', num('positionSizePercent', 20, 1, 100), 1, 100),
        stopLossPercent: num('stopLossPercent', 0, 0, 90),
        takeProfitPercent: num('takeProfitPercent', 0, 0, 1000),
    };

    switch (strategy) {
        case 'sma_cross':
            return {
                ...risk,
                fastPeriod: Math.round(num('fastPeriod', 10, 2, 200)),
                slowPeriod: Math.round(num('slowPeriod', 20, 3, 400)),
            };
        case 'rsi_oversold':
            return {
                ...risk,
                period: Math.round(num('period', 14, 2, 100)),
                oversold: num('oversold', 30, 1, 49),
                overbought: num('overbought', 70, 51, 99),
            };
        case 'macd_cross':
            return {
                ...risk,
                fastPeriod: Math.round(num('fastPeriod', 12, 2, 100)),
                slowPeriod: Math.round(num('slowPeriod', 26, 3, 200)),
                signalPeriod: Math.round(num('signalPeriod', 9, 2, 100)),
            };
        case 'price_threshold':
            return {
                ...risk,
                buyThreshold: num('buyThreshold', 0, 0, 1_000_000_000),
                sellThreshold: num('sellThreshold', 0, 0, 1_000_000_000),
                stopLoss: num('stopLoss', 0, 0, 1_000_000_000),
                takeProfit: num('takeProfit', 0, 0, 1_000_000_000),
            };
        case 'custom':
            // Custom rules are an array; the UI does not expose them yet, so keep the body as-is.
            return {
                ...risk,
                ...Object.fromEntries(
                    Object.entries(input)
                        .map(([key, item]) => [key, Number(item)])
                        .filter(([key, item]) => !Object.prototype.hasOwnProperty.call(risk, key) && Number.isFinite(item)),
                ),
            };
        default:
            return risk;
    }
}

export function normalizeBotInput(body: Record<string, unknown>): NormalizedBotInput {
    const name = String(body.name ?? '').trim();
    if (name.length < 2) throw new BotInputError('Bot adı en az 2 karakter olmalı', 'name');
    if (name.length > 60) throw new BotInputError('Bot adı en fazla 60 karakter olabilir', 'name');

    const description = String(body.description ?? '').trim().slice(0, 240);

    const requestedType = String(body.type ?? 'paper') as BotTypeId;
    const type: BotTypeId = BOT_TYPES.includes(requestedType) ? requestedType : 'paper';

    const strategy = String(body.strategy ?? 'sma_cross') as StrategyId;
    if (!STRATEGIES.includes(strategy)) throw new BotInputError('Geçersiz strateji', 'strategy');

    const symbols = normalizeSymbols(body.symbols);
    const exchange = String(body.exchange ?? 'BIST').trim().toUpperCase().slice(0, 12) || 'BIST';

    const initialCapital = Number(body.initialCapital ?? 10000);
    if (!Number.isFinite(initialCapital) || initialCapital < 100) {
        throw new BotInputError('Başlangıç sermayesi en az 100 olmalı', 'initialCapital');
    }
    if (initialCapital > 1_000_000_000) {
        throw new BotInputError('Başlangıç sermayesi çok büyük', 'initialCapital');
    }

    const intervalMinutes = Math.round(Number(body.intervalMinutes ?? 15));
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 1 || intervalMinutes > 1440) {
        throw new BotInputError('Çalışma aralığı 1 ile 1440 dakika arasında olmalı', 'intervalMinutes');
    }

    return {
        name,
        description,
        type,
        strategy,
        strategyConfig: normalizeStrategyConfig(strategy, body.strategyConfig),
        symbols,
        exchange,
        initialCapital: Math.round(initialCapital * 100) / 100,
        intervalMinutes,
    };
}
