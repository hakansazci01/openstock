/**
 * Broker registry and real-money guard rails.
 *
 * Everything that can reach a broker (order route, bot scheduler, manual bot
 * run) goes through these helpers so paper and live endpoints are never mixed
 * up, and live orders stay blocked until the operator explicitly enables them.
 */

import { BaseBrokerAdapter } from '@/lib/broker/broker-adapter';
import { AlpacaAdapter } from '@/lib/broker/adapters/alpaca.adapter';
import { BinanceAdapter } from '@/lib/broker/adapters/binance.adapter';
import { KrakenAdapter } from '@/lib/broker/adapters/kraken.adapter';
import { InteractiveBrokersAdapter } from '@/lib/broker/adapters/interactive-brokers.adapter';
import { CoinbaseAdapter } from '@/lib/broker/adapters/coinbase.adapter';
import { BybitAdapter } from '@/lib/broker/adapters/bybit.adapter';

export type SupportedBroker =
    | 'alpaca'
    | 'binance'
    | 'kraken'
    | 'interactive_brokers'
    | 'coinbase'
    | 'bybit'
    | 'custom';

export const SUPPORTED_BROKERS: SupportedBroker[] = [
    'alpaca',
    'binance',
    'kraken',
    'interactive_brokers',
    'coinbase',
    'bybit',
    'custom',
];

export const BROKER_URLS = {
    alpaca: {
        paper: 'https://paper-api.alpaca.markets',
        live: 'https://api.alpaca.markets',
    },
    binance: {
        testnet: 'https://testnet.binance.vision',
        live: 'https://api.binance.com',
    },
    kraken: {
        live: 'https://api.kraken.com',
    },
    interactive_brokers: {
        live: 'http://localhost:5000/v1/api',
        gateway: 'http://localhost:5000/v1/api',
    },
    coinbase: {
        live: 'https://api.coinbase.com',
        advanced: 'https://api.exchange.coinbase.com',
    },
    bybit: {
        testnet: 'https://api-testnet.bybit.com',
        live: 'https://api.bybit.com',
    },
} as const;

export function isSupportedBroker(value: unknown): value is SupportedBroker {
    return typeof value === 'string' && (SUPPORTED_BROKERS as string[]).includes(value);
}

export function defaultBrokerUrl(broker: SupportedBroker): string {
    switch (broker) {
        case 'alpaca':
            return BROKER_URLS.alpaca.paper;
        case 'binance':
            return BROKER_URLS.binance.live;
        case 'kraken':
            return BROKER_URLS.kraken.live;
        case 'coinbase':
            return BROKER_URLS.coinbase.advanced;
        case 'bybit':
            return BROKER_URLS.bybit.live;
        case 'interactive_brokers':
            return BROKER_URLS.interactive_brokers.live;
        default:
            return '';
    }
}

function allowedHosts(broker: SupportedBroker): Set<string> {
    switch (broker) {
        case 'alpaca':
            return new Set([
                new URL(BROKER_URLS.alpaca.paper).hostname,
                new URL(BROKER_URLS.alpaca.live).hostname,
            ]);
        case 'binance':
            return new Set([
                new URL(BROKER_URLS.binance.testnet).hostname,
                new URL(BROKER_URLS.binance.live).hostname,
            ]);
        case 'kraken':
            return new Set([new URL(BROKER_URLS.kraken.live).hostname]);
        case 'coinbase':
            return new Set([
                new URL(BROKER_URLS.coinbase.live).hostname,
                new URL(BROKER_URLS.coinbase.advanced).hostname,
            ]);
        case 'bybit':
            return new Set([
                new URL(BROKER_URLS.bybit.testnet).hostname,
                new URL(BROKER_URLS.bybit.live).hostname,
            ]);
        case 'interactive_brokers':
            return new Set([
                new URL(BROKER_URLS.interactive_brokers.live).hostname,
                'localhost',
                '127.0.0.1',
            ]);
        default:
            return new Set();
    }
}

/**
 * Accepts only the official HTTPS endpoints. A user-supplied URL would
 * otherwise let the server be pointed at an internal host (SSRF) while sending
 * the user's broker credentials in the request.
 */
export function normalizeBrokerUrl(broker: SupportedBroker, apiUrl?: string | null): string {
    const raw = (apiUrl ?? '').trim();
    if (!raw) return defaultBrokerUrl(broker);

    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error('Geçersiz broker adresi');
    }

    if (url.protocol !== 'https:') {
        throw new Error('Broker adresi https:// ile başlamalıdır');
    }
    if (!allowedHosts(broker).has(url.hostname.toLowerCase())) {
        throw new Error(`Desteklenmeyen broker adresi: ${url.hostname}`);
    }
    if (url.username || url.password) {
        throw new Error('Broker adresinde kullanıcı bilgisi olamaz');
    }

    return url.origin;
}

