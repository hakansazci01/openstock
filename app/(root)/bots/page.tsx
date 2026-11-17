import { getSession } from '@/lib/better-auth/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Activity, Bot as BotIcon, ChartLine, Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import Panel from '@/components/Panel';
import BotActions from '@/components/bots/BotActions';
import { getUserBots } from '@/lib/bot/queries';
import { dateTime, money, percent, statusClass, statusLabel, strategyLabel } from '@/lib/bot/ui';
import { RiskWarningBanner } from '@/components/shell/RiskWarningBanner';

export const dynamic = 'force-dynamic';

export default async function BotsPage() {
    const session = await getSession();
    if (!session?.user) redirect('/sign-in');

    const bots = await getUserBots(session.user.id);
    const running = bots.filter((bot) => bot.status === 'running').length;
    const equity = bots.reduce((sum, bot) => sum + (bot.currentCapital ?? bot.initialCapital ?? 0), 0);
    const invested = bots.reduce((sum, bot) => sum + (bot.initialCapital ?? 0), 0);
    const returnPercent = invested > 0 ? ((equity - invested) / invested) * 100 : 0;

    return (
        <>
            <RiskWarningBanner />
            <div className="flex flex-col gap-4">
                <header className="page-head">
                    <div>
                        <h1 className="page-title">Trading Botlarım</h1>
                        <p className="page-sub">
                            {bots.length} bot · {running} çalışıyor
                        </p>
                    </div>
                    <Link href="/bots/new" className="btn btn-primary shrink-0">
                        <Plus /> Yeni Bot
                    </Link>
                </header>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {bots.length === 0 ? (
                        <div className="col-span-full">
                            <Panel title="Henüz bot yok" sub="İlk trading botunuzu oluşturun">
                                <div className="empty-state py-12">
                                    <span className="empty-icon"><ChartLine /></span>
                                    <h3>İlk stratejinizi deneyin</h3>
                                    <p className="max-w-md text-[13px]">
                                        SMA kesişimi, RSI, MACD veya fiyat eşiği stratejileriyle sanal sermaye üzerinde
                                        otomatik işlem yapan bir bot oluşturun.
                                    </p>
                                    <Link href="/bots/new" className="btn btn-primary mt-3">
                                        <Plus /> Yeni Bot Oluştur
                                    </Link>
                                </div>
                            </Panel>
                        </div>
                    ) : (
                        <>
                            <SummaryTile icon={<BotIcon />} label="Toplam bot" value={String(bots.length)} sub={running + " çalışıyor"} />
                            <SummaryTile icon={<Wallet />} label="Toplam sermaye" value={money(equity)} sub={"Başlangıç " + money(invested)} />
                            <SummaryTile
                                icon={returnPercent >= 0 ? <TrendingUp /> : <TrendingDown />}
                                label="Toplam getiri"
                                value={percent(returnPercent)}
                                sub="Tüm botların ağırlıklı getirisi"
                                tone={returnPercent >= 0 ? 'up' : 'down'}
                            />
                            <SummaryTile
                                icon={<Activity />}
                                label="Toplam işlem"
                                value={String(bots.reduce((sum, bot) => sum + (bot.totalTrades ?? 0), 0))}
                                sub="Alış + satış"
                            />
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
    return (
        <div className="rounded-lg bg-page px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</p>
            <p className={"mono text-[12.5px] font-bold " + (tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-foreground')}>{value}</p>
        </div>
    );
}
function SummaryTile({ icon, label, value, sub, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; tone?: 'up' | 'down' }) {
    return (
        <div className="hatch">
            <div className="card flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-hover text-muted-foreground">{icon}</span>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
                    <p className={"mono truncate text-lg font-bold " + (tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-foreground')}>{value}</p>
                    <p className="truncate text-[11px] text-faint">{sub}</p>
                </div>
            </div>
        </div>
    );
}