import { Suspense } from "react";
import { cookies } from "next/headers";
import TradingViewWidget from "@/components/TradingViewWidget";
import Panel from "@/components/Panel";
import IndexPulse, { PulseSkeleton } from "@/components/IndexPulse";
import DataFreshness from "@/components/DataFreshness";
import MarketSwitcher from "@/components/MarketSwitcher";
import SaudiQuotesTable from "@/components/SaudiQuotes";
import {
    CRYPTO_HEATMAP_CONFIG,
    STOCK_HEATMAP_CONFIG,
    marketOverviewConfig,
    marketQuotesConfig,
    timelineConfig,
} from "@/lib/constants";
import { MARKETS, MARKET_COOKIE, getMarket, isMarketOpen, marketForCountry } from "@/lib/markets";
import { getSession } from "@/lib/better-auth/auth";
import { getUserBots, type BotListItem } from "@/lib/bot/queries";
import BotActions from "@/components/bots/BotActions";
import { dateTime, money, percent, statusClass, statusLabel, strategyLabel } from "@/lib/bot/ui";
import { Activity, ChartLine } from "lucide-react";
import Link from "next/link";
import { MarketLoadingProgress } from "@/components/MarketLoadingProgress";
import LiveWatchlistPanel from "@/components/dashboard/LiveWatchlistPanel";
import { getUserWatchlist } from "@/lib/actions/watchlist.actions";

const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;

