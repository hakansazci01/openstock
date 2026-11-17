"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, ShieldAlert, AlertTriangle, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type BrokerId = "alpaca" | "binance";
type BrokerMode = "paper" | "live";

type BrokerSummary = {
    broker: BrokerId;
    apiUrl: string;
    isLive: boolean;
    isConnected: boolean;
    apiKeyHint: string;
    lastSyncedAt?: string | null;
};

const BROKERS: Array<{ id: BrokerId; name: string; paperLabel: string; liveLabel: string }> = [
    { id: "alpaca", name: "Alpaca", paperLabel: "Paper", liveLabel: "Live (gerçek para)" },
    { id: "binance", name: "Binance", paperLabel: "Testnet", liveLabel: "Live (gerçek para)" },
];

const URLS: Record<BrokerId, Record<BrokerMode, string>> = {
    alpaca: {
        paper: "https://paper-api.alpaca.markets",
        live: "https://api.alpaca.markets",
    },
    binance: {
        paper: "https://testnet.binance.vision",
        live: "https://api.binance.com",
    },
};

export function BrokerConfig() {
    const [broker, setBroker] = useState<BrokerId>("alpaca");
    const [mode, setMode] = useState<BrokerMode>("paper");
    const [apiKey, setApiKey] = useState("");
    const [apiSecret, setApiSecret] = useState("");
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<BrokerSummary | null>(null);
    const [liveTradingEnabled, setLiveTradingEnabled] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [synced, setSynced] = useState(false);

    const apiUrl = useMemo(() => URLS[broker][mode], [broker, mode]);
    const isLiveSelected = mode === "live";

    const loadStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/broker", { cache: "no-store" });
            if (!res.ok) return;
            const data = await res.json();
            setSummary(data.credentials ?? null);
            setLiveTradingEnabled(Boolean(data.liveTradingEnabled));
            if (data.credentials?.broker) {
                setBroker(data.credentials.broker);
                setMode(data.credentials.isLive ? "live" : "paper");
            }
        } catch {
            // Status is best effort; the form still works.
        }
    }, []);

    useEffect(() => {
        void loadStatus();
    }, [loadStatus]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setNotice(null);
        try {
            const res = await fetch("/api/broker", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ broker, apiKey, apiSecret, apiUrl }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Kimlik bilgileri kaydedilemedi");

            setSummary(data.credentials ?? null);
            setLiveTradingEnabled(Boolean(data.liveTradingEnabled));
            setApiKey("");
            setApiSecret("");

            if (data.connected) {
                setNotice("Broker bağlantısı doğrulandı ve kaydedildi.");
            } else {
                setError(data.error || "Kaydedildi ancak broker bağlantısı doğrulanamadı.");
            }
            if (data.warning) setNotice(data.warning);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Kaydetme başarısız");
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/broker/sync", { cache: "no-store" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Senkronizasyon başarısız");
            setSynced(true);
            setNotice(
                `Senkronize edildi: ${Array.isArray(data.positions) ? data.positions.length : 0} pozisyon, ${Array.isArray(data.orders) ? data.orders.length : 0} emir.`,
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Senkronizasyon başarısız");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="hatch">
            <div className="card">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                            Broker Bağlantısı
                        </p>
                        <p className="text-[10px] text-faint">
                            Gerçek para işlemleri için broker API yapılandırması
                        </p>
                    </div>
                    {summary?.isConnected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-brand-success/10 text-brand-success text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Bağlı
                        </span>
                    ) : summary ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-bold">
                            <XCircle className="w-3 h-3" /> Bağlı değil
                        </span>
                    ) : null}
                </div>

                <div className="px-4 pb-4">
                    {summary && (
                        <div className="mb-4 rounded-md border border-line bg-muted/40 px-3 py-2 text-[11px] space-y-1">
                            <div className="flex justify-between gap-2">
                                <span className="text-faint">Kayıtlı broker</span>
                                <span className="font-semibold">
                                    {BROKERS.find((item) => item.id === summary.broker)?.name ?? summary.broker}
                                    {" · "}
                                    {summary.isLive ? "Live" : "Paper/Testnet"}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-faint">API anahtarı</span>
                                <span className="font-mono">{summary.apiKeyHint}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-faint">Adres</span>
                                <span className="font-mono break-all text-right">{summary.apiUrl}</span>
                            </div>
                        </div>
                    )}

                    {summary?.isLive && !liveTradingEnabled && (
                        <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            Canlı endpoint kayıtlı ancak sunucuda <code className="mx-1">LIVE_TRADING_ENABLED=true</code>
                            olmadığı için emir gönderilemez.
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-3">
                        <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-faint">Broker</label>
                            <select
                                value={broker}
                                onChange={(e) => setBroker(e.target.value as BrokerId)}
                                className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                                disabled={loading}
                            >
                                {BROKERS.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-faint">Hesap Türü</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setMode("paper")}
                                    disabled={loading}
                                    className={cn("btn", mode === "paper" ? "btn-primary" : "btn-ghost")}
                                >
                                    {BROKERS.find((item) => item.id === broker)?.paperLabel}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode("live")}
                                    disabled={loading}
                                    className={cn(
                                        "btn",
                                        mode === "live" ? "bg-red-600 text-white border-red-600" : "btn-ghost text-red-600",
                                    )}
                                >
                                    {BROKERS.find((item) => item.id === broker)?.liveLabel}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-faint">API Adresi</label>
                            <input
                                type="text"
                                value={apiUrl}
                                readOnly
                                className="w-full border border-input bg-muted px-3 py-2 rounded-md text-sm font-mono text-faint"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-faint">API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={summary ? `Kayıtlı: ${summary.apiKeyHint}` : "Broker API Key"}
                                autoComplete="new-password"
                                className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[11px] font-semibold text-faint">API Secret</label>
                            <input
                                type="password"
                                value={apiSecret}
                                onChange={(e) => setApiSecret(e.target.value)}
                                placeholder="Broker API Secret"
                                autoComplete="new-password"
                                className="w-full border border-input bg-input px-3 py-2 rounded-md text-sm"
                                disabled={loading}
                            />
                        </div>

                        {isLiveSelected && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-[11px]">
                                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>
                                    Canlı hesap seçildi. Kaydettiğiniz anahtarlarla <strong>gerçek para</strong> ile
                                    işlem yapılabilir. Önce paper/testnet hesabında test edin.
                                </span>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-[11px]">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {error}
                            </div>
                        )}
                        {notice && (
                            <div className="px-3 py-2 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px]">
                                {notice}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || !apiKey || !apiSecret}
                            className={cn(
                                "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                loading || !apiKey || !apiSecret
                                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                                    : "bg-brand-ink text-brand-foreground hover:bg-brand-ink/90",
                            )}
                        >
                            {loading ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                                <Save className="w-3 h-3" />
                            )}
                            {loading ? "Kaydediliyor..." : "Kaydet ve Bağlan"}
                        </button>
                    </form>

                    {summary?.isConnected && (
                        <div className="mt-4 pt-4 border-t border-line space-y-2">
                            <button
                                onClick={handleSync}
                                disabled={loading}
                                className={cn(
                                    "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    loading
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-brand-ink text-brand-foreground hover:bg-brand-ink/90",
                                )}
                            >
                                <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                                {synced ? "Tekrar Senkronize Et" : "Hesabı Senkronize Et"}
                            </button>
                            <p className="text-[10px] text-faint">
                                Bakiye, pozisyonlar ve emir geçmişi broker&apos;dan senkronize edilecek.
                            </p>
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-line">
                        <ShieldAlert className="w-3 h-3 text-red-500" />
                        <span className="text-[10px] text-red-600 ml-1">
                            ⚠️ Gerçek para işlemleri risk içerir. Tüm finansal sorumluluk size aittir.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
