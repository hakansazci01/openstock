import Image from 'next/image';
import { Code, Globe, Heart, Shield, User } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';
import SectionHead from '@/components/marketing/SectionHead';
import IconCard from '@/components/marketing/IconCard';
import { APP_OWNER_DESCRIPTION, APP_OWNER_EMAIL, APP_OWNER_NAME, GOOD_FIRST_ISSUES_URL, REPO_URL } from '@/lib/constants';

export const metadata = {
    title: 'Hakkında | Hakan Borsa Analizi',
    description: 'Hakan Borsa Analizi (hakanborsa) tarafından işletilen, finansal verileri ve al-sat sinyallerini tek bir yerde sunan açık kaynaklı borsa takip uygulamasıdır.',
};

const PRINCIPLES = [
    { icon: Globe, title: 'Açık erişim', body: 'Temelde engelleme duvarı yok. Grafikler, izleme listeleri ve araştırmalar herkes için ücretsiz kalır, kendi sunucuda barındırma her şeyi açar.' },
    { icon: Code, title: 'Açık kaynak', body: 'Tamamen şeffaf kod tabanı. Algoritmalarımızı denetleyin, özellik ekleyin ve beraber inşa edin.' },
    { icon: Heart, title: 'Topluluk odaklı', body: 'Bağışlar ve gönüllülerle desteklenir. Sahiplere değil, kullanıcılara yanıt veririz.' },
];

export default function AboutPage() {
    return (
        <>
            <PageHero
                kicker="About"
                title="Herkese yönelik araçlar."
                sub="Finansal zekanın engelleme duvarı arkasında kilitli olmaması gerektiğine inanıyoruz. OpenStock topluluk tarafından, topluluk için inşa edilmiştir."
            >
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn btn-primary h-11 px-5 text-[15px]">Kodu görüntüle</a>
                <a href={GOOD_FIRST_ISSUES_URL} target="_blank" rel="noreferrer" className="btn btn-ghost h-11 px-5 text-[15px]">Katkıda bulun</a>
            </PageHero>

            <section className="mx-auto mt-20 max-w-[1200px] px-5">
                <SectionHead kicker="Prensipler" title="Ödün vermekte olmadığımız konular." />
                <div className="grid gap-3 md:grid-cols-3">
                    {PRINCIPLES.map(({ icon, title, body }) => <IconCard key={title} icon={icon} title={title}>{body}</IconCard>)}
                </div>
            </section>

            <section className="mx-auto mt-24 max-w-[1200px] px-5">
                <div className="hatch">
                    <div className="card grid items-center gap-10 p-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:p-12">
                        <div className="flex flex-col gap-4">
                            <p className="kicker text-brand-ink">OpenStock</p>
                            <h2 className="text-[30px] font-bold leading-tight tracking-[-0.04em]">Basit bir sinirlenmenin sonucu.</h2>
                            <p className="text-[16px] leading-relaxed text-muted-foreground">
                                Güçlü finansal araçlar neden bu kadar pahalı? OpenStock bizim cevabımız.
                            </p>
                            <p className="text-[16px] leading-relaxed text-muted-foreground">
                                Biz, Hakan Borsa Analizi tarafından geliştirilen,finansal verileri ve al-sat sinyallerini tek bir yerde sunan açık kaynaklı bir hisse takipçisiyiz.
                            </p>
                            <a href="https://github.com/hakanborsa/OpenStock" target="_blank" rel="noreferrer" className="btn btn-ghost mt-2 self-start">
                                GitHub’deki Hakan Borsa Analizi
                            </a>
                        </div>
                        <div className="relative grid aspect-square max-h-[340px] place-items-center rounded-[16px] bg-page shadow-[inset_0_0_0_1px_var(--line)]">
                            <Image src="/assets/icons/odsLogo.svg" alt="Hakan Borsa Analizi" fill className="object-contain p-16 opacity-90" />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto mt-24 max-w-[1200px] px-5">
                <div className="hatch">
                    <div className="card grid items-center gap-10 p-8 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:p-12">
                        <div className="flex flex-col gap-4">
                            <p className="kicker text-brand-ink">Uygulama Sahibi</p>
                            <h2 className="text-[30px] font-bold leading-tight tracking-[-0.04em]">{APP_OWNER_NAME}</h2>
                            <p className="text-[16px] leading-relaxed text-muted-foreground">
                                {APP_OWNER_DESCRIPTION}
                            </p>
                            <p className="text-[16px] leading-relaxed text-muted-foreground">
                                Tüm analizler, al-sat sinyalleri ve fiyat uyarıları {APP_OWNER_NAME} tarafından işletilmektedir.
                            </p>
                            <a href={`mailto:${APP_OWNER_EMAIL}`} target="_blank" rel="noreferrer" className="btn btn-ghost mt-2 self-start">
                                {APP_OWNER_EMAIL} ile İletişime Geçin
                            </a>
                        </div>
                        <div className="relative grid aspect-square max-h-[340px] place-items-center rounded-[16px] bg-page shadow-[inset_0_0_0_1px_var(--line)]">
                            <Shield className="size-24 text-brand-ink opacity-90" />
                            <User className="size-16 text-brand-ink opacity-70 absolute bottom-2 right-2" />
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
