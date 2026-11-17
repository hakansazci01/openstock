'use client';

import { useEffect, useState } from "react";
import { isRealtime } from "@/lib/market-data";
import { RefreshCw } from "lucide-react";

// Honest label for how old a number is: "Live" in realtime mode, otherwise the time of the last trade.
// The time is formatted after mount, in the viewer's own time zone, so server and browser never disagree.
const DataFreshness = ({ tradeTime }: { tradeTime?: number }) => {
    const [asOf, setAsOf] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        setAsOf(tradeTime
            ? new Date(tradeTime * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : null);
    }, [tradeTime]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        window.location.reload();
    };

    if (isRealtime) {
        return (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
                <span className="live-dot" /> Canlı · 15s
                <button onClick={handleRefresh} disabled={refreshing} className="ml-2 p-1 text-faint hover:text-foreground transition-colors" title="Veriyi yenile">
                    {refreshing ? <span className="animate-spin"><RefreshCw className="size-4" /></span> : <RefreshCw className="size-4" />}
                </button>
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
            {asOf ? `${asOf} itibarıyla` : 'Gecikmeli'} · saatlik yenilenir
            <button onClick={handleRefresh} disabled={refreshing} className="ml-2 p-1 text-faint hover:text-foreground transition-colors" title="Veriyi yenile">
                {refreshing ? <span className="animate-spin"><RefreshCw className="size-4" /></span> : <RefreshCw className="size-4" />}
            </button>
        </span>
    );
};

export default DataFreshness;