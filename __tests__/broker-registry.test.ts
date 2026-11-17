import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    isSupportedBroker,
    SUPPORTED_BROKERS,
    defaultBrokerUrl,
    normalizeBrokerUrl,
    normalizeBrokerSymbol,
    createBrokerAdapter,
    isLiveBrokerUrl,
    getTradingLimits,
} from '@/lib/broker/registry';

const originalEnv = process.env;

beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.LIVE_TRADING_ENABLED = 'false';
    process.env.LIVE_MAX_ORDER_NOTIONAL_USD = '100';
    process.env.LIVE_MAX_DAILY_NOTIONAL_USD = '500';
});

afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
});

describe('Broker Registry - Supported Brokers', () => {
    it('should list all supported brokers', () => {
        expect(SUPPORTED_BROKERS).toContain('alpaca');
        expect(SUPPORTED_BROKERS).toContain('binance');
        expect(SUPPORTED_BROKERS).toContain('kraken');
        expect(SUPPORTED_BROKERS).toContain('interactive_brokers');
        expect(SUPPORTED_BROKERS).toContain('coinbase');
        expect(SUPPORTED_BROKERS).toContain('bybit');
        expect(SUPPORTED_BROKERS).toContain('custom');
    });

    it('isSupportedBroker should return true for valid brokers', () => {
        expect(isSupportedBroker('alpaca')).toBe(true);
        expect(isSupportedBroker('binance')).toBe(true);
        expect(isSupportedBroker('kraken')).toBe(true);
        expect(isSupportedBroker('interactive_brokers')).toBe(true);
        expect(isSupportedBroker('coinbase')).toBe(true);
        expect(isSupportedBroker('bybit')).toBe(true);
        expect(isSupportedBroker('custom')).toBe(true);
    });

    it('isSupportedBroker should return false for invalid brokers', () => {
        expect(isSupportedBroker('invalid')).toBe(false);
        expect(isSupportedBroker('')).toBe(false);
        expect(isSupportedBroker(123 as unknown as string)).toBe(false);
        expect(isSupportedBroker(null as unknown as string)).toBe(false);
        expect(isSupportedBroker(undefined as unknown as string)).toBe(false);
    });
});

describe('Broker Registry - defaultBrokerUrl', () => {
    it('should return correct default URLs for each broker', () => {
        expect(defaultBrokerUrl('alpaca')).toBe('https://paper-api.alpaca.markets');
        expect(defaultBrokerUrl('binance')).toBe('https://api.binance.com');
        expect(defaultBrokerUrl('kraken')).toBe('https://api.kraken.com');
        expect(defaultBrokerUrl('coinbase')).toBe('https://api.exchange.coinbase.com');
        expect(defaultBrokerUrl('bybit')).toBe('https://api.bybit.com');
        expect(defaultBrokerUrl('interactive_brokers')).toBe('http://localhost:5000/v1/api');
        expect(defaultBrokerUrl('custom')).toBe('');
    });
});

describe('Broker Registry - normalizeBrokerSymbol', () => {
    it('should normalize valid Alpaca symbols', () => {
        expect(normalizeBrokerSymbol('alpaca', 'AAPL')).toBe('AAPL');
        expect(normalizeBrokerSymbol('alpaca', 'aapl')).toBe('AAPL');
        expect(normalizeBrokerSymbol('alpaca', 'TSLA')).toBe('TSLA');
    });

    it('should reject BIST symbols for Alpaca', () => {
        expect(() => normalizeBrokerSymbol('alpaca', 'THYAO.IS')).toThrow('desteklemiyor');
    });

    it('should reject invalid Alpaca symbols', () => {
        expect(() => normalizeBrokerSymbol('alpaca', 'INVALID!SYMBOL')).toThrow('Geçersiz');
    });

    it('should append USDT for Binance symbols without quote', () => {
        expect(normalizeBrokerSymbol('binance', 'BTC')).toBe('BTCUSDT');
        expect(normalizeBrokerSymbol('binance', 'ETH')).toBe('ETHUSDT');
    });

    it('should keep Binance symbols with quote asset', () => {
        expect(normalizeBrokerSymbol('binance', 'BTCUSDT')).toBe('BTCUSDT');
        expect(normalizeBrokerSymbol('binance', 'ETHUSDC')).toBe('ETHUSDC');
    });

    it('should reject invalid Binance symbols', () => {
        expect(() => normalizeBrokerSymbol('binance', 'INVALID!')).toThrow('Geçersiz');
    });

    it('should normalize Kraken symbols', () => {
        expect(normalizeBrokerSymbol('kraken', 'BTC')).toBe('BTCUSDT');
        expect(normalizeBrokerSymbol('kraken', 'XBT')).toBe('XBTUSDT');
        expect(() => normalizeBrokerSymbol('kraken', 'INVALID!')).toThrow('Geçersiz');
    });

    it('should append -USD for Coinbase symbols', () => {
        expect(normalizeBrokerSymbol('coinbase', 'BTC')).toBe('BTC-USD');
        expect(normalizeBrokerSymbol('coinbase', 'ETH')).toBe('ETH-USD');
        expect(normalizeBrokerSymbol('coinbase', 'BTC-USD')).toBe('BTC-USD');
    });

    it('should append USDT for Bybit symbols', () => {
        expect(normalizeBrokerSymbol('bybit', 'BTC')).toBe('BTCUSDT');
        expect(normalizeBrokerSymbol('bybit', 'ETH')).toBe('ETHUSDT');
    });

    it('should normalize valid IBKR symbols', () => {
        expect(normalizeBrokerSymbol('interactive_brokers', 'AAPL')).toBe('AAPL');
        expect(normalizeBrokerSymbol('interactive_brokers', 'TSLA')).toBe('TSLA');
        expect(() => normalizeBrokerSymbol('interactive_brokers', 'INVALID!')).toThrow('Geçersiz');
    });

    it('should strip BINANCE: prefix', () => {
        expect(normalizeBrokerSymbol('binance', 'BINANCE:BTCUSDT')).toBe('BTCUSDT');
    });

    it('should throw for empty symbol', () => {
        expect(() => normalizeBrokerSymbol('binance', '')).toThrow('boş');
        expect(() => normalizeBrokerSymbol('binance', '   ')).toThrow('boş');
    });
});

