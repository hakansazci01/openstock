import Link from "next/link";
import { BookOpen, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
    return (
        <div className="flex flex-col gap-6 items-center text-center">
            <span className="grid size-16 place-items-center rounded-full bg-hover">
                <BookOpen className="size-8 text-faint" />
            </span>
            <div>
                <h1 className="text-3xl font-bold text-foreground">Sayfa bulunamadı</h1>
                <p className="mt-2 text-[13px] text-faint">
                    İstediğiniz sayfa taşımış veya kaldırılmış. Aşağıdaki bağlantılardan başlangıç yapabilirsiniz.
                </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
                <Link href="/" className="btn btn-primary">
                    <Home className="size-4" /> Başla
                </Link>
                <Link href="/dashboard" className="btn btn-ghost">
                    <ArrowLeft className="size-4" /> İzleme Listesi
                </Link>
                <Link href="/bots" className="btn btn-ghost">
                    <BookOpen className="size-4" /> Botlar
                </Link>
            </div>
            <Link href="/help" className="text-[12px] text-faint hover:text-foreground underline underline-offset-2">
                Yardım &amp; Sık Sorulan Sorular
            </Link>
        </div>
    );
}
