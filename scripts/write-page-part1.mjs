import fs from 'fs';

let content = `import Link from "next/link";
import { ArrowUpRight, Bell, CandlestickChart, Command, GitPullRequest, Grid3x3, MailOpen, MessagesSquare, Star } from "lucide-react";
import { MarketDial, MarketStatus } from "@/components/landing/MarketClock";
import ProductPreview from "@/components/landing/ProductPreview";
import SectionHead from "@/components/marketing/SectionHead";
import IconCard from "@/components/marketing/IconCard";
import { getSession } from "@/lib/better-auth/auth";
import { formatCount, getRepoStats } from "@/lib/github";
import { cn } from "@/lib/utils";
import { DISCORD_URL, GOOD_FIRST_ISSUES_URL, REPO_URL } from "@/lib/constants";

const FEATURES = [
    { icon: CandlestickChart, title: 'Hareketli Grafikler', body: 'Her listed şirket için TradingView mum grafikleri, teknik göstergeler ve finansal tablolar, tam ekran görünüm.' },
    { icon: Bell, title: 'E-posta Uyarıları', body: 'OpenStock Cloud ile hedef fiyatı üst veya altta belirleyin, her beş dakikada bir kontrol eder ve ulaştığında size yazıyoruz.' },
    { icon: MessagesSquare, title: 'Tek Seferde Duygu Analizi', body: 'Reddit, X.com, haberler ve Polymarket\\'ten gelen buğulu ve ascı yatırımcı duygusu, her hisse için yan yana karşılaştırılır.' },
    { icon: Grid3x3, title: 'Tüm Piyasa', body: 'Sektör ısı haritası, hareket edenler ve önemli haberler, tek ekranda çan vurmadan önce.' },
    { icon: Command, title: '⌘K ile Herşeyi Bul', body: 'Finnhub\\'ın kapsadığı her borsada arama yapın, bir hisseyi tarayıcı sekmesi gibi bir sekmede açın.' },
    { icon: MailOpen, title: 'Pazartesi Özeti', body: 'İzlediğiniz hisseler için haftanın haberlerinin kısaca, AI ile yazılmış özeti.' },
];

const TIERS = [
    {
        name: 'Topluluk', price: 'Ücretsiz', cadence: 'Saatlik', perHour: 1,
        body: 'Bu site. Fiyatlar her saatte yenilenir ve kenardan herkes tarafından paylaşılır. Grafikler canlı kalır.',
        cta: { label: 'Başla', href: '/sign-up' },
    },
    {
        name: 'OpenStock Bulut', price: '\\$5', per: '/month', tag: 'Yakında', cadence: 'Her 15 Saniyede Bir', perHour: 240,
        body: 'Aynı uygulama, canlı fiyatlar ve e-posta fiyat uyarılarıyla, piyasa veri anahtar havuzunda barındırılır. Kurulum gerektirmez.',
        cta: { label: 'Discord\\'ta Bildirim Al', href: DISCORD_URL },
    },
    {
        name: 'Kendi Sunucuda Çalıştır', price: 'Ücretsiz', cadence: 'Sizin Kararınız', perHour: 240,
        body: 'Kendi sunucunuzda, kendi Finnhub anahtarlarınızla çalıştırın: siz ve ekibiniz için canlı fiyatlar ve uyarılar.',
        cta: { label: 'Kurulum Rehberi', href: '#self-host' },
    },
];

const SUPPORT = [
    {
        icon: GitPullRequest, title: 'Katkıda Bulun',
        body: 'İyi ilk bir sorun seçin, belgeleri geliştirin veya bir ekran tasarlayın. Her birleştirilen pull request OpenStock\\'u hareket ettirir.',
        cta: { label: 'İlk Adım İçin Sorunlar', href: GOOD_FIRST_ISSUES_URL },
    },
    {
        icon: Star, title: 'Sözü Dağıt',
        body: 'Depoyu yıldızlayın ve neredeyse kullanmadığı bir terminal için para ödemeyen birisiyle paylaşın.',
        cta: { label: 'GitHub\\'da Yıldızla', href: REPO_URL },
    },
];

const CadenceRail = ({ perHour }: { perHour: number }) => (
    <div
        className="h-7 rounded-md bg-page shadow-[inset_0_0_0_1px_var(--line)]"
        style={{
            backgroundImage: perHour > 1
                ? 'repeating-linear-gradient(90deg, var(--brand) 0 1px, transparent 1px calc(100% / ' + perHour + '))'
                : 'linear-gradient(90deg, var(--brand) 0 2px, transparent 2px)',
        }}
        aria-hidden
    />
);

export default async function LandingPage() {
    const [session, repo] = await Promise.all([getSession(), getRepoStats()]);
    const start = session?.user ? { href: '/dashboard', label: 'Kontrol Paneli\\'ni Aç' } : { href: '/sign-up', label: 'Ücretsiz Başla' };

    return (
        <>
            <section id="hero" className="mx-auto mt-10 max-w-[1200px] scroll-mt-24 px-5">
                <SectionHead
                    kicker="Piyasa Takibi"
                    title="Hisse, kripto ve piyasa verilerini tek bir yerde takip edin."
                    sub="Ücretsiz, açık kaynaklı ve herkesin kullanımına açık. Grafikler, izleme listeleri ve fiyat uyarıları dahil."
                />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
                    {FEATURES.map(({ icon: Icon, title, body }) => (
                        <IconCard
                            key={title}
                            icon={<Icon className="size-6 text-brand-ink" />}
                            title={title}
                            body={body}
                        />
                    ))}
                </div>
            </section>
`;

fs.writeFileSync('app/(marketing)/page.tsx', content, 'utf-8');
console.log('Part 1 written');

