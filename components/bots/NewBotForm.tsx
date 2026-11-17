"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Plus, Sparkles, X, ShieldAlert, ShieldAlert as ShieldIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STRATEGIES = [
    {
        id: "sma_cross",
        label: "SMA Kesişimi",
        desc: "Hızlı hareketli ortalama, yavaş ortalamayı yukarı kestiğinde alır; aşağı kestiğinde satar.",
        fields: [
            { key: "fastPeriod", label: "Hızlı periyot", value: 10, min: 2, max: 200 },
            { key: "slowPeriod", label: "Yavaş periyot", value: 20, min: 3, max: 400 },
        ],
    },
    {
        id: "rsi_oversold",
        label: "RSI Aşırı Alım/Satım",
        desc: "RSI aşırı satım bölgesinden çıktığında alır, aşırı alım bölgesinden düştüğünde satar.",
        fields: [
            { key: "period", label: "RSI periyodu", value: 14, min: 2, max: 100 },
            { key: "oversold", label: "Aşırı satım", value: 30, min: 1, max: 49 },
            { key: "overbought", label: "Aşırı alım", value: 70, min: 51, max: 99 },
        ],
    },
    {
        id: "macd_cross",
        label: "MACD Kesişimi",
        desc: "MACD çizgisi sinyal çizgisini yukarı kestiğinde alır, aşağı kestiğinde satar.",
        fields: [
            { key: "fastPeriod", label: "Hızlı EMA", value: 12, min: 2, max: 100 },
            { key: "slowPeriod", label: "Yavaş EMA", value: 26, min: 3, max: 200 },
            { key: "signalPeriod", label: "Sinyal periyodu", value: 9, min: 2, max: 100 },
        ],
    },
    {
        id: "price_threshold",
        label: "Fiyat Eşiği",
        desc: "Belirlediğiniz alış/satış seviyeleri ile stop-loss ve take-profit kullanır.",
        fields: [
            { key: "buyThreshold", label: "Alış eşiği", value: 0, min: 0, max: 1_000_000 },
            { key: "sellThreshold", label: "Satış eşiği", value: 0, min: 0, max: 1_000_000 },
            { key: "stopLoss", label: "Stop-loss", value: 0, min: 0, max: 1_000_000 },
            { key: "takeProfit", label: "Take-profit", value: 0, min: 0, max: 1_000_000 },
        ],
    },
] as const;

const RISK_DEFAULTS: Record<string, number> = {
    positionSizePercent: 20,
    maxPositionPercent: 20,
    stopLossPercent: 2,
    takeProfitPercent: 0,
};

const RISK_FIELDS = [
    { key: "positionSizePercent", label: "İşlem başına sermaye (%)", min: 1, max: 100, step: 1, hint: "Her yeni pozisyona ayrılacak özkaynak yüzdesi." },
    { key: "maxPositionPercent", label: "Maksimum pozisyon (%)", min: 1, max: 100, step: 1, hint: "Tek sembolde tutulabilecek en yüksek özkaynak yüzdesi." },
    { key: "stopLossPercent", label: "Stop-loss (%)", min: 0, max: 90, step: 0.1, hint: "Alıştan sonra otomatik koruma emrinin mesafesi. Canlı botlarda zorunludur." },
    { key: "takeProfitPercent", label: "Take-profit (%)", min: 0, max: 1000, step: 0.1, hint: "0 = kapalı. Strateji sinyalleri pozisyonu kapatır." },
] as const;

