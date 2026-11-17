import { Metadata } from 'next';
import { BookOpen, ChevronDown, GitPullRequest, MessageCircle } from 'lucide-react';
import PageHero from '@/components/marketing/PageHero';
import SectionHead from '@/components/marketing/SectionHead';
import IconCard from '@/components/marketing/IconCard';
import { DISCORD_URL, REPO_URL } from '@/lib/constants';

export const metadata: Metadata = {
    title: 'Yardım | OpenStock',
    description: 'OpenStock için topluluk odaklı destek. Engelleme duvarı yok, sadece yardım.',
};

const SSS = [
    {
        question: 'OpenStock gerçekten ücretsiz mi?',
        answer: 'Evet. Hakan Borsa Analizi (hakanborsa) tarafından işletilir, destekçilerle çalışırız. Grafikler, izleme listeleri ve araştırmalar ücretsiz kalır. OpenStock Cloud, yakında geliyor, aylık $5 ile canlı fiyatlar ve e-posta fiyat uyarıları ekler. Kendi sunucuda barındırma ikisini de içerir.',
    },
    {
        question: 'İzleme listenize nasıl hisse eklerim?',
        answer: '⌘K tuşuna basın (veya kenar çubuğunda Hisseleri ara), şirketi açın, ardından İzle düğmesine basın. İçerik izleme listenizde ve kenar çubuğunda görünür.',
    },
    {
        question: 'Piyasa verileri nereden gelir?',
        answer: 'Grafikler TradingView’den canlı gelir. Fiyatlar, izleme listesi fiyatları ve uyarılar Finnhub’den gelir; bu sitede saatlik yenilenir ve her fiyat son işlem zamanı ile gösterilir.',
    },
    {
        question: 'Hangi piyasalar destekleniyor?',
        answer: 'ABD hisseleri, kripto ve döviz canlı; Kanada ve Avustralya gecikmeli; Suudi Arabistan Yahoo Finance üzerinden gecikmeli; Hindistan (BSE üzerinden) ve Almanya gün sonu. Uyarılar ABD hisseleri ve kripto için çalışır.',
    },
    {
        question: 'Uyarım çalışmadı.',
        answer: 'Fiyat uyarıları OpenStock Cloud (veya gerçek zamanlı moddaki kendi sunucu örneği) ile gelir. Burada her beş dakikada bir kontrol edilir ve fiyat hedefinizi geçtiğinde hesabınızdaki e-posta adresine gönderilir. Uyarı durumunu izleme listesi sayfasında kontrol edin.',
    },
    {
        question: 'Kod veya tasarım katkısında bulunabilir miyim?',
        answer: 'Kesinlikle. “İlk sorun” etiketli konular iyi bir başlangıçtır. Tasarımcılar, geliştiriciler ve yazarlara herkesi ağırlarız.',
    },
];

export default function HelpPage() {
    return (
        <>
            <PageHero kicker="Yardım" title="Size nasıl yardımcı olabiliriz?" sub="Herkes için topluluk destekli destek." />

            <section className="mx-auto mt-14 grid max-w-[1200px] gap-3 px-5 md:grid-cols-3">
                <IconCard icon={BookOpen} title="Nasıl çalışır" footer={<a href="/api-docs" className="btn btn-ghost w-full">Mimariyi oku</a>}>
                    Veri kaynakları, arka plan işleri ve e-postaların arkasındaki AI.
                </IconCard>
                <IconCard icon={MessageCircle} title="Topluluk sohbeti" footer={<a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-ghost w-full">Discord’a katıl</a>}>
                    Diğer kullanıcılardan ve sürücülerden yanıt alın.
                </IconCard>
                <IconCard icon={GitPullRequest} title="Hata raporla" footer={<a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer" className="btn btn-ghost w-full">Konu aç</a>}>
                    Found something broken? Tell us on GitHub.
                </IconCard>
            </section>

            <section className="mx-auto mt-24 max-w-[1200px] px-5">
                <SectionHead kicker="SSS" title="Sık sorulan sorular." />
                <div className="hatch">
                    <div className="card row-list overflow-hidden">
                        {SSS.map(({ question, answer }) => (
                            <details key={question} className="group">
                                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-foreground transition-colors hover:bg-hover/40 [&::-webkit-details-marker]:hidden">
                                    {question}
                                    <ChevronDown className="size-4 flex-none text-faint transition-transform duration-200 group-open:rotate-180" />
                                </summary>
                                <p className="max-w-3xl px-5 pb-5 text-[15px] leading-relaxed text-muted-foreground">{answer}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            <section className="mx-auto mt-24 max-w-[1200px] px-5">
                <div className="hatch">
                    <div className="card flex flex-col items-start justify-between gap-5 p-8 md:flex-row md:items-center">
                        <div>
                            <h2 className="text-[22px] font-bold tracking-[-0.03em]">Hala mı takıldınız?</h2>
                            <p className="mt-1 text-muted-foreground">Ekipimiz ve topluluğumuz e-postaları ücretsiz yanıtlar.</p>
                        </div>
                        <a href="mailto:hakansazci@gmail.com" className="btn btn-primary h-11 px-5 text-[15px]">E-posta desteği</a>
                    </div>
                </div>
            </section>
        </>
    );
}
