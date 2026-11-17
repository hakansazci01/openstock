import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import { Tweet } from "react-tweet";
import PageHero from "@/components/marketing/PageHero";
import SectionHead from "@/components/marketing/SectionHead";


export const metadata = {
    title: 'Sevgi Duvarı | Hakan Borsa Analizi',
    description: 'Hakan Borsa Analizi (hakanborsa) destekçileri ve insanların uygulama hakkında yazdığı, gönderdiği ve filmedikleri.',
};

const SHARE_URL = 'https://x.com/intent/tweet?text=OpenStock';
const EDIT_URL = '/sponsor';

// Only real posts, videos and articles about OpenStock. X posts render live from X: add the post id, never its text.
type Praise =
    | { kind: 'post'; id: string }
    | { kind: 'video'; url: string; thumbnail?: string; title: string; channel: string }
    | { kind: 'article'; url: string; title: string; source: string };

const PRAISE: Praise[] = [
    { kind: 'post', id: '2047252137604948054' },
    { kind: 'article', source: 'Medium', title: 'OpenStock — The Free, Open-Source Stock Market App Built for Everyone', url: 'https://medium.com/coding-nexus/openstock-the-free-open-source-stock-market-app-built-for-everyone-af6ae05b87de' },
    { kind: 'post', id: '1976950915253834116' },
    { kind: 'article', source: 'Bright Coding', title: 'Stop Paying for Stock Data! OpenStock Is the Free Platform Devs Are Switching To', url: 'https://www.blog.brightcoding.dev/2026/07/22/stop-paying-for-stock-data-openstock-is-the-free-platform-devs-are-switching-to' },
    { kind: 'video', url: 'https://www.youtube.com/watch?v=-RRCzE1sXOw', thumbnail: 'https://i.ytimg.com/vi/-RRCzE1sXOw/hqdefault.jpg', title: 'Hakan Borsa Analizi/OpenStock, Gource visualisation', channel: 'Gourcer' },
    { kind: 'article', source: 'Zhihu', title: '这个牛逼的股票市场平台，在 GitHub 上开源了。', url: 'https://zhuanlan.zhihu.com/p/1963636115106951213' },
    { kind: 'article', source: 'HelloGitHub', title: 'Free and Cool Stock Market App', url: 'https://hellogithub.com/en/repository/hakanborsa/OpenStock' },
    { kind: 'post', id: '1975379365866430873' },
    { kind: 'article', source: 'PyShine', title: 'OpenStock: An Open-Source Alternative to Expensive Market Platforms', url: 'https://pyshine.com/OpenStock-Open-Source-Alternative-to-Expensive-Market-Platforms/' },
    { kind: 'video', url: 'https://www.bilibili.com/video/BV1GbH469Erp/', thumbnail: 'https://i.ytimg.com/vi/BV1GbH469Erp/hqdefault.jpg', title: 'Github 一周热点 #133: 免费的股票看板', channel: 'IT咖啡馆 on bilibili' },
    { kind: 'article', source: 'CSDN', title: '【GitHub项目推荐--OpenStock：开源股票市场平台】', url: 'https://blog.csdn.net/j8267643/article/details/153693153' },
    { kind: 'article', source: 'aibit', title: 'OpenStock: Your Free Open-Source Market Platform Alternative', url: 'https://aibit.im/en/article/openstock-your-free-open-source-market-platform-alternative' },
    { kind: 'post', id: '2073376806154219883' },
    { kind: 'article', source: 'Juejin', title: 'GitHub 热榜项目：日榜（2026-09-22）', url: 'https://juejin.cn/post/7688170153797746726' },
    { kind: 'article', source: 'CSDN', title: '开源股票数据平台OpenStock：用Next.js+React构建的免费金融分析神器', url: 'https://blog.csdn.net/libaiup/article/details/153052265' },
    { kind: 'article', source: 'daily.dev', title: 'OpenStock is an open-source alternative to expensive market platforms', url: 'https://daily.dev/posts/openstock-is-an-open-source-alternative-to-expensive-market-platforms--0cijqlabk' },
];



    ;



function PraiseCard({ praise }: { praise: Praise }) {
    if (praise.kind === 'post') return (
        <div className="hatch mb-3 break-inside-avoid">
            <div className="overflow-hidden rounded-[14px]"><Tweet id={praise.id} fetchOptions={{ next: { revalidate: 86400 } }} /></div>
        </div>
    );
    if (praise.kind === 'video') return (
        <a href={praise.url} target="_blank" rel="noreferrer" className="hatch group mb-3 break-inside-avoid">
            <div className="card overflow-hidden">
                <div className="relative aspect-video bg-page">
                    {praise.thumbnail && <Image src={praise.thumbnail} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" style={{ aspectRatio: '16 / 9' }} />}
                    <span className="absolute inset-0 grid place-items-center">
                        <span className="grid size-12 place-items-center rounded-full bg-black/65 text-white transition-transform group-hover:scale-110"><Play className="size-5 fill-current" /></span>
                    </span>
                </div>
                <div className="p-5">
                    <p className="kicker">Video · {praise.channel}</p>
                    <p className="mt-2 text-[17px] font-bold leading-snug tracking-[-0.02em]">{praise.title}</p>
                </div>
            </div>
        </a>
    );
    return (
        <a href={praise.url} target="_blank" rel="noreferrer" className="hatch group mb-3 break-inside-avoid">
            <div className="card flex flex-col gap-3 p-5">
                <p className="kicker">Article · {praise.source}</p>
                <p className="text-[17px] font-bold leading-snug tracking-[-0.02em]">{praise.title}</p>
                <span className="flex items-center gap-1 text-[13px] font-semibold text-brand-ink">
                    Read on {praise.source} <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
            </div>
        </a>
    );
}

export default function LovePage() {
    return (
        <>
            <PageHero
                kicker="Sevgi duvarı"
                title="OpenStock’u ücretsiz tuttuğunuz için teşekkürler."
                sub="Hesapları ödeyen sponsorlar, katkıda bulunan destekçiler ve onu hakkında yazan, gönderen veya filmeden herkes."
            >
                <Link href="/sponsor" className="btn btn-primary h-11 px-5 text-[15px]">Sponsor olun</Link>
                <a href={SHARE_URL} target="_blank" rel="noreferrer" className="btn btn-ghost h-11 px-5 text-[15px]">OpenStock hakkında gönderin</a>
            </PageHero>

            <section className="mt-16 flex flex-col gap-3" aria-label="Sponsors and supporters">
            </section>

            <section className="love-wall mx-auto mt-24 max-w-[1200px] px-5">
                <SectionHead kicker="Kendi sözleriyle" title="İnsanların OpenStock hakkında söyledikleri." sub="Keşfeden, kullanan ve başkalarına anlatan insanların gönderileri, videoları ve yazıları." />
                <div className="columns-1 gap-3 md:columns-2 lg:columns-3">
                    {PRAISE.map((praise) => <PraiseCard key={praise.kind === 'post' ? praise.id : praise.url} praise={praise} />)}
                </div>
                <p className="mt-6 text-[14px] text-faint">
                    OpenStock hakkında bir şeyler yaptınız mı? <a href={EDIT_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink hover:underline">Bunu bu sayfaya ekleyin</a>.
                </p>
            </section>
        </>
    );
}



