import { getEnvInfo, getSystemStats } from "@/lib/actions/admin.actions";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const [env, stats] = await Promise.all([getEnvInfo(), getSystemStats()]);

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-lg font-semibold text-foreground">Sistem Ayarları</h2>
                <p className="text-[12.5px] text-faint">
                    Entegrasyon durumu ve veritabanı istatistikleri. Değişiklik için <span className="mono">.env</span> dosyasını düzenleyip sunucuyu yeniden başlatın.
                </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="hatch">
                    <div className="section-head"><h3 className="section-title">Entegrasyonlar</h3></div>
                    <div className="card flex flex-col gap-2">
                        <StatRow label="Ortam" value={env.nodeEnv} />
                        <StatRow label="Veri Modu" value={env.dataMode === 'realtime' ? 'realtime (15 sn)' : 'cached (saatlik)'} />
                        <StatRow label="Auth URL" value={env.authUrl} />
                        <StatRow label="Finnhub" value={env.hasFinnhubKey ? '✅ Tanımlı' : '❌ Eksik'} />
                        <StatRow label="E-posta (Gmail)" value={env.hasEmailConfig ? '✅ Aktif' : '❌ Pasif'} />
                        <StatRow label="WhatsApp (Twilio)" value={env.hasTwilio ? '✅ Aktif' : '❌ Eksik'} />
                        <StatRow label="WhatsApp Alıcı" value={env.hasWhatsAppRecipient ? '✅ Tanımlı' : '❌ Eksik'} />
                        <StatRow label="AI Sağlayıcı" value={env.hasAI ? '✅ Tanımlı' : '❌ Eksik (isteğe bağlı)'} />
                        <StatRow label="Inngest" value={env.hasInngest ? '✅ Bulut anahtarı' : '⚠️ Yerel dev (inngest-cli)'} />
                    </div>
                </div>

                <div className="hatch">
                    <div className="section-head"><h3 className="section-title">Veritabanı İstatistikleri</h3></div>
                    <div className="card flex flex-col gap-2">
                        <StatRow label="Kullanıcı" value={String(stats.users)} />
                        <StatRow label="Admin" value={String(stats.admins)} />
                        <StatRow label="Hesap Kayıtları" value={String(stats.accounts)} />
                        <StatRow label="Oturumlar" value={String(stats.sessions)} />
                        <StatRow label="Botlar" value={`${stats.bots} (${stats.runningBots} çalışıyor)`} />
                        <StatRow label="İşlemler" value={String(stats.trades)} />
                        <StatRow label="Fiyat Uyarıları" value={String(stats.alerts)} />
                        <StatRow label="İzleme Listesi Girdileri" value={String(stats.watchlists)} />
                    </div>
                </div>
            </div>

            <div className="hatch">
                <div className="section-head">
                    <div>
                        <h3 className="section-title">Arka Plan Görevleri</h3>
                        <p className="section-sub">Bot zamanlayıcısı ve fiyat uyarıları Inngest ile çalışır</p>
                    </div>
                </div>
                <div className="card flex flex-col gap-2 text-[12.5px] text-faint">
                    <p>
                        Yerelde <span className="mono text-foreground">npx inngest-cli@latest dev</span> çalıştırın; uygulama
                        <span className="mono text-foreground"> http://localhost:8288</span> üzerinden fonksiyonları kaydeder.
                    </p>
                    <p>
                        Botlar ayrıca panelden <span className="font-semibold text-foreground">Şimdi Çalıştır</span> ile elle tetiklenebilir;
                        böylece Inngest olmadan da sinyal ve işlem üretirler.
                    </p>
                </div>
            </div>
        </div>
    );
}

function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-line pb-1.5 text-[12.5px] last:border-0 last:pb-0">
            <span className="text-faint">{label}</span>
            <span className="mono truncate text-right font-medium text-foreground" title={value}>{value}</span>
        </div>
    );
}
