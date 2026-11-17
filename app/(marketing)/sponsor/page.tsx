import { Check, Cloud, Minus, Users } from "lucide-react";
import IconCard from "@/components/marketing/IconCard";
import { getRepoStats, formatCount } from "@/lib/github";
import { FUNDING_USES, REGISTERED_USERS, SPONSOR_CONTACT_EMAIL, SPONSOR_GOAL, SPONSOR_TIERS, type SponsorTierId } from "@/lib/sponsors";

export const metadata = {
    title: 'OpenStock’u sponsorlayın',
    description: 'Ücretsiz, açık kaynak piyasa verilerini destekleyin. Aylık katmanlar, tek seferlik bağışlar veya iş ortaklığı hakkında konuşun.',
};

const MAILTO = `mailto:${SPONSOR_CONTACT_EMAIL}?subject=Sponsoring%20OpenStock`;

const PLACEMENTS: { label: string; from: SponsorTierId }[] = [
    { label: 'README sponsor listesinde isim', from: 'backer' },
    { label: 'Sponsor duvarında isim ve avatar', from: 'supporter' },
    { label: 'Logo her genel sayfanın altbilgisinde', from: 'company' },
    { label: 'README’de logo', from: 'company' },
    { label: 'Giriş sayfasında logo', from: 'partner' },
    { label: 'Uygulama kenar çubuğunda sponsor yeri', from: 'partner' },
];
const TIER_ORDER: SponsorTierId[] = ['backer', 'supporter', 'company', 'partner'];

const FAQ = [
    ['Nasıl ödeme yaparım?', 'GitHub Sponsors üzerinden, kredi kartı veya PayPal ile. Aylık bir miktar seçin veya tek seferlik bağış yapın.'],
    ['Durdurabilir miyim?', 'Evet, GitHub Sponsors ayarlarından istediğiniz zaman.'],
    ['Şirket olarak sponsor olabilir miyiz?', 'Evet. Kuruluşunuzun GitHub hesabından sponsor olun, ardından logonuzu ve bağlantınızı bize gönderin. Fatura veya özel bir anlaşma için bize konuşun.'],
];

export default async function SponsorPage() {
    const repo = await getRepoStats();
    const goalPercent = Math.min(100, (SPONSOR_GOAL.current / SPONSOR_GOAL.target) * 100);
    const fundingTotal = FUNDING_USES.reduce((sum, use) => sum + (use.monthly ?? 0), 0);

    return (
        <div className="mx-auto max-w-[1200px] px-5">
            <section className="grid items-end gap-10 pt-14 md:pt-20 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div>
                    <p className="kicker flex items-center gap-2 text-brand-ink"><span className="live-dot" /> Sponsorlar için açık</p>
                    <h1 className="mt-4 text-[44px] font-bold leading-[1.02] tracking-[-0.05em] md:text-[64px]">Back free<br />market data.</h1>
                    <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                        OpenStock, {REGISTERED_USERS} kayıtlı kullanıcıya sahip açık kaynaklı bir piyasa terminalidir{repo ? `, GitHub’de ${formatCount(repo.stars)} yıldız ile` : ''}.
                        Sponsorlar, terminal ödeyemeyen herkes için ücretsiz ve bağımsız kalmasını sağlar.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-2">
                        <a href="#tiers" className="btn btn-primary h-11 px-5 text-[15px]">Katmanları görüntüle</a>
                        <a href={MAILTO} className="btn btn-ghost h-11 px-5 text-[15px]">Bize konuşun</a>
                    </div>
                </div>

                <div className="hatch">
                    <div className="card flex flex-col gap-4 p-5">
                        <div className="flex items-baseline justify-between gap-3">
                            <p className="kicker">Hedef</p>
                            <p className="num text-[13px] text-faint">{goalPercent}%</p>
                        </div>
                        <div className="h-1 w-full bg-hover rounded-full">
                            <div className="h-full bg-brand-soft rounded-full" style={{ width: `${goalPercent}%` }} />
                        </div>
                        <p className="text-[13px] text-faint">
                            {SPONSOR_GOAL.current >= SPONSOR_GOAL.target
                                ? <>OpenStock çalıştırmak yaklaşık <b className="text-foreground">${fundingTotal} aylık</b>.</>
                                : <>Bilinen maliyetler şuana kadar: <b className="text-foreground">${fundingTotal} aylık</b>.</>}</p>
                    </div>
                </div>

                <div className="mt-10 grid gap-3 md:grid-cols-2">
                    <IconCard icon={Cloud} title="OpenStock Cloud hosting ödemesini üstlenecek">
                        Cloud ($5 aylık, yakında geliyor) canlı fiyatlar ve fiyat uyarıları ekler. Aboneleri, barındırılan uygulamanın ihtiyaç duyduğu sunucuları, veritabanını ve piyasa verilerini karşılar, böylece ücretsiz site bağışlara bağlı kalmadan çevrimiçi kalmaya devam eder.
                    </IconCard>
                    <IconCard icon={Users} title="Sponsorlar topluluğu hareketli tutar">
                        Sponsorluklar OpenStock’un arkasında harcanan zaman için ödeme yapar: topluluk pull requestlerinin incelenmesi, hata düzeltmeleri ve özelliklerin taşınması {REGISTERED_USERS} kişinin beklediği hızda, temel özelliklerin herkes için ücretsiz kalmasıyla.
                    </IconCard>
                </div>
            </section>

            <section className="mt-24">
                <p className="kicker text-brand-ink">Yerleşimler</p>
                <h2 className="mt-2 text-[28px] font-bold tracking-[-0.04em] md:text-[34px]">Adınızın göründüğü yerler.</h2>
                <div className="hatch mt-8">
                    <div className="card overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Placement</th>
                                    {TIER_ORDER.map((id) => <th key={id} className="text-center">{SPONSOR_TIERS.find((t) => t.id === id)!.name}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {PLACEMENTS.map(({ label, from }) => (
                                    <tr key={label}>
                                        <td className="font-semibold text-foreground">{label}</td>
                                        {TIER_ORDER.map((id) => (
                                            <td key={id} className="text-center">
                                                {TIER_ORDER.indexOf(id) >= TIER_ORDER.indexOf(from)
                                                    ? <Check className="mx-auto size-4 text-brand-ink" aria-label="Dahil" />
                                                    : <Minus className="mx-auto size-4 text-line-strong" aria-label="Dahil değil" />}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className="mt-24 grid gap-3 md:grid-cols-3">
                {FAQ.map(([q, a]) => (
                    <div key={q} className="hatch">
                        <div className="card h-full p-5">
                            <h3 className="font-bold">{q}</h3>
                            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{a}</p>
                        </div>
                    </div>
                ))}
            </section>
        </div>
    );
}
