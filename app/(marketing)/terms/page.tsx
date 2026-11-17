import { Metadata } from 'next';
import { AlertTriangle, Check, X } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';
import SectionHead from '@/components/marketing/SectionHead';

export const metadata: Metadata = {
    title: 'Kullanım Şartları | OpenStock',
    description: 'Topluluğumuz için adil, şeffaf ve açık şartlar.',
};

const PROMISES = [
    'Temel özellikler sonsuza dek ücretsiz kalacak.',
    'Kişisel verilerinizi asla satmayacağız.',
    'Şartlardaki değişiklikler açıkça tartışılacak.',
    'İzleme listenizin ve analizlerinizin sahibi sizsiniz.',
];

const RULES = {
    Yapın: ['Bilgiyi özgürce paylaşın', 'API’yi kişisel projeler için kullanın', 'Diğer üyeler saygı gösterin'],
    Yapmayın: ['Veriyi aşırı çekmeyin', 'API anahtarlarını paylaşmayın', 'Yüksek frekansta işlem yapmayın'],
};

export default function TermsPage() {
    return (
        <>
            <PageHero
                kicker="Şartlar · Son güncelleme Ekim 2025"
                title="Kullanım Şartları"
                sub="Güven, şeffaflık ve topluluk değerleri üzerine kurulmuştur. Gizli kargaşa yok, sadece açık kurallar var."
            />

            <section className="mx-auto mt-14 max-w-[1200px] px-5">
                <div className="hatch">
                    <div className="card flex gap-4 p-6 shadow-[inset_0_0_0_1px_oklch(0.76_0.119_70/0.35)]">
                        <AlertTriangle className="mt-0.5 size-5 flex-none text-warn" />
                        <div>
                            <h2 className="font-bold text-warn">Yatırım uyarısı</h2>
                            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">
                                <strong className="text-foreground">OpenStock, eğitim ve analiz aracıdır, finansal danışman değildir.</strong>{' '}
                                Veriler, sadece bilgi amaçlı olarak olduğu şekilde sağlanmaktadır. Kaybetmekten korktuğunuz parayı asla yatırmayın. Her zaman kendi araştırmanızı yapın veya sertifikalı bir profesyonelle danışın.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mx-auto mt-20 max-w-[1200px] px-5">
                <SectionHead kicker="Sözümüz" title="Buna güvenebileceğiniz şeyler." />
                <div className="grid gap-3 sm:grid-cols-2">
                    {PROMISES.map((promise) => (
                        <div key={promise} className="hatch">
                            <div className="card flex h-full items-center gap-3 p-5">
                                <span className="bento-ico bg-brand-soft text-brand-ink"><Check /></span>
                                <span className="font-semibold">{promise}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="mx-auto mt-20 max-w-[1200px] px-5">
                <SectionHead kicker="Topluluk kuralları" title="Yapılacaklar ve yapılmayacaklar." />
                <div className="grid gap-3 md:grid-cols-2">
                    {([['Yapın', RULES.Yapın, Check, 'text-up'], ['Yapmayın', RULES.Yapmayın, X, 'text-down']] as const).map(([title, items, Icon, tone]) => (
                        <div key={title} className="hatch">
                            <div className="card h-full p-5">
                                <h3 className="kicker">{title}</h3>
                                <ul className="mt-3 flex flex-col gap-2.5">
                                    {items.map((item) => (
                                        <li key={item} className="flex items-center gap-2.5">
                                            <Icon className={`size-4 flex-none ${tone}`} />
                                            <span className="text-muted-foreground">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="mt-8 text-muted-foreground">
                    Questions about these terms? Email <a href="mailto:hakansazci@gmail.com" className="font-semibold text-brand-ink hover:underline">hakansazci@gmail.com</a>.
                </p>
            </section>
        </>
    );
}
