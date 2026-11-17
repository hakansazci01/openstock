'use client';
import { useEffect, useRef, useState } from "react";

type WidgetState = 'idle' | 'loading' | 'ready' | 'error';

// Mounts a TradingView embed once per script + config. Size changes (e.g. fullscreen) must not
// re-run this: re-creating the embed wipes indicators the user added.
const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown> = {}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [state, setState] = useState<WidgetState>('idle');
    const mountedRef = useRef(false);

    // Config'i güvenle serialize et - undefined/null/boş durumları karşıla
    let serializedConfig = '{}';
    try {
        serializedConfig = JSON.stringify(config ?? {});
    } catch {
        serializedConfig = '{}';
    }

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        mountedRef.current = true;
        setState('loading');

        // Remove only existing widget children, not everything React manages
        const existingWidget = container.querySelector('.tradingview-widget-container__widget');
        const existingScript = container.querySelector('script');
        if (existingWidget && container.contains(existingWidget)) container.removeChild(existingWidget);
        if (existingScript && container.contains(existingScript)) container.removeChild(existingScript);

        const widgetDiv = document.createElement('div');
        widgetDiv.className = 'tradingview-widget-container__widget';
        widgetDiv.style.width = '100%';
        widgetDiv.style.height = '100%';
        container.appendChild(widgetDiv);

        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        script.innerHTML = serializedConfig;

        let timedOut = false;
        const timeoutId = setTimeout(() => {
            timedOut = true;
            if (mountedRef.current && state === 'loading') setState('error');
        }, 15000);

        script.onload = () => {
            if (!timedOut && mountedRef.current) setState('ready');
        };

        script.onerror = () => {
            if (!timedOut && mountedRef.current) setState('error');
        };

        container.appendChild(script);

        return () => {
            mountedRef.current = false;
            clearTimeout(timeoutId);
            // Remove only our created elements, with safety check
            const w = container.querySelector('.tradingview-widget-container__widget');
            const s = container.querySelector('script');
            if (w && container.contains(w)) container.removeChild(w);
            if (s && container.contains(s)) container.removeChild(s);
        };
    }, [scriptUrl, serializedConfig]);

    return { containerRef, state };
};
export default useTradingViewWidget;