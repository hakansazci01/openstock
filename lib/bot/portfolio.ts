/**
 * Paper trading portfolio maths.
 *
 * Kept pure (no Mongoose, no network) so it can be unit-tested and reused by the
 * bot engine, the bot pages and the API routes. `currentCapital` on a bot is the
 * equity (cash + open positions), while `cash` is the free balance.
 */

export type TradeLike = {
    side: 'buy' | 'sell';
    symbol: string;
    price: number;
    quantity: number;
    total?: number;
    pnl?: number;
};

export type Position = {
    symbol: string;
    quantity: number;
    avgCost: number;
    marketPrice: number;
    marketValue: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
};

export type EquityPoint = { at: number; equity: number };

export type PortfolioSnapshot = {
    initialCapital: number;
    cash: number;
    invested: number;
    equity: number;
    positions: Position[];
    realizedPnl: number;
    unrealizedPnl: number;
    totalReturn: number;
    totalReturnPercent: number;
    wins: number;
    losses: number;
    winRate: number;
    maxDrawdown: number;
    equityCurve: EquityPoint[];
};

const safe = (value: unknown, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

/** Total value of a trade, falling back to price × quantity when `total` is missing. */
const tradeValue = (trade: TradeLike) => {
    const total = safe(trade.total);
    if (total > 0) return total;
    return safe(trade.price) * safe(trade.quantity);
};

/**
 * Replays trades in chronological order and values the result.
 * `marks` maps a symbol to its latest price; missing marks fall back to average cost.
 */
export function computePortfolio(
    initialCapital: number,
    trades: TradeLike[],
    marks: Record<string, number> = {},
): PortfolioSnapshot {
    const start = Math.max(0, safe(initialCapital));
    let cash = start;
    let realizedPnl = 0;
    let wins = 0;
    let losses = 0;
    let peak = start;
    let maxDrawdown = 0;

    const holdings = new Map<string, { quantity: number; avgCost: number }>();
    const equityCurve: EquityPoint[] = [{ at: 0, equity: start }];

    const equityAt = (priceOf: (symbol: string) => number) => {
        let invested = 0;
        for (const [symbol, position] of holdings) {
            if (position.quantity > 0) invested += position.quantity * priceOf(symbol);
        }
        return cash + invested;
    };

    trades.forEach((trade, index) => {
        const price = safe(trade.price);
        if (price <= 0) return;

        if (trade.side === 'buy') {
            const quantity = Math.max(0, safe(trade.quantity));
            if (quantity <= 0) return;
            const value = tradeValue(trade);
            if (value > cash + 1e-9) {
                // A buy can never be funded with money the bot does not have.
                return;
            }
            const current = holdings.get(trade.symbol) ?? { quantity: 0, avgCost: 0 };
            const newQuantity = current.quantity + quantity;
            const newAvgCost = newQuantity > 0
                ? (current.avgCost * current.quantity + price * quantity) / newQuantity
                : price;
            holdings.set(trade.symbol, { quantity: newQuantity, avgCost: newAvgCost });
            cash -= value;
        } else {
            const current = holdings.get(trade.symbol);
            if (!current || current.quantity <= 0) return;
            const quantity = Math.min(Math.max(0, safe(trade.quantity)), current.quantity);
            if (quantity <= 0) return;
            const value = tradeValue(trade) || price * quantity;
            const pnl = Number.isFinite(Number(trade.pnl))
                ? safe(trade.pnl)
                : (price - current.avgCost) * quantity;

            cash += value;
            realizedPnl += pnl;
            if (pnl > 0) wins += 1;
            else if (pnl < 0) losses += 1;

            const remaining = current.quantity - quantity;
            if (remaining <= 1e-9) holdings.delete(trade.symbol);
            else holdings.set(trade.symbol, { quantity: remaining, avgCost: current.avgCost });
        }

        const equity = equityAt((symbol) => (symbol === trade.symbol ? price : marks[symbol] ?? holdings.get(symbol)?.avgCost ?? 0));
        peak = Math.max(peak, equity);
        if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
        equityCurve.push({ at: index + 1, equity });
    });

    const positions: Position[] = [];
    let invested = 0;
    for (const [symbol, position] of holdings) {
        if (position.quantity <= 0) continue;
        const marketPrice = safe(marks[symbol], position.avgCost) || position.avgCost;
        const marketValue = position.quantity * marketPrice;
        invested += marketValue;
        positions.push({
            symbol,
            quantity: position.quantity,
            avgCost: position.avgCost,
            marketPrice,
            marketValue,
            unrealizedPnl: (marketPrice - position.avgCost) * position.quantity,
            unrealizedPnlPercent: position.avgCost > 0 ? ((marketPrice - position.avgCost) / position.avgCost) * 100 : 0,
        });
    }

    positions.sort((a, b) => b.marketValue - a.marketValue);

    const equity = cash + invested;
    const totalReturn = equity - start;
    const closedTrades = wins + losses;

    if (equityCurve.length > 0) {
        equityCurve[equityCurve.length - 1] = { at: equityCurve.length, equity };
        peak = Math.max(peak, equity);
        if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    }

    return {
        initialCapital: start,
        cash,
        invested,
        equity,
        positions,
        realizedPnl,
        unrealizedPnl: invested - positions.reduce((sum, p) => sum + p.avgCost * p.quantity, 0),
        totalReturn,
        totalReturnPercent: start > 0 ? (totalReturn / start) * 100 : 0,
        wins,
        losses,
        winRate: closedTrades > 0 ? (wins / closedTrades) * 100 : 0,
        maxDrawdown: maxDrawdown * 100,
        equityCurve,
    };
}

/** Percent of equity to allocate to one new position (defaults to 20%, capped at 100%). */
export function positionSizePercent(config: Record<string, unknown> | undefined | null): number {
    const raw = safe((config as Record<string, unknown> | undefined)?.positionSizePercent, 20);
    return Math.min(100, Math.max(1, raw));
}
