type NotificationPermission = 'granted' | 'denied' | 'default';

let hasRequested = false;

export function isNotificationSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
    if (!isNotificationSupported()) return 'denied';
    return Notification.permission as NotificationPermission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
    if (!isNotificationSupported()) return 'denied';
    if (hasRequested) return getNotificationPermission();
    hasRequested = true;
    const permission = await Notification.requestPermission();
    return permission as NotificationPermission;
}

export function showStockNotification({
    symbol,
    signal,
    currentPrice,
    condition,
}: {
    symbol: string;
    signal: 'AL' | 'SAT' | 'BEKLE';
    currentPrice: number;
    _targetPrice?: number;
    condition?: 'ABOVE' | 'BELOW';
}): void {
    if (!isNotificationSupported()) return;
    if (getNotificationPermission() !== 'granted') return;

    const isBuy = signal === 'AL';
    const isSell = signal === 'SAT';

    if (!isBuy && !isSell) return; // Only notify on AL or SAT

    const title = isBuy ? '🟢 AL SİNYALİ' : '🔴 SAT SİNYALİ';
    const body = `${symbol} fiyatı: ${currentPrice.toLocaleString('tr-TR', { style: 'currency', currency: 'USD' })}\nSinyal: ${signal}\n${condition === 'ABOVE' ? 'Hedef fiyatın üzerine çıktı' : condition === 'BELOW' ? 'Hedef fiyatın altına düştü' : ''}`;

    const notification = new Notification(title, {
        body,
        icon: '/assets/images/logo.png',
        tag: `stock-signal-${symbol}-${signal}`,
        requireInteraction: true,
        silent: false,
    });

    // Auto-close after 10 seconds
    setTimeout(() => notification.close(), 10000);
}
