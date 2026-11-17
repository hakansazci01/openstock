import Link from "next/link";
import { Bell, CandlestickChart, Clock, Command, Grid3x3, MailOpen, MessagesSquare } from "lucide-react";

import SectionHead from "@/components/marketing/SectionHead";
import IconCard from "@/components/marketing/IconCard";
import { getSession } from "@/lib/better-auth/auth";
import { formatCount, getRepoStats } from "@/lib/github";
import { DISCORD_URL, REPO_URL, APP_OWNER_DESCRIPTION, APP_OWNER_NAME } from "@/lib/constants";

const FEATURES = [
    { id: '1', icon: CandlestickChart, title: 'Hareketli Grafikler', body: 'Her listed şirket için TradingView mum grafikleri, teknik göstergeler ve finansal tablolar, tam ekran görünüm.' },
    { id: '2', icon: Bell, title: 'E-posta Uyarıları', body: 'OpenStock Cloud ile hedef fiyatı üst veya altta belirleyin, her beş dakikada bir kontrol eder ve ulaştığında size yazıyoruz.' },
    { id: '3', icon: MessagesSquare, title: 'Tek Seferde Duygu Analizi', body: 'Reddit, X.com, haberler ve Polymarket\'ten gelen buğulu ve ascı yatırımcı duygusu, her hisse için yan yana karşılaştırılır.' },
    { id: '4', icon: Grid3x3, title: 'Tüm Piyasa', body: 'Sektör ısı haritası, hareket edenler ve önemli haberler, tek ekranda çan vurmadan önce.' },
    { id: '5', icon: Command, title: '⌘K ile Herşeyi Bul', body: 'Finnhub\'ın kapsadığı her borsada arama yapın, bir hisseyi tarayıcı sekmesi gibi bir sekmede açın.' },
    { id: '6', icon: MailOpen, title: 'Pazartesi Özeti', body: 'İzlediğiniz hisseler için haftanın haberlerinin kısaca, AI ile yazılmış özeti.' },
];
const TIERS = [
    {
        name: 'Topluluk',
        body: 'Bu site. Fiyatlar her saatte yenilenir ve kenardan herkes tarafından paylaşılır. Grafikler canlı kalır.',
        cta: { label: 'Başla', href: '/sign-up' },
    },
    {
        name: 'OpenStock Bulut',
        body: 'Aynı uygulama, canlı fiyatlar ve e-posta fiyat uyarılarıyla, piyasa veri anahtar havuzunda barındırılır. Kurulum gerektirmez.',
        cta: { label: 'Discord\'ta Bildirim Al', href: DISCORD_URL },
    },
    {
        name: 'Kendi Sunucuda Çalıştır',
        body: 'Kendi sunucunuzda, kendi Finnhub anahtarlarınızla çalıştırın: siz ve ekibiniz için canlı fiyatlar ve uyarılar.',
        cta: { label: 'Kurulum Rehberi', href: '#self-host' },
    },
];
export default async function LandingPage() {
    const [session, repo] = await Promise.all([getSession(), getRepoStats()]);
    const start = session?.user ? { href: '/dashboard', label: "Kontrol Paneli'ni Aç" } : { href: '/sign-up', label: 'Ücretsiz Başla' };

    return (
        <>
            <section id="hero" className="mx-auto mt-10 max-w-[1200px] scroll-mt-24 px-5">
                <SectionHead
                    kicker="Piyasa Takibi"
                    title="Hisse, kripto ve piyasa verilerini tek bir yerde takip edin."
                    sub="Ücretsiz, açık kaynaklı ve herkesin kullanımına açık. Grafikler, izleme listeleri ve fiyat uyarıları dahil."
                />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
                    <IconCard key="1" icon={CandlestickChart} title={FEATURES[0].title}>{FEATURES[0].body}</IconCard>
                    <IconCard key="2" icon={Bell} title={FEATURES[1].title}>{FEATURES[1].body}</IconCard>
                    <IconCard key="3" icon={MessagesSquare} title={FEATURES[2].title}>{FEATURES[2].body}</IconCard>
                    <IconCard key="4" icon={Grid3x3} title={FEATURES[3].title}>{FEATURES[3].body}</IconCard>
                    <IconCard key="5" icon={Command} title={FEATURES[4].title}>{FEATURES[4].body}</IconCard>
                    <IconCard key="6" icon={MailOpen} title={FEATURES[5].title}>{FEATURES[5].body}</IconCard>
                </div>
            </section>
            <section id="data" className="mx-auto mt-28 max-w-[1200px] scroll-mt-24 px-5">
                <SectionHead
                    kicker="Veri"
                    title="Pick how fresh your numbers are."
                    sub="Charts always stream live from TradingView. Quotes, watchlists and alerts come from Finnhub, and this is how often they update."
                />
                <div className="grid gap-3 lg:grid-cols-3">
                    {TIERS.map((tier) => (
                        <IconCard
                            key={tier.name}
                            icon={Clock}
                            title={tier.name}
                            footer={<a href={tier.cta.href} target={tier.cta.href.startsWith('http') ? '_blank' : '_self'} rel="noreferrer" className="btn w-full">{tier.cta.label}</a>}
                        >
                            {tier.body}
                        </IconCard>
                    ))}
                </div>
            </section>

            <section id="self-host" className="mx-auto mt-28 grid max-w-[1200px] scroll-mt-24 items-start gap-10 px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
                <div>
                    <SectionHead
                        kicker="Self-host"
                        title="Your server, your keys, live quotes."
                        sub="Add as many free Finnhub keys as you like: each one adds 60 requests a minute. Switch the data mode to realtime and prices refresh every 15 seconds."
                    />
                    <a href={`${REPO_URL}#docker-setup`} target="_blank" rel="noreferrer" className="btn btn-ghost">Full setup in the README</a>
                </div>
                <div className="hatch">
                    <pre className="card mono overflow-x-auto p-5 text-[13px] leading-7 text-muted-foreground">
                        <span className="text-faint">$ </span><span className="text-foreground">git clone ${REPO_URL}.git</span>{'\n'}
                        <span className="text-faint">$ </span><span className="text-foreground">cd OpenStock</span>{'\n\n'}
                        <span className="text-faint"># .env (every variable is in the README)</span>{'\n'}
                        <span className="text-brand-ink">FINNHUB_API_KEYS</span>=key_one,key_two,key_three{'\n'}
                        <span className="text-brand-ink">NEXT_PUBLIC_OPENSTOCK_DATA_MODE</span>=realtime{'\n\n'}
                        <span className="text-faint">$ </span><span className="text-foreground">docker compose up -d --build</span>
                    </pre>
                </div>
            </section>

            <section className="mx-auto mt-28 max-w-[1200px] px-5">
                <div className="hatch">
                    <div className="card grid gap-10 p-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:p-12">
                        <div>
                            <p className="kicker text-brand-ink">OpenStock</p>
                            <blockquote className="mt-4 text-[26px] font-semibold leading-snug tracking-[-0.03em] md:text-[30px]">
                                Teknoloji herkese ait olmalı. Bilgi açık, ücretsiz ve erişilebilir olmalı.
                            </blockquote>
                            <div className="mt-8 flex flex-wrap gap-2">
                                <Link href={start.href} className="btn btn-primary h-11 px-5 text-[15px]">{start.label}</Link>
                                <Link href="/about" className="btn btn-ghost h-11 px-5 text-[15px]">Read the manifesto</Link>
                            </div>
                        </div>
                        {repo && (
                            <dl className="grid grid-cols-2 content-end gap-3">
                                {[
                                    ['Yıldızlar', formatCount(repo.stars)],
                                    ['Forklar', formatCount(repo.forks)],
                                    ['Lisans', repo.license ?? 'AGPL-3.0'],
                                    ['Yazıldığı Dil', 'TypeScript'],
                                ].map(([label, value]) => (
                                    <div key={label} className="bento-tile col-span-1 bg-page">
                                        <dt className="kicker">{label}</dt>
                                        <dd className="bento-value text-[26px]">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </div>
                </div>
            </section>

            <section className="mx-auto mt-28 max-w-[1200px] px-5">
                <div className="hatch">
                    <div className="card p-8 text-center md:p-12">
                        <p className="kicker text-brand-ink">Uygulama Sahibi</p>
                        <h2 className="text-[26px] font-bold leading-tight md:text-[32px]">{APP_OWNER_NAME}</h2>
                        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground max-w-[600px] mx-auto">
                            {APP_OWNER_DESCRIPTION}
                        </p>
                    </div>
                </div>
            </section>
        </>
    );
}