export function isLiveBrokerUrl(broker: SupportedBroker, apiUrl?: string | null): boolean {
    const host = (() => {
        try {
            return new URL(normalizeBrokerUrl(broker, apiUrl)).hostname.toLowerCase();
        } catch {
            return '';
        }
    })();
    const liveHosts: Record<string, string[]> = {
        alpaca: [new URL(BROKER_URLS.alpaca.live).hostname],
        binance: [new URL(BROKER_URLS.binance.live).hostname],
        kraken: [new URL(BROKER_URLS.kraken.live).hostname],
        coinbase: [
            new URL(BROKER_URLS.coinbase.live).hostname,
            new URL(BROKER_URLS.coinbase.advanced).hostname,
        ],
        bybit: [new URL(BROKER_URLS.bybit.live).hostname],
        interactive_brokers: [new URL(BROKER_URLS.interactive_brokers.live).hostname],
    };
    return liveHosts[broker]?.includes(host) ?? false;
}

/** Real-money trading is opt-in: LIVE_TRADING_ENABLED=true */
export function isLiveTradingEnabled(): boolean {
    return process.env.LIVE_TRADING_ENABLED === 'true';
}

export function assertTradingAllowed(broker: SupportedBroker, apiUrl?: string | null): void {
    if (isLiveBrokerUrl(broker, apiUrl) && !isLiveTradingEnabled()) {
        throw new Error(
            'Canlı (gerçek para) işlem kapalı. Sunucuda LIVE_TRADING_ENABLED=true ayarlanmadan emir gönderilemez.',
        );
    }
}

export function normalizeBrokerSymbol(broker: string, symbol: string): string {
    const raw = String(symbol ?? '').trim().toUpperCase().replace(/^(BINANCE:|KRAKEN:|COINBASE:|BYBIT:)/, '');
    if (!raw) throw new Error('Sembol boş olamaz');

    switch (broker) {
        case 'alpaca': {
            if (raw.includes(':') || raw.endsWith('.IS') || raw.endsWith('.SR')) {
                throw new Error(`Alpaca bu sembolü desteklemiyor: ${raw}`);
            }
            if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(raw)) {
                throw new Error(`Geçersiz Alpaca sembolü: ${raw}`);
            }
            return raw;
        }
        case 'binance': {
            if (!/^[A-Z0-9]{2,20}$/.test(raw)) {
                throw new Error(`Geçersiz Binance sembolü: ${raw}`);
            }
            const quoteAssets = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'TRY', 'EUR', 'BRL'];
            return quoteAssets.some((quote) => raw.endsWith(quote)) ? raw : `${raw}USDT`;
        }
        case 'kraken': {
            if (!/^[A-Z0-9]{2,20}$/.test(raw)) {
                throw new Error(`Geçersiz Kraken sembolü: ${raw}`);
            }
            const quoteAssets = ['USDT', 'USDC', 'USD', 'EUR'];
            return quoteAssets.some((quote) => raw.endsWith(quote)) ? raw : `${raw}USDT`;
        }
        case 'coinbase': {
            if (!/^[A-Z0-9\-]{2,20}$/.test(raw)) {
                throw new Error(`Geçersiz Coinbase sembolü: ${raw}`);
            }
            const quoteAssets = ['USDT', 'USDC', 'USD', 'EUR'];
            return quoteAssets.some((quote) => raw.endsWith(quote)) ? raw : `${raw}-USD`;
        }
        case 'bybit': {
            if (!/^[A-Z0-9]{2,20}$/.test(raw)) {
                throw new Error(`Geçersiz Bybit sembolü: ${raw}`);
            }
            const quoteAssets = ['USDT', 'USDC', 'USD'];
            return quoteAssets.some((quote) => raw.endsWith(quote)) ? raw : `${raw}USDT`;
        }
        case 'interactive_brokers': {
            if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(raw)) {
                throw new Error(`Geçersiz Interactive Brokers sembolü: ${raw}`);
            }
            return raw;
        }
        default: {
            if (!/^[A-Z0-9]{2,20}$/.test(raw)) {
                throw new Error(`Geçersiz sembol: ${raw}`);
            }
            return raw;
        }
    }
}

export type TradingLimits = {
    maxOrderNotional: number;
    maxDailyNotional: number;
};

/** Fat-finger caps. Live defaults are deliberately small; raise them in .env. */
export function getTradingLimits(broker: SupportedBroker, apiUrl?: string | null): TradingLimits {
    const live = isLiveBrokerUrl(broker, apiUrl);
    const orderFallback = live ? 100 : 10_000;
    const dailyFallback = live ? 500 : 100_000;

    const order = Number(process.env.LIVE_MAX_ORDER_NOTIONAL_USD);
    const daily = Number(process.env.LIVE_MAX_DAILY_NOTIONAL_USD);

    return {
        maxOrderNotional: Number.isFinite(order) && order > 0 ? order : orderFallback,
        maxDailyNotional: Number.isFinite(daily) && daily > 0 ? daily : dailyFallback,
    };
}

export function createBrokerAdapter(broker: string): BaseBrokerAdapter | null {
    if (broker === 'alpaca') return new AlpacaAdapter();
    if (broker === 'binance') return new BinanceAdapter();
    if (broker === 'kraken') return new KrakenAdapter();
    if (broker === 'interactive_brokers') return new InteractiveBrokersAdapter();
    if (broker === 'coinbase') return new CoinbaseAdapter();
    if (broker === 'bybit') return new BybitAdapter();
    return null;
}
