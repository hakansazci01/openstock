import { getSession } from '@/lib/better-auth/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bot as BotIcon, Clock, ListOrdered, Settings2, TrendingUp } from 'lucide-react';
import Panel from '@/components/Panel';
import BotActions from '@/components/bots/BotActions';
import { BotDataSources } from '@/components/bots/BotDataSources';
import { BotTradeAnalysis } from '@/components/bots/BotTradeAnalysis';
import { getBotForUser, getBotPortfolio, getBotTrades } from '@/lib/bot/queries';
import {
    BOT_TYPE_LABELS,
    dateTime,
    money,
    percent,
    statusClass,
    statusLabel,
    strategyLabel,
} from '@/lib/bot/ui';

export const dynamic = 'force-dynamic';

export default async function BotDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session?.user) redirect('/sign-in');

    const { id } = await params;
    const bot = await getBotForUser(session.user.id, id);

    if (!bot) {
        return (
            <div className="mx-auto w-full max-w-xl">
                <Panel title="Bot bulunamadı" sub="Bu bot silinmiş veya size ait değil">
                    <div className="empty-state py-10">
                        <span className="empty-icon"><BotIcon /></span>
                        <h3>Bot bulunamadı</h3>
                        <Link href="/bots" className="btn btn-primary mt-3"><ArrowLeft /> Botlara dön</Link>
                    </div>
                </Panel>
            </div>
        );
    }

    const [trades, portfolio] = await Promise.all([
        getBotTrades(id, 100),
        getBotPortfolio(bot),
    ]);

    const positive = (bot.totalReturnPercent ?? 0) >= 0;
    const signals = Array.isArray(bot.lastSignals)
        ? (bot.lastSignals as Array<{ symbol: string; action: string; confidence: number; price: number; reason: string; at: string }>)
        : [];

    return (
        <div className="flex flex-col gap-4">
            <header className="page-head">
                <div className="min-w-0">
                    <Link href="/bots" className="btn btn-ghost mb-2 h-8 px-2.5 text-[12px]">
                        <ArrowLeft /> Botlar
                    </Link>
                    <h1 className="page-title truncate">{bot.name}</h1>
                    <p className="page-sub truncate">
                        {strategyLabel(bot.strategy)} · {bot.exchange} · {bot.symbols.join(', ')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={`pill h-7 px-3 text-[11.5px] font-bold ${statusClass(bot.status)}`}>
                        {statusLabel(bot.status)}
                    </span>
                    <BotActions botId={bot._id} status={bot.status} variant="detail" />
                </div>
            </header>

            {bot.lastError && (
                <div className="rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">
                    Son çalıştırmada hata: {bot.lastError}
                </div>
            )}

            <BotDataSources symbols={bot.symbols} />

            <BotTradeAnalysis trades={trades} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Toplam varlık" value={money(portfolio.equity)} sub={`Nakit ${money(portfolio.cash)}`} />
                <Stat
                    label="Getiri"
                    value={percent(bot.totalReturnPercent)}
                    sub={`${money(bot.totalReturn)} · başlangıç ${money(bot.initialCapital)}`}
                    tone={positive ? 'up' : 'down'}
                />
                <Stat label="Başarı oranı" value={`${(bot.winRate ?? 0).toFixed(1)}%`} sub={`${bot.winningTrades ?? 0} kazanan / ${bot.losingTrades ?? 0} kaybeden`} />
                <Stat label="Maks. düşüş" value={`-${Math.abs(bot.maxDrawdown ?? 0).toFixed(2)}%`} sub="Zirveden en büyük gerileme" tone="down" />
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
                <Panel
                    title="Açık pozisyonlar"
                    sub={portfolio.positions.length > 0 ? `${portfolio.positions.length} sembol` : 'Pozisyon yok'}
                >
                    {portfolio.positions.length === 0 ? (
                        <div className="empty-state py-8">
                            <span className="empty-icon"><TrendingUp /></span>
                            <h3>Henüz pozisyon yok</h3>
                            <p className="text-[12.5px]">Bot alış sinyali ürettiğinde pozisyonlar burada görünür.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Sembol</th>
                                        <th className="is-num">Adet</th>
                                        <th className="is-num">Maliyet</th>
                                        <th className="is-num">Fiyat</th>
                                        <th className="is-num">Değer</th>
                                        <th className="is-num">K/Z</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {portfolio.positions.map((position) => (
                                        <tr key={position.symbol}>
                                            <td className="mono font-semibold">{position.symbol}</td>
                                            <td className="is-num">{position.quantity.toFixed(4)}</td>
                                            <td className="is-num">{position.avgCost.toFixed(2)}</td>
                                            <td className="is-num">{position.marketPrice.toFixed(2)}</td>
                                            <td className="is-num">{money(position.marketValue)}</td>
                                            <td className={`is-num font-semibold ${position.unrealizedPnl >= 0 ? 'text-up' : 'text-down'}`}>
                                                {percent(position.unrealizedPnlPercent)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>

                <Panel title="Bot ayarları" sub="Yapılandırma" action={<Settings2 className="size-4 text-faint" />}>
                    <dl className="flex flex-col gap-2 text-[12.5px]">
                        <Row label="Strateji" value={strategyLabel(bot.strategy)} />
                        <Row label="Tür" value={BOT_TYPE_LABELS[bot.type] ?? bot.type} />
                        <Row label="Borsa" value={bot.exchange} />
                        <Row label="Çalışma aralığı" value={`${bot.intervalMinutes} dakika`} />
                        <Row label="Son çalışma" value={dateTime(bot.lastRunAt)} />
                        <Row label="Sonraki çalışma" value={dateTime(bot.nextRunAt)} />
                        <Row label="Nakit" value={money(portfolio.cash)} />
                        <Row label="Yatırımda" value={money(portfolio.invested)} />
                        <Row label="Gerçekleşen K/Z" value={money(portfolio.realizedPnl)} />
                        <Row label="Toplam işlem" value={String(bot.totalTrades ?? 0)} />
                    </dl>
                </Panel>
            </div>

            <Panel
                title="Son sinyaller"
                sub={signals.length > 0 ? `${signals.length} sinyal` : 'Bot çalıştırıldığında sinyaller burada listelenir'}
                action={<Clock className="size-4 text-faint" />}
            >
                {signals.length === 0 ? (
                    <p className="px-1 py-4 text-[12.5px] text-faint">Henüz sinyal kaydı yok. “Şimdi Çalıştır” ile ilk taramayı yapabilirsiniz.</p>
                ) : (
                    <ul className="row-list">
                        {signals.map((signal, index) => (
                            <li key={`${signal.symbol}-${index}`} className="flex items-center gap-3 px-1 py-2.5">
                                <span className={`pill h-6 shrink-0 px-2 text-[10.5px] font-bold ${signal.action === 'buy' ? 'is-up' : signal.action === 'sell' ? 'is-down' : ''}`}>
                                    {signal.action === 'buy' ? 'AL' : signal.action === 'sell' ? 'SAT' : 'BEKLE'}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="mono text-[12.5px] font-semibold text-foreground">
                                        {signal.symbol} <span className="font-normal text-faint">· %{Math.round(signal.confidence ?? 0)} güven</span>
                                    </p>
                                    <p className="truncate text-[11.5px] text-faint">{signal.reason}</p>
                                </div>
                                <span className="hidden text-[11px] text-faint sm:block">{dateTime(signal.at)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            <Panel
                title="İşlem geçmişi"
                sub={trades.length > 0 ? `Son ${trades.length} işlem` : 'Henüz işlem yok'}
                action={<ListOrdered className="size-4 text-faint" />}
            >
                {trades.length === 0 ? (
                    <div className="empty-state py-8">
                        <span className="empty-icon"><ListOrdered /></span>
                        <h3>İşlem geçmişi boş</h3>
                        <p className="text-[12.5px]">Bot ilk alış/satış sinyalini çalıştırdığında burada görünecek.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Sembol</th>
                                    <th>Yön</th>
                                    <th className="is-num">Fiyat</th>
                                    <th className="is-num">Adet</th>
                                    <th className="is-num">Tutar</th>
                                    <th className="is-num">K/Z</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.map((trade) => (
                                    <tr key={trade._id}>
                                        <td className="text-[11.5px] text-faint">{dateTime(trade.executedAt)}</td>
                                        <td className="mono font-semibold">{trade.symbol}</td>
                                        <td>
                                            <span className={`pill h-6 px-2 text-[10.5px] font-bold ${trade.side === 'buy' ? 'is-up' : 'is-down'}`}>
                                                {trade.side === 'buy' ? 'ALIŞ' : 'SATIŞ'}
                                            </span>
                                        </td>
                                        <td className="is-num">{trade.price.toFixed(2)}</td>
                                        <td className="is-num">{trade.quantity.toFixed(4)}</td>
                                        <td className="is-num">{money(trade.total)}</td>
                                        <td className={`is-num font-semibold ${(trade.pnl ?? 0) > 0 ? 'text-up' : (trade.pnl ?? 0) < 0 ? 'text-down' : 'text-faint'}`}>
                                            {trade.pnl == null ? '—' : `${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)} (${percent(trade.pnlPercent ?? 0)})`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Panel>
        </div>
    );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'up' | 'down' }) {
    return (
        <div className="hatch">
            <div className="card">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
                <p className={`mono text-2xl font-bold ${tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-foreground'}`}>{value}</p>
                <p className="text-[11px] text-faint">{sub}</p>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5 last:border-0 last:pb-0">
            <dt className="text-faint">{label}</dt>
            <dd className="truncate font-medium text-foreground" title={value}>{value}</dd>
        </div>
    );
}