describe('Broker Registry - normalizeBrokerUrl', () => {
    it('should return default URL when no apiUrl provided', () => {
        expect(normalizeBrokerUrl('alpaca', undefined)).toBe('https://paper-api.alpaca.markets');
        expect(normalizeBrokerUrl('binance', undefined)).toBe('https://api.binance.com');
    });

    it('should accept valid custom URLs for supported hosts', () => {
        expect(normalizeBrokerUrl('alpaca', 'https://api.alpaca.markets')).toBe('https://api.alpaca.markets');
        expect(normalizeBrokerUrl('binance', 'https://testnet.binance.vision')).toBe('https://testnet.binance.vision');
    });

    it('should reject non-HTTPS URLs', () => {
        expect(() => normalizeBrokerUrl('alpaca', 'http://api.alpaca.markets')).toThrow('https:// ile başlamalıdır');
    });

    it('should reject unsupported hosts (SSRF protection)', () => {
        expect(() => normalizeBrokerUrl('alpaca', 'https://evil.com')).toThrow('Desteklenmeyen broker adresi');
        expect(() => normalizeBrokerUrl('binance', 'https://localhost:3000')).toThrow('Desteklenmeyen broker adresi');
    });

    it('should reject URLs with credentials', () => {
        expect(() => normalizeBrokerUrl('alpaca', 'https://user:pass@api.alpaca.markets')).toThrow('kullanıcı bilgisi');
    });
});

describe('Broker Registry - createBrokerAdapter', () => {
    it('should create adapter for each supported broker', () => {
        expect(createBrokerAdapter('alpaca')).not.toBeNull();
        expect(createBrokerAdapter('binance')).not.toBeNull();
        expect(createBrokerAdapter('kraken')).not.toBeNull();
        expect(createBrokerAdapter('interactive_brokers')).not.toBeNull();
        expect(createBrokerAdapter('coinbase')).not.toBeNull();
        expect(createBrokerAdapter('bybit')).not.toBeNull();
    });

    it('should return null for unsupported broker', () => {
        expect(createBrokerAdapter('invalid' as string)).toBeNull();
        expect(createBrokerAdapter('' as string)).toBeNull();
    });
});

describe('Broker Registry - isLiveBrokerUrl', () => {
    it('should identify Alpaca live URL', () => {
        expect(isLiveBrokerUrl('alpaca', 'https://api.alpaca.markets')).toBe(true);
        expect(isLiveBrokerUrl('alpaca', 'https://paper-api.alpaca.markets')).toBe(false);
    });

    it('should identify Binance live URL', () => {
        expect(isLiveBrokerUrl('binance', 'https://api.binance.com')).toBe(true);
        expect(isLiveBrokerUrl('binance', 'https://testnet.binance.vision')).toBe(false);
    });

    it('should identify Kraken live URL', () => {
        expect(isLiveBrokerUrl('kraken', 'https://api.kraken.com')).toBe(true);
    });

    it('should identify Coinbase live URLs', () => {
        expect(isLiveBrokerUrl('coinbase', 'https://api.coinbase.com')).toBe(true);
        expect(isLiveBrokerUrl('coinbase', 'https://api.exchange.coinbase.com')).toBe(true);
    });

    it('should identify Bybit live URL', () => {
        expect(isLiveBrokerUrl('bybit', 'https://api.bybit.com')).toBe(true);
        expect(isLiveBrokerUrl('bybit', 'https://api-testnet.bybit.com')).toBe(false);
    });
});

describe('Broker Registry - getTradingLimits', () => {
    it('should return default limits for live trading', () => {
        process.env.LIVE_TRADING_ENABLED = 'true';
        process.env.LIVE_MAX_ORDER_NOTIONAL_USD = '200';
        process.env.LIVE_MAX_DAILY_NOTIONAL_USD = '1000';

        const limits = getTradingLimits('alpaca', 'https://api.alpaca.markets');
        expect(limits.maxOrderNotional).toBe(200);
        expect(limits.maxDailyNotional).toBe(1000);
    });

    it('should return fallback limits when env vars are missing', () => {
        delete process.env.LIVE_MAX_ORDER_NOTIONAL_USD;
        delete process.env.LIVE_MAX_DAILY_NOTIONAL_USD;

        const limits = getTradingLimits('alpaca', 'https://paper-api.alpaca.markets');
        expect(limits.maxOrderNotional).toBe(10_000);
        expect(limits.maxDailyNotional).toBe(100_000);
    });
});