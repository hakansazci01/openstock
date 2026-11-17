"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAlert } from "@/lib/actions/alert.actions";
import { alertsEnabled } from "@/lib/market-data";
import { formatPrice } from "@/lib/utils";

type AlertRow = {
    _id: string;
    symbol: string;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    triggered?: boolean;
    active?: boolean;
    expiresAt?: string;
};

const statusOf = (alert: AlertRow) => {
    if (alert.triggered) return { label: 'Tetiklendi', className: 'pill is-brand' };
    if (!alertsEnabled) return { label: 'Durduruldu', className: 'pill' };
    if (alert.expiresAt && new Date(alert.expiresAt) < new Date()) return { label: 'Süresi Doldu', className: 'pill' };
    if (alert.active === false) return { label: 'Durduruldu', className: 'pill' };
    return { label: 'İzleniyor', className: 'pill is-up' };
};

export default function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
    const router = useRouter();
    const [pendingId, setPendingId] = useState<string | null>(null);

    const handleDelete = async (alert: AlertRow) => {
        setPendingId(alert._id);
        try {
            await deleteAlert(alert._id);
            toast.success(`${alert.symbol} uyarısı kaldırıldı`);
            router.refresh();
        } catch {
            toast.error("Uyarı kaldırılamadı");
        } finally {
            setPendingId(null);
        }
    };

    if (alerts.length === 0 && !alertsEnabled) {
        return (
            <div className="empty-state py-10">
                <span className="empty-icon"><BellRing className="size-5" /></span>
                <h3>Henüz Uyarı Yok</h3>
                <p className="max-w-64 text-[13px]">Fiyat uyarıları şu an aktif. Bir hissede zil simgesine tıklayarak uyarı ekleyebilirsiniz.</p>
                <Link href="/#data" className="btn btn-ghost mt-2">OpenStock Cloud&apos;u G&ouml;r</Link>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="empty-state py-10">
                <span className="empty-icon"><BellRing className="size-5" /></span>
                <h3>Henüz Uyarı Yok</h3>
                <p className="max-w-60 text-[13px]">Herhangi bir satırdaki zili kullanın veya bir hisse sayfasında “Uyarı Ayarla”ya basın. Uyarı tetiklendiğinde size e-posta gönderiyoruz.</p>
            </div>
        );
    }

    return (
        <>
            {!alertsEnabled && (
                <p className="px-3 pt-3 pb-1 text-[12.5px] text-faint">
                    Uyarılar devre dışı.
                </p>
            )}
            <ul className="row-list">
                {alerts.map((alert) => {
                    const status = statusOf(alert);
                    return (
                        <li key={alert._id} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                                <p className="mono font-semibold text-foreground">{alert.symbol}</p>
                                <p className="num truncate text-[12.5px] text-faint">
                                    {alert.condition === 'ABOVE' ? 'Üzerinde' : 'Altında'} {formatPrice(alert.targetPrice)}
                                    {alert.expiresAt && !alert.triggered && ` · ${new Date(alert.expiresAt).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' })} tarihine kadar`}
                                </p>
                            </div>
                            <span className={status.className}>{status.label}</span>
                            <button
                                type="button"
                                onClick={() => handleDelete(alert)}
                                disabled={pendingId === alert._id}
                                className="icon-btn is-danger"
                                title="Remove alert"
                                aria-label={`Remove alert for ${alert.symbol}`}
                            >
                                <Trash2 />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </>
    );
}

