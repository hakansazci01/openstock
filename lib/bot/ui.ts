/** Shared labels/classes for the bot UI (server and client components). */

export const BOT_STATUS_LABELS: Record<string, string> = {
    running: 'Çalışıyor',
    paused: 'Duraklatıldı',
    stopped: 'Durdu',
    draft: 'Taslak',
    error: 'Hata',
};

export const BOT_STATUS_CLASSES: Record<string, string> = {
    running: 'bg-up/10 text-up border border-up/20',
    paused: 'bg-warn/10 text-warn border border-warn/20',
    stopped: 'bg-down/10 text-down border border-down/20',
    draft: 'bg-hover text-faint border border-line',
    error: 'bg-down/10 text-down border border-down/20',
};

export const STRATEGY_LABELS: Record<string, string> = {
    sma_cross: 'SMA Kesişimi',
    rsi_oversold: 'RSI Aşırı Alım/Satım',
    macd_cross: 'MACD Kesişimi',
    price_threshold: 'Fiyat Eşiği',
    custom: 'Özel Kural',
};

export const BOT_TYPE_LABELS: Record<string, string> = {
    signal: 'Sinyal Botu',
    paper: 'Paper Trading',
    live: 'Canlı (Gerçek Para)',
};

export const statusLabel = (status: string) => BOT_STATUS_LABELS[status] ?? status;
export const statusClass = (status: string) => BOT_STATUS_CLASSES[status] ?? BOT_STATUS_CLASSES.draft;
export const strategyLabel = (strategy: string) => STRATEGY_LABELS[strategy] ?? strategy.replace(/_/g, ' ');

export const money = (value: number | null | undefined, currency = 'USD') => {
    const n = Number(value);
    return Number.isFinite(n)
        ? n.toLocaleString('tr-TR', { style: 'currency', currency, maximumFractionDigits: 2 })
        : '—';
};

export const percent = (value: number | null | undefined, digits = 2) => {
    const n = Number(value);
    return Number.isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%` : '—';
};

export const dateTime = (value?: string | Date | null) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR');
};