// Widgets come from TradingView (live, no Finnhub quota) and render immediately; the tiles stream in.
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
    const { market: requested } = await searchParams;
    const saved = (await cookies()).get(MARKET_COOKIE)?.value;
    const market = getMarket(requested ?? saved ?? marketForCountry((await getSession())?.user.country));
    const open = isMarketOpen(market);
    const native = market.pulse.some((p) => p.finnhub);
    const PulseSub = native ? 'Our shared Fiyatlar via Finnhub' : market.yahoo ? 'Delayed Fiyatlar via Yahoo Finance' : `${market.feed} Fiyatlar via TradingView`;
    const heatmap = market.heatmap === 'stocks'
        ? { script: 'stock-heatmap.js', config: STOCK_HEATMAP_CONFIG, title: 'S&P 500 heatmap' }
        : market.heatmap === 'crypto'
            ? { script: 'crypto-coins-heatmap.js', config: CRYPTO_HEATMAP_CONFIG, title: 'Crypto heatmap' }
            : null;

    const session = await getSession();
    const bots: BotListItem[] = session?.user ? await getUserBots(session.user.id) : [];
    const watchlist = session?.user ? await getUserWatchlist() : [];

    return (
        <>
            <MarketLoadingProgress />
            <header className="page-head">
                <div>
                    <h1 className="page-title">Piyasalar</h1>
                    <p className="page-sub">{market.name} · {open ? 'şu anda açık' : 'şu anda kapalı'} · {market.feed.toLowerCase()} data</p>
                </div>
            </header>

            <MarketSwitcher active={market.id} openIds={MARKETS.filter((m) => isMarketOpen(m)).map((m) => m.id)} />

            {/* Bot Kartları - Ana Ekran */}
            <section className="hatch mb-6">
                <div className="section-head mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h2 className="section-title">Trading Botlarım</h2>
                        <p className="section-sub text-faint">Otomatik stratejilerinizi direkt burada yönetin</p>
                    </div>
                    <Link href={bots.length === 0 ? '/bots/new' : '/bots'} className="btn btn-primary shrink-0">
                        {bots.length === 0 ? <><ChartLine /> Yeni Bot</> : <><Activity /> Tüm Botları Gör</>}
                    </Link>
                </div>

                {bots.length === 0 ? (
                    <Panel title="Henüz bot yok" sub="İlk trading botunuzu oluşturun" className="max-w-md mx-auto">
                        <div className="empty-state py-10">
                            <span className="empty-icon"><ChartLine /></span>
                            <h3>Bot oluşturun</h3>
                            <p className="max-w-md text-[13px]">
                                SMA kesişimi, RSI, MACD veya fiyat eşiği stratejileriyle sanal sermaye üzerinde otomatik işlem yapan bir bot oluşturun.
                            </p>
                            <Link href="/bots/new" className="btn btn-primary mt-3">
                                <ChartLine /> Yeni Bot Oluştur
                            </Link>
                        </div>
                    </Panel>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {bots.map((bot) => {
                            const positive = (bot.totalReturnPercent ?? 0) >= 0;
                            return (
                                <Panel key={bot._id} title={bot.name} sub={`${strategyLabel(bot.strategy)} · ${bot.exchange}`}>
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`pill h-6 px-2 text-[10.5px] font-bold ${statusClass(bot.status)}`}>{statusLabel(bot.status)}</span>
                                            <span className="text-[10.5px] text-faint">{dateTime(bot.lastRunAt)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="rounded-lg bg-page px-2 py-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">Sermaye</p>
                                                <p className="mono text-[12px] font-bold text-foreground">{money(bot.currentCapital ?? bot.initialCapital)}</p>
                                            </div>
                                            <div className="rounded-lg bg-page px-2 py-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-faint">Getiri</p>
                                                <p className={`mono text-[12px] font-bold ${positive ? 'text-up' : 'text-down'}`}>{percent(bot.totalReturnPercent)}</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {bot.symbols.slice(0, 4).map((symbol) => (
                                                <span key={symbol} className="pill mono h-6 px-2 text-[10.5px]">{symbol}</span>
                                            ))}
                                            {bot.symbols.length > 4 && <span className="pill h-6 px-2 text-[10.5px]">+{bot.symbols.length - 4}</span>}
                                        </div>
                                        {bot.lastError && <p className="truncate text-[10.5px] text-down" title={bot.lastError}>{bot.lastError}</p>}
                                        <BotActions botId={bot._id} status={bot.status} />
                                    </div>
                                </Panel>
                            );
                        })}
                    </div>
                )}
                <div className="section-head">
                    <div>
                        <h2 className="section-title">Nabız</h2>
                        <p className="section-sub">{PulseSub}</p>
                    </div>
                    {native && <DataFreshness />}
                </div>
                <Suspense key={market.id} fallback={<PulseSkeleton />}>
                    <IndexPulse market={market} />
                </Suspense>
            </section>

            <div key={market.id} className="flex flex-col gap-3">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <Panel title="Liderler" sub="Grup bazında 12 aylık trend">
                        <TradingViewWidget scriptUrl={`${scriptUrl}market-overview.js`} config={marketOverviewConfig(market.groups)} height={560} />
                    </Panel>
                    {heatmap ? (
                        <Panel title={heatmap.title} sub="Sized by market cap, coloured by today's move">
                            <TradingViewWidget scriptUrl={`${scriptUrl}${heatmap.script}`} config={heatmap.config} height={560} allowExpand />
                        </Panel>
                    ) : (
                        <Panel title="Fiyatlar" sub={`${market.name} Liderler by group`}>
                            {market.id === 'sa'
                                ? <SaudiQuotesTable market={market} />
                                : <TradingViewWidget scriptUrl={`${scriptUrl}market-Quotes.js`} config={marketQuotesConfig(market.groups)} height={560} />}
                        </Panel>
                    )}
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    {heatmap && (
                        <Panel title="Fiyatlar" sub={`${market.name} Liderler by group`}>
                            <TradingViewWidget scriptUrl={`${scriptUrl}market-Quotes.js`} config={marketQuotesConfig(market.groups)} height={560} />
                        </Panel>
                    )}
                    <Panel title="Önemli haberler" sub="Önce en yenileri" className={heatmap ? '' : 'xl:col-span-2'}>
                        <TradingViewWidget scriptUrl={`${scriptUrl}timeline.js`} config={timelineConfig(market.news)} height={560} />
                    </Panel>
                </div>
            </div>

            {session?.user && watchlist.length > 0 && (
                <div className="mb-6">
                    <LiveWatchlistPanel symbols={watchlist} />
                </div>
            )}
        </>
    );
}