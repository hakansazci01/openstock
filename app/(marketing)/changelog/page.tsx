import Link from "next/link";
import Image from "next/image";
import PageHero from "@/components/marketing/PageHero";
import SectionHead from "@/components/marketing/SectionHead";
import { GOOD_FIRST_ISSUES_URL } from "@/lib/constants";
import { MAINTAINER, RELEASES, type Credit } from "@/lib/changelog";


export const metadata = {
    title: 'Değişiklikler',
    description: 'OpenStock’ta her şey değişti. Sürüm sürüm, Eylül 2025’den başladığımızdan beri.',
};



const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const creditLabel = ({ prs = [], issues = [] }: Credit) =>
    [prs.length ? plural(prs.length, 'PR') : '', issues.length ? plural(issues.length, 'issue') : ''].filter(Boolean).join(' · ');
const creditTitle = ({ prs = [], issues = [] }: Credit) =>
    [prs.length ? `Pull requests ${prs.map((n) => `#${n}`).join(' ')}` : '', issues.length ? `Issues ${issues.map((n) => `#${n}`).join(' ')}` : ''].filter(Boolean).join(' · ');

const allCredits = RELEASES.flatMap((r) => r.credits);
const seen = new Set<string>();
const CONTRIBUTORS = allCredits.filter((c) => !(seen.has(c.login) || seen.add(c.login)));

const Avatar = ({ login, size }: { login: string; size: number }) => (
    <Image src={`https://github.com/${login}.png?size=${size * 2}`} alt="" width={size} height={size} loading="lazy" className="flex-none rounded-full bg-page" />
);

export default function ChangelogPage() {
    return (
        <>
            <PageHero
                kicker="Changelog"
                title="OpenStock’ta her şey değişti."
                sub="Eylül 2025’den başladığımızdan beri her yayın, düz sözlerle. Her değişiklik GitHub üzerindeki pull request bağlantısıyla bağlanır."
            >
                <Link href="/dashboard" className="btn btn-primary h-11 px-5 text-[15px]">Kontrol panelini aç</Link>
                <a href="#Katkıda bulunanlar" className="btn btn-ghost h-11 px-5 text-[15px]">Meet the {CONTRIBUTORS.length} Katkıda bulunanlar</a>
            </PageHero>

            <ol className="mx-auto mt-16 max-w-[1200px] px-5">
                {RELEASES.map((release) => {
                    
                    return (
                        <li key={release.id} className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)] md:gap-8">
                            <div className="md:sticky md:top-24 md:self-start md:pt-0.5 md:text-right">
                                <p className="kicker text-foreground">{release.date}</p>
                            </div>
                            <div className="hatch">
                                <div className="card flex flex-col gap-3 p-5">
                                    <h2 className="text-[22px] font-bold tracking-[-0.03em]">{release.title}</h2>
                                    <p className="text-[15px] leading-relaxed text-muted-foreground">{release.summary}</p>
                                    <ul className="flex flex-col gap-2.5 text-[14px] leading-relaxed">
                                        {release.highlights?.map((h) => (
                                            <li key={h} className="flex gap-2.5">
                                                <span className="mt-0.5 size-4 flex-none text-brand-ink">✓</span>
                                                <span>{h}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <span className="kicker mr-1">Teşekkürler</span>
                                {release.credits.map((credit) => (
                                    <a
                                        key={credit.login}
                                        href={`https://github.com/${credit.login}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={creditTitle(credit)}
                                        className="flex items-center gap-2 rounded-full bg-card py-1 pl-1 pr-3 shadow-[inset_0_0_0_1px_var(--line)] transition-colors hover:bg-hover"
                                    >
                                        <Avatar login={credit.login} size={22} />
                                        <span className="text-[13px] font-semibold text-foreground">{credit.login}</span>
                                        <span className="text-[12px] text-faint">{creditLabel(credit)}</span>
                                    </a>
                                ))}
                            </div>
                        </li>
                    );
                })}
            </ol>

            <section id="Katkıda bulunanlar" className="mx-auto mt-24 max-w-[1200px] scroll-mt-24 px-5">
                <SectionHead
                    kicker="Katkıda bulunanlar"
                    title={`Built by ${CONTRIBUTORS.length} people.`}
                    sub="Yukarıdaki bir sürümü şekillendiren her pull request veya sorun sahibi. Teşekkürler: bu sizin çalışınızdır."
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {CONTRIBUTORS.map((person) => (
                        <a key={person.login} href={`https://github.com/${person.login}`} target="_blank" rel="noreferrer" title={creditTitle(person)} className="hatch group">
                            <div className="card flex items-center gap-3 p-4 transition-colors group-hover:bg-hover">
                                <Avatar login={person.login} size={40} />
                                <div className="min-w-0">
                                    <p className="flex items-center gap-2 font-semibold">
                                        <span className="truncate">{person.login}</span>
                                        {person.login === MAINTAINER && <span className="pill is-brand shrink-0">Maintainer</span>}
                                    </p>
                                    <p className="text-[13px] text-faint">{creditLabel(person)}</p>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
                <p className="mt-6 text-[14px] text-faint">
                    Burada olmak ister misiniz? Birini seçin{' '}
                    <a href={GOOD_FIRST_ISSUES_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink hover:underline">İlk sorun</a>
                    {' '}veya karşılaştığınız bir hatayı raporlayın.
                </p>
            </section>
        </>
    );
}


