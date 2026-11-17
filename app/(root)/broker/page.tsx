import { getSession } from '@/lib/better-auth/auth';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import Panel from '@/components/Panel';
import { BrokerConfig } from '@/components/broker/BrokerConfig';

export const dynamic = 'force-dynamic';

export default async function BrokerPage() {
    let session;
    try {
        session = await getSession();
    } catch (err) {
        console.error('Broker page session error:', err);
        redirect('/sign-in');
    }
    if (!session?.user) redirect('/sign-in');

    return (
        <div className="flex flex-col gap-4">
            <header className="page-head">
                <div>
                    <Link href="/dashboard" className="btn btn-ghost mb-2 h-8 px-2.5 text-[12px]">
                        <ArrowLeft /> Dashboard
                    </Link>
                    <h1 className="page-title">Broker Ayarları</h1>
                    <p className="page-sub">
                        Gerçek para işlemleri için broker API kimlik bilgilerinizi yapılandırın.
                        API anahtarlarınız şifrelenmiş olarak saklanır.
                    </p>
                </div>
                <ShieldAlert className="w-6 h-6 text-red-500" />
            </header>

            <Panel title="Broker Yapılandırması" sub="Alpaca veya Binance API bağlantısı">
                <BrokerConfig />
            </Panel>
        </div>
    );
}