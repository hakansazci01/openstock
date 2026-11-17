/**
 * In-app signal alert store.
 *
 * Lives in the browser: alerts survive reloads, sync across tabs, and are capped
 * so localStorage cannot grow without bound. Every mutation notifies subscribers.
 */

export type StockSignal = 'AL' | 'SAT' | 'BEKLE';

export type SignalAlert = {
    id: string;
    symbol: string;
    signal: StockSignal;
    price: number;
    reason: string;
    timestamp: number;
    read: boolean;
    source?: 'watchlist' | 'stock' | 'bot';
};

const STORAGE_KEY = 'openstock-signal-alerts-v1';
const MAX_ALERTS = 80;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

let alerts: SignalAlert[] = [];
let hydrated = false;
let listeners: Array<(alerts: SignalAlert[]) => void> = [];
let listeningToStorage = false;

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const sortAlerts = (items: SignalAlert[]) => [...items].sort((a, b) => b.timestamp - a.timestamp);

function notifyListeners() {
    const current = getSignalAlerts();
    listeners.forEach((listener) => listener(current));
}

function persist() {
    if (!hasWindow()) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(0, MAX_ALERTS)));
    } catch {
        /* storage full or disabled: alerts still work for this page */
    }
}

/** Reads persisted alerts once per page load. Safe to call from effects. */
export function hydrateSignalAlerts(): SignalAlert[] {
    if (!hasWindow()) return [];
    if (hydrated) return getSignalAlerts();

    hydrated = true;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                alerts = parsed
                    .filter((item): item is SignalAlert => Boolean(item) && typeof item === 'object')
                    .filter((item) => typeof item.id === 'string' && typeof item.symbol === 'string')
                    .slice(0, MAX_ALERTS);
            }
        }
    } catch {
        alerts = [];
    }

    if (!listeningToStorage) {
        listeningToStorage = true;
        window.addEventListener('storage', (event) => {
            if (event.key !== STORAGE_KEY || !event.newValue) return;
            try {
                const parsed: unknown = JSON.parse(event.newValue);
                if (Array.isArray(parsed)) alerts = parsed as SignalAlert[];
                notifyListeners();
            } catch {
                /* ignore malformed cross-tab payloads */
            }
        });
    }

    notifyListeners();
    return getSignalAlerts();
}

export function getSignalAlerts(): SignalAlert[] {
    return sortAlerts(alerts);
}

export function getUnreadCount(): number {
    return alerts.filter((alert) => !alert.read).length;
}

export function addSignalAlert(alert: Omit<SignalAlert, 'id' | 'timestamp' | 'read'> & { timestamp?: number }) {
    if (!hasWindow()) return null;

    const timestamp = alert.timestamp ?? Date.now();
    const duplicate = alerts.find(
        (item) =>
            item.symbol === alert.symbol &&
            item.signal === alert.signal &&
            Math.abs(item.timestamp - timestamp) < DEDUPE_WINDOW_MS,
    );
    if (duplicate) return duplicate;

    const newAlert: SignalAlert = {
        ...alert,
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${timestamp}-${Math.random().toString(36).slice(2)}`,
        timestamp,
        read: false,
    };

    alerts = [newAlert, ...alerts].slice(0, MAX_ALERTS);
    persist();
    notifyListeners();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(newAlert.signal === 'AL' ? `🟢 AL SİNYALİ · ${newAlert.symbol}` : `🔴 SAT SİNYALİ · ${newAlert.symbol}`, {
                body: `${newAlert.price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}\n${newAlert.reason}`.trim(),
                icon: '/assets/icons/star.svg',
                tag: `openstock-${newAlert.symbol}-${newAlert.signal}`,
            });
        } catch {
            /* notifications can throw in unsupported contexts */
        }
    }

    return newAlert;
}

export function markAlertAsRead(id: string) {
    const alert = alerts.find((item) => item.id === id);
    if (!alert) return;
    alert.read = true;
    persist();
    notifyListeners();
}

export function markAllAlertsAsRead() {
    alerts.forEach((alert) => {
        alert.read = true;
    });
    persist();
    notifyListeners();
}

export function removeAlert(id: string) {
    alerts = alerts.filter((alert) => alert.id !== id);
    persist();
    notifyListeners();
}

export function clearAllAlerts() {
    alerts = [];
    persist();
    notifyListeners();
}

export function subscribe(listener: (alerts: SignalAlert[]) => void) {
    listeners.push(listener);
    // Do not force hydration during render; components call hydrate in an effect.
    listener(getSignalAlerts());
    return () => {
        listeners = listeners.filter((item) => item !== listener);
    };
}
