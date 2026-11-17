'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Activity, Pause, Play, RotateCcw, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type BotActionsProps = {
    botId: string;
    status: string;
    variant?: 'card' | 'detail';
    className?: string;
};

type Action = 'start' | 'pause' | 'run' | 'delete' | 'reset';

export default function BotActions({ botId, status, variant = 'card', className }: BotActionsProps) {
    const router = useRouter();
    const [pending, setPending] = useState<Action | null>(null);
    const running = status === 'running';

    const call = async (action: Action) => {
        if (pending) return;
        if (action === 'delete' && !window.confirm('Bu botu ve tüm işlem geçmişini silmek istediğinize emin misiniz?')) return;
        if (action === 'reset' && !window.confirm('Tüm işlemleri silip botu başlangıç sermayesine döndürmek istiyor musunuz?')) return;

        setPending(action);
        try {
            const res = await fetch(`/api/bots/${botId}`, {
                method: action === 'delete' ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: action === 'delete' ? undefined : JSON.stringify({ action }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) throw new Error(data.error || 'İşlem başarısız');

            if (action === 'delete') {
                toast.success('Bot silindi');
                router.push('/bots');
                router.refresh();
                return;
            }
            if (action === 'run') {
                const count = Array.isArray(data.trades) ? data.trades.length : 0;
                toast.success(`Bot çalıştırıldı · ${count} işlem`);
            } else if (action === 'start') {
                toast.success('Bot başlatıldı');
            } else if (action === 'pause') {
                toast.success('Bot duraklatıldı');
            } else {
                toast.success('Bot sıfırlandı');
            }
            router.refresh();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'İşlem başarısız');
        } finally {
            setPending(null);
        }
    };

    const button = (action: Action, label: string, icon: React.ReactNode, extra?: string) => (
        <button
            type="button"
            onClick={() => call(action)}
            disabled={pending !== null}
            className={cn('btn btn-ghost', extra)}
        >
            {pending === action ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon}
            {variant === 'detail' && <span>{label}</span>}
        </button>
    );

    if (variant === 'detail') {
        return (
            <div className={cn('flex flex-wrap items-center gap-2', className)}>
                <button
                    type="button"
                    onClick={() => call(running ? 'pause' : 'start')}
                    disabled={pending !== null}
                    className={cn('btn', running ? 'btn-ghost text-down' : 'btn-primary')}
                >
                    {pending === 'start' || pending === 'pause'
                        ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        : running ? <Pause /> : <Play />}
                    <span>{running ? 'Durdur' : 'Başlat'}</span>
                </button>
                {button('run', 'Şimdi Çalıştır', <Zap />, 'text-brand-ink')}
                {button('reset', 'Sıfırla', <RotateCcw />)}
                {button('delete', 'Sil', <Trash2 />, 'text-down')}
            </div>
        );
    }

    return (
        <div className={cn('flex items-center gap-2', className)}>
            <button
                type="button"
                onClick={() => call(running ? 'pause' : 'start')}
                disabled={pending !== null}
                className={cn('btn btn-ghost flex-1', running ? 'text-down' : 'text-brand-ink')}
                title={running ? 'Durdur' : 'Başlat'}
            >
                {pending === 'start' || pending === 'pause'
                    ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    : running ? <Pause /> : <Play />}
                {running ? 'Durdur' : 'Başlat'}
            </button>
            <Link href={`/bots/${botId}`} className="btn btn-ghost flex-1">
                <Activity />
                Detay
            </Link>
            <button
                type="button"
                onClick={() => call('delete')}
                disabled={pending !== null}
                className="icon-btn is-danger"
                title="Botu sil"
                aria-label="Botu sil"
            >
                {pending === 'delete'
                    ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    : <Trash2 />}
            </button>
        </div>
    );
}
