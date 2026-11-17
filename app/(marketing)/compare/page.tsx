import type { Metadata } from 'next';
import Link from 'next/link';
import PageHero from '@/components/marketing/PageHero';
import { GUIDES } from '@/lib/seo/comparisons';
import { siteUrl } from '@/lib/seo/site';

const title = 'Rehberler | OpenStock';
const description = "OpenStock ne ve değildir: TradingView grafikleri, bir izleme listesi, e-posta uyarıları ve kendi sunucuda barındırma seçeneğine sahip açık kaynaklı bir hisse takipçisidir. Gönüllü karşılaştırmalar, hesap gerekmez.";

export function generateMetadata(): Metadata {
    const url = `${siteUrl()}/compare`;
    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: { title, description, url, siteName: 'OpenStock', type: 'website' },
        twitter: { card: 'summary', title, description },
    };
}

export default function GuideIndexPage() {
    return (
        <>
            <PageHero
                kicker="Rehberler"
                title="Whatconst title = 'Rehberler | OpenStock'|const title = 'Rehberler | OpenStock' is for."
                sub="İnsanların gerçekten sorduğu sorular için kısa, gerçekçi sayfalar. Bu sitedeki grafikler TradingView widgetlarıdır. Giriş yapmış uygulama denemek için ücretsizdir."
            />
            <section className="mx-auto mt-12 grid max-w-[1200px] gap-3 px-5 md:grid-cols-2">
                {GUIDES.map((guide) => (
                    <Link key={guide.slug} href={`/compare/${guide.slug}`} className="hatch group">
                        <article className="card flex h-full flex-col gap-3 p-6">
                            <p className="kicker text-brand-ink">{guide.kicker}</p>
                            <h2 className="text-[22px] font-bold tracking-[-0.03em] group-hover:text-brand-ink">{guide.title}</h2>
                            <p className="text-[15px] leading-relaxed text-muted-foreground">{guide.description}</p>
                        </article>
                    </Link>
                ))}
            </section>
        </>
    );
}