const POPULAR = [
    { group: "BIST", symbols: ["AKBNK.IS", "GARAN.IS", "THYAO.IS", "ASELS.IS", "EREGL.IS", "SISE.IS"] },
    { group: "ABD", symbols: ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL"] },
    { group: "Kripto", symbols: ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT"] },
];

const EXCHANGES = ["BIST", "NASDAQ", "NYSE", "CRYPTO", "OTHER"];

export default function NewBotForm() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [strategy, setStrategy] = useState("sma_cross");
    const [config, setConfig] = useState<Record<string, number>>({ fastPeriod: 10, slowPeriod: 20, ...RISK_DEFAULTS });
    const [type, setType] = useState("paper");
    const [exchange, setExchange] = useState("BIST");
    const [symbols, setSymbols] = useState<string[]>([]);
    const [symbolInput, setSymbolInput] = useState("");
    const [initialCapital, setInitialCapital] = useState(10000);
    const [intervalMinutes, setIntervalMinutes] = useState(15);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeStrategy = useMemo(
        () => STRATEGIES.find((item) => item.id === strategy) ?? STRATEGIES[0],
        [strategy],
    );

    const isLive = type === "live";

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        if (type === "live" && !(Number(config.stopLossPercent) > 0)) {
            setError("Canlı bot için stop-loss yüzdesi 0'dan büyük olmalı.");
            setPending(false);
            return;
        }
        try {
            const body = {
                name,
                description,
                type,
                strategy,
                strategyConfig: config,
                symbols,
                exchange,
                initialCapital,
                intervalMinutes,
            };
            const res = await fetch("/api/bots", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Bot oluşturulamadı");
            toast.success("Bot oluşturuldu");
            router.push("/bots");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Bir hata oluştu");
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl">
            <div className="flex justify-between items-start gap-4">
                <Link href="/bots" className="btn btn-ghost">
                    <ArrowLeft className="size-4" /> Geri
                </Link>
                <h1 className="text-2xl font-bold">Yeni Bot Oluştur</h1>
            </div>

            <p className="text-faint">
                Strateji seçin, sembolleri belirleyin ve botu başlatın. Canlı botlar broker API ile gerçek emir gönderir.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <section className="hatch">
                    <div className="card">
                        <div className="flex flex-col gap-3">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                                Bot Adı
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Örn: BIST Büyük Hisse Botu"
                                className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-3 mt-3">
                            <label className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                                Açıklama
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Bot stratejisi ve hedefi hakkında kısa bilgi..."
                                rows={3}
                                className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                            />
                        </div>
                    </div>
                </section>

                <section className="hatch">
                    <div className="card">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between text-[12.5px]">
                                <span className="text-faint">Strateji</span>
                                <span className="font-semibold text-foreground">{activeStrategy.label}</span>
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                                {STRATEGIES.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                            setStrategy(s.id);
                                            const fields = s.fields.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.key]: f.value }), {});
                                            setConfig((prev) => ({ ...RISK_DEFAULTS, ...prev, ...fields }));
                                        }}
                                        className={cn(
                                            "btn",
                                            strategy === s.id ? "btn-primary" : "btn-ghost",
                                        )}
                                    >
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-faint">{activeStrategy.desc}</p>
                            <div className="grid gap-2 mt-3">
                                {activeStrategy.fields.map((f) => (
                                    <div key={f.key}>
                                        <label className="text-[11px] text-faint block mb-1">{f.label}</label>
                                        <input
                                            type="number"
                                            value={config[f.key] ?? f.value}
                                            onChange={(e) => setConfig({ ...config, [f.key]: Number(e.target.value) })}
                                            min={f.min} max={f.max}
                                            className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="hatch">
                    <div className="card">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between text-[12.5px]">
                                <span className="text-faint">Risk Yönetimi</span>
                                <span className="font-semibold text-foreground">
                                    {config.stopLossPercent > 0 ? `Stop-loss %${config.stopLossPercent}` : "Stop-loss kapalı"}
                                </span>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {RISK_FIELDS.map((f) => (
                                    <div key={f.key}>
                                        <label className="text-[11px] text-faint block mb-1">{f.label}</label>
                                        <input
                                            type="number"
                                            value={config[f.key] ?? RISK_DEFAULTS[f.key]}
                                            onChange={(e) => setConfig({ ...config, [f.key]: Number(e.target.value) })}
                                            min={f.min}
                                            max={f.max}
                                            step={f.step}
                                            className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                                        />
                                        <p className="text-[10px] text-faint mt-1">{f.hint}</p>
                                    </div>
                                ))}
                            </div>
                            {isLive && !(config.stopLossPercent > 0) && (
                                <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-[11px]">
                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                    Canlı botlarda stop-loss zorunludur; aksi halde emir gönderilmez.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="hatch">
                    <div className="card">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between text-[12.5px]">
                                <span className="text-faint">Bot Türü</span>
                                <span className="font-semibold text-foreground">{type === "live" ? "Canlı" : type === "signal" ? "Sinyal" : "Paper"}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    key="paper"
                                    type="button"
                                    onClick={() => setType("paper")}
                                    className={cn("btn", type === "paper" ? "btn-primary" : "btn-ghost")}
                                >
                                    Paper Trading
                                </button>
                                <button
                                    key="signal"
                                    type="button"
                                    onClick={() => setType("signal")}
                                    className={cn("btn", type === "signal" ? "btn-primary" : "btn-ghost")}
                                >
                                    Sadece Sinyal
                                </button>
                                <button
                                    key="live"
                                    type="button"
                                    onClick={() => setType("live")}
                                    className={cn("btn", type === "live" ? "btn-primary" : "btn-ghost", type === "live" ? "bg-red-50 border-red-200 text-red-600" : "")}
                                >
                                    Canlı (Gerçek Para)
                                </button>
                            </div>
                            <span className="text-[11px] text-faint">
                                {type === "live"
                                    ? "Gerçek para ile işlem yapar. Broker ayarlarınızı yapın."
                                    : "Canlı işlem broker entegrasyonu gerektirir. Broker ayarlarını yapın."}
                            </span>
                            {type === "live" && (
                                <div className="mt-3 p-3 rounded-md bg-red-50 border border-red-200">
                                    <ShieldAlert className="w-4 h-4 text-red-500 mr-2" />
                                    <span className="text-[11px] text-red-600">
                                        Gerçek para riski içerir. Tüm finansal sorumluluk size aittir. Broker API anahtarlarınızı /broker sayfasında yapılandırdığınızdan emin olun.
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section className="hatch">
                    <div className="card">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between text-[12.5px]">
                                <span className="text-faint">Borsa</span>
                                <span className="font-semibold text-foreground">{exchange}</span>
                            </div>
                            <select
                                value={exchange}
                                onChange={(e) => setExchange(e.target.value)}
                                className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                            >
                                {EXCHANGES.map((ex) => (
                                    <option key={ex} value={ex}>
                                        {ex}
                                    </option>
                                ))}
                            </select>

                            <div className="mt-3">
                                <label className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                                    Semboller
                                </label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {symbols.map((s) => (
                                        <span key={s} className="px-2 py-1 rounded-md bg-muted text-xs border border-input">
                                            {s}
                                            <button
                                                type="button"
                                                onClick={() => setSymbols(symbols.filter((x) => x !== s))}
                                                className="ml-1 hover:text-red-500"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                    <span className="flex items-center gap-2 px-2 py-1 rounded-md bg-input border border-input">
                                        <input
                                            type="text"
                                            value={symbolInput}
                                            onChange={(e) => setSymbolInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const s = symbolInput.trim().toUpperCase();
                                                    if (s && !symbols.includes(s)) setSymbols([...symbols, s]);
                                                    setSymbolInput("");
                                                }
                                            }}
                                            placeholder="AAPL, TSLA..."
                                            className="flex-1 border-none bg-transparent focus:ring-0 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const s = symbolInput.trim().toUpperCase();
                                                if (s && !symbols.includes(s)) setSymbols([...symbols, s]);
                                                setSymbolInput("");
                                            }}
                                            className="px-2 py-1 text-xs text-blue-600 hover:text-blue-800"
                                        >
                                            Ekle
                                        </button>
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {POPULAR.map((g) => (
                                        <div key={g.group}>
                                            <span className="text-[10px] font-bold text-faint uppercase">{g.group}</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {g.symbols.map((s) => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => {
                            const next = symbols.includes(s) ? symbols.filter((x) => x !== s) : [...symbols, s];
                            setSymbols(next);
                        }}
                                                        className={`px-2 py-1 rounded-md text-xs border ${symbols.includes(s) ? 'bg-brand-ink text-white border-brand-ink' : 'border-input hover:bg-muted text-faint'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            <button onClick={() => { const missing = g.symbols.filter(s => !symbols.includes(s)); setSymbols([...symbols, ...missing]); }} className="px-2 py-1 rounded-md text-xs border border-brand-ink bg-brand-ink/10 text-[10px] font-medium text-brand-ink hover:bg-brand-ink/20 mt-2">Tümünü Seç</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="hatch">
                    <div className="card">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between text-[12.5px]">
                                <span className="text-faint">Başlangıç Sermayesi</span>
                                <span className="font-semibold text-foreground">{initialCapital.toLocaleString("tr-TR")} $</span>
                            </div>
                            <input
                                type="number"
                                value={initialCapital}
                                onChange={(e) => setInitialCapital(Number(e.target.value))}
                                min="100"
                                step="1000"
                                className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                            />
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between text-[12.5px]">
                                    <span className="text-faint">Çalışma Aralığı</span>
                                    <span className="font-semibold text-foreground">{intervalMinutes} dk</span>
                                </div>
                                <input
                                    type="range"
                                    min="15"
                                    max="1440"
                                    step="15"
                                    value={intervalMinutes}
                                    onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                                    className="w-full accent-brand-ink"
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <button type="submit" disabled={pending} className="btn btn-primary mt-4 w-full">
                    {pending ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                        <Sparkles />
                    )}
                    Botu Oluştur
                </button>
            </form>
        </div>
    );
}