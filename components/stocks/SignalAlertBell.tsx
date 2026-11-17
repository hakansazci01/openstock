'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing, BellOff, CheckCheck, Trash2, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    clearAllAlerts,
    getUnreadCount,
    hydrateSignalAlerts,
    markAlertAsRead,
    markAllAlertsAsRead,
    removeAlert,
    subscribe,
    type SignalAlert,
} from '@/lib/signal-alert-store';
import {
    getNotificationPermission,
    isNotificationSupported,
    requestNotificationPermission,
} from '@/lib/browser-notifications';
import { cn, formatPrice } from '@/lib/utils';

type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

const signalMeta = (signal: SignalAlert['signal']) =>
    signal === 'AL'
        ? { label: 'AL', title: 'Alım sinyali', className: 'border-up/25 bg-up/15 text-up' }
        : signal === 'SAT'
            ? { label: 'SAT', title: 'Satım sinyali', className: 'border-down/25 bg-down/15 text-down' }
            : { label: 'BEKLE', title: 'Bekle sinyali', className: 'border-line bg-hover text-faint' };

export function SignalAlertBell() {
    const [alerts, setAlerts] = useState<SignalAlert[]>([]);
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [permission, setPermission] = useState<PermissionState>('default');

    useEffect(() => {
        const stored = hydrateSignalAlerts();
        setAlerts(stored);
        setUnread(getUnreadCount());
        setPermission(
            isNotificationSupported()
                ? (getNotificationPermission() as PermissionState)
                : 'unsupported',
        );

        const unsubscribe = subscribe((list) => {
            setAlerts(list);
            setUnread(getUnreadCount());
        });
        return unsubscribe;
    }, []);

    const askPermission = async () => {
        const result = await requestNotificationPermission();
        setPermission(result as PermissionState);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="chrome-btn relative"
                    aria-label={unread > 0 ? `${unread} okunmamış sinyal uyarısı` : 'Sinyal uyarıları'}
                    title="Sinyal uyarıları"
                >
                    {unread > 0 ? <BellRing className="text-warn" /> : <Bell />}
                    {unread > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-down px-1 text-[9px] font-bold text-white">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-[min(380px,calc(100vw-1rem))] overflow-hidden p-0">
                <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
                    <div>
                        <p className="text-[13px] font-bold text-foreground">Sinyal Uyarıları</p>
                        <p className="text-[10.5px] text-faint">
                            {alerts.length === 0 ? 'Henüz uyarı yok' : `${alerts.length} uyarı · ${unread} okunmamış`}
                        </p>
                    </div>
                    {alerts.length > 0 && (
                        <button
                            type="button"
                            onClick={() => markAllAlertsAsRead()}
                            className="btn btn-ghost h-7 px-2 text-[11px]"
                            disabled={unread === 0}
                        >
                            <CheckCheck /> Okundu
                        </button>
                    )}
                </div>

                {permission === 'default' && (
                    <button
                        type="button"
                        onClick={askPermission}
                        className="flex w-full items-center gap-2 border-b border-line bg-brand-soft/40 px-3 py-2 text-left text-[11.5px] font-semibold text-brand-ink hover:bg-brand-soft"
                    >
                        <BellRing className="size-3.5" /> Tarayıcı bildirimlerini aç
                    </button>
                )}
                {permission === 'denied' && (
                    <p className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11px] text-faint">
                        <BellOff className="size-3.5" /> Tarayıcı bildirimleri engellenmiş. Adres çubuğundaki kilit simgesinden açabilirsiniz.
                    </p>
                )}

                {alerts.length === 0 ? (
                    <div className="empty-state px-4 py-8">
                        <span className="empty-icon"><Bell /></span>
                        <h3>Henüz uyarı yok</h3>
                        <p className="max-w-64 text-[12px]">
                            İzleme listenizdeki hisseler AL/SAT sinyali ürettiğinde burada ve ekranın sağ üstünde görünür.
                        </p>
                    </div>
                ) : (
                    <ul className="max-h-[min(60vh,460px)] overflow-y-auto">
                        {alerts.map((alert) => {
                            const meta = signalMeta(alert.signal);
                            return (
                                <li
                                    key={alert.id}
                                    className={cn(
                                        'group border-b border-line/60 px-3 py-2.5 last:border-0',
                                        !alert.read && 'bg-brand-soft/15',
                                    )}
                                >
                                    <div className="flex items-start gap-2">
                                        <span className={cn('mt-0.5 grid h-6 min-w-9 shrink-0 place-items-center rounded-md border px-1 text-[10px] font-bold', meta.className)}>
                                            {meta.label}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <Link
                                                    href={`/stocks/${encodeURIComponent(alert.symbol)}`}
                                                    onClick={() => {
                                                        markAlertAsRead(alert.id);
                                                        setOpen(false);
                                                    }}
                                                    className="mono truncate text-[12.5px] font-bold text-foreground hover:text-brand-ink"
                                                >
                                                    {alert.symbol}
                                                </Link>
                                                <span className={cn('mono shrink-0 text-[11.5px] font-semibold', alert.signal === 'AL' ? 'text-up' : alert.signal === 'SAT' ? 'text-down' : 'text-faint')}>
                                                    {formatPrice(alert.price)}
                                                </span>
                                            </div>
                                            <p className="truncate text-[10.5px] text-faint" title={alert.reason}>
                                                {meta.title}
                                                {alert.reason ? ` · ${alert.reason}` : ''}
                                            </p>
                                            <div className="mt-1 flex items-center justify-between gap-2">
                                                <span className="text-[9.5px] text-faint">
                                                    {new Date(alert.timestamp).toLocaleString('tr-TR', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                                <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                                                    {!alert.read && (
                                                        <button
                                                            type="button"
                                                            onClick={() => markAlertAsRead(alert.id)}
                                                            className="icon-btn size-5"
                                                            title="Okundu işaretle"
                                                            aria-label="Okundu işaretle"
                                                        >
                                                            <CheckCheck />
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeAlert(alert.id)}
                                                        className="icon-btn is-danger size-5"
                                                        title="Uyarıyı kaldır"
                                                        aria-label="Uyarıyı kaldır"
                                                    >
                                                        <X />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {alerts.length > 0 && (
                    <button
                        type="button"
                        onClick={() => {
                            clearAllAlerts();
                            setOpen(false);
                        }}
                        className="flex w-full items-center justify-center gap-1.5 border-t border-line px-3 py-2 text-[11px] font-semibold text-down hover:bg-down/10"
                    >
                        <Trash2 className="size-3.5" /> Tüm uyarıları temizle
                    </button>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
