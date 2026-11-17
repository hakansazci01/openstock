import { BarChart2, Clock, Mail, UserX } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';
import SectionHead from '@/components/marketing/SectionHead';
import IconCard from '@/components/marketing/IconCard';
import { REPO_URL } from '@/lib/constants';

export const metadata = {
    title: 'Mimari | OpenStock|Mimari | OpenStock',
    description: 'HowMimari | OpenStock works: Piyasa verileri, Arka plan işleri and the AI behind the emails.',
};

const DATA_MODES = [
    { name: 'Önbelleğe alınmış', cadence: 'Saatlik', body: 'Kamusal site için varsayılandır. Fiyatlar bir saatte bir çekilir ve her kullanıcı tarafından paylaşılır, bu nedenle maliyet insanlar yerine sembollere göre artar.' },
    { name: 'Gerçek zamanlı', cadence: 'Her 15 saniyede bir', body: 'ForMimari | OpenStock Cloud and self-hosting. Set NEXT_PUBLIC_OPENSTOCK_DATA_MODE=Gerçek zamanlı and on-screen prices refresh Canlı and email Fiyat uyarıları turn on.' },
];

const COVERAGE = [
    ['ABD hisseleri, kripto', 'Canlı', 'Yes'],
    ['Döviz', 'Canlı', 'No'],
    ['Kanada, Avustralya', 'Gecikmeli', 'No'],
    ['Saudi Arabia (Yahoo Finance)', 'Gecikmeli', 'No'],
    ['India (BSE), Germany', 'Gün sonu', 'No'],
];

const FLOW = ['A user signs up, or a cron fires', 'Inngest runs the function', 'Gemini writes the text', 'MiniMax takes over if Gemini fails', 'The email goes out'];

const JOBS = [
    { icon: Mail, title: 'Hoş geldin e-postası', trigger: 'Kayıt sırasında', body: 'Kayıtta seçilen ülke, hedef, risk ve sektöre göre kişiselleştirilmiş AI ile yazılmış bir giriş.' },
    { icon: BarChart2, title: 'Haftalık haberler', trigger: 'Pazartesi 09:00', body: 'Summarises the week’s Piyasa news and sends it as a Kit broadcast.' },
    { icon: Clock, title: 'Fiyat uyarıları', trigger: 'Her 5 dakikada bir', body: 'Checks every active alert against Finnhub quotes and emails the owner when one fires. Gerçek zamanlı mode only.' },
    { icon: UserX, title: 'Yeniden katılım', trigger: 'Günlük 10:00', body: 'Uyuyan hesapları bulur ve hafif bir hatırlatma gönderir.' },
];

const Yığın = [
    ['Finnhub', 'Quotes, company profiles, search and news. A pool of keys, rotated per request.', 'https://finnhub.io'],
    ['TradingView', 'Grafikler, heatmaps, technicals and Piyasa widgets, embedded Canlı.', 'https://www.tradingview.com/widget/'],
    ['Inngest', 'Arka plan işleri and schedules, with retries.', 'https://www.inngest.com'],
    ['Better Auth', 'Email, Google and GitHub sign-in with MongoDB sessions.', 'https://www.better-auth.com'],
    ['MongoDB Atlas', 'Users, watchlists and alerts.', 'https://www.mongodb.com/atlas'],
    ['Kit', 'Newsletter broadcasts for the weekly digest.', 'https://kit.com'],
];

export default function ArchitecturePage() {
    return (
        <>
            <PageHero
                kicker="Architecture"
                title="HowMimari | OpenStock works."
                sub="A transparent look at the event-driven, multi-provider system behind your Piyasa verileri and emails."
            >
                <span className="pill h-8 px-3">v1.0.0</span>
                <span className="pill h-8 px-3">Gemini with MiniMax fallback</span>
                <span className="pill h-8 px-3">Open source · AGPL-3.0</span>
            </PageHero>

            <section className="mx-auto mt-20 max-w-[1200px] px-5">
                <SectionHead kicker="Piyasa verileri" title="İki veri modu, bir önbellek." sub="Grafikler her zaman TradingView'den akar. Kendi fiyatlandırdığımız her şey, zaman aşımı ile paylaşılan bir önbellekten geçer, böylece yavaş bir sağlayıcı bir sayfayı asla dondurmaz." />
                <div className="grid gap-3 md:grid-cols-2">
                    {DATA_MODES.map(({ name, cadence, body }) => (
                        <div key={name} className="hatch">
                            <div className="card flex h-full flex-col gap-2 p-5">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[16px] font-bold">{name}</h3>
                                    <span className="pill is-brand">{cadence}</span>
                                </div>
                                <p className="text-[14px] leading-relaxed text-muted-foreground">{body}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="hatch mt-3">
                    <div className="card overflow-x-auto">
                        <table className="data-table">
                            <thead><tr><th>Piyasa</th><th>Grafikler</th><th>Fiyatlarımız ve uyarılarımız</th></tr></thead>
                            <tbody>
                                {COVERAGE.map(([Piyasa, Grafikler, quotes]) => (
                                    <tr key={Piyasa}>
                                        <td className="font-semibold text-foreground">{Piyasa}</td>
                                        <td className="text-muted-foreground">{Grafikler}</td>
                                        <td><span className={quotes === 'Yes' ? 'pill is-up' : 'pill'}>{quotes}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <a href={`${REPO_URL}/blob/main/Piyasa_SUPPORT.md`} target="_blank" rel="noreferrer" className="btn btn-ghost mt-4">Full Piyasa support notes</a>
            </section>

            <section className="mx-auto mt-24 grid max-w-[1200px] items-start gap-10 px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                    <SectionHead kicker="AI" title="Sağlayıcı ile birlikte düşmeyen e-postalar." sub="Hoş geldin e-postaları ve haber özetleri Gemini 2.5 Flash-Lite tarafından yazılır. Başarısız olursa, istek varsayılan olarak MiniMax-M3.1-Flash üzerinde yeniden denenir. MINIMAX_MODEL'ı MiniMax-M3 olarak ayarlayın veya yapılandırılmış model geçersiz kılmanıza devam edin." />
                </div>
                <div className="hatch">
                    <ol className="card flex flex-col gap-1 p-4">
                        {FLOW.map((step, i) => (
                            <li key={step} className="flex items-center gap-3 rounded-[10px] px-2 py-2.5">
                                <span className="mono grid size-7 flex-none place-items-center rounded-full bg-page text-[12px] text-brand-ink shadow-[inset_0_0_0_1px_var(--line)]">{i + 1}</span>
                                <span className="font-semibold">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section className="mx-auto mt-24 max-w-[1200px] px-5">
                <SectionHead kicker="Arka plan işleri" title="Dört iş şeyleri hareketli tutar." />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {JOBS.map(({ icon, title, trigger, body }) => (
                        <IconCard key={title} icon={icon} title={title} footer={<span className="pill mono">{trigger}</span>}>{body}</IconCard>
                    ))}
                </div>
            </section>

            <section className="mx-auto mt-24 max-w-[1200px] px-5">
                <SectionHead kicker="Yığın" title="Denetleyebileceğiniz hizmetler üzerine inşa edilmiştir." />
                <div className="hatch">
                    <div className="card row-list">
                        {Yığın.map(([name, body, url]) => (
                            <a key={name} href={url} target="_blank" rel="noreferrer" className="group flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-hover/40 sm:flex-row sm:items-center sm:gap-6">
                                <span className="w-40 flex-none font-bold text-foreground group-hover:text-brand-ink">{name}</span>
                                <span className="text-muted-foreground">{body}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}













