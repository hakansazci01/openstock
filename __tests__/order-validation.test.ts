import { describe, it, expect } from 'vitest';
import {
    validateSymbol,
    validateQuantity,
    validatePrice,
    validateOrderTypeAndPrices,
    validateStatusTransition,
    validateAndSanitizeOrder,
} from '@/lib/trading/order-validation';

describe('Order Validation - Symbol', () => {
    it('should accept valid symbols', () => {
        expect(validateSymbol('AAPL').valid).toBe(true);
        expect(validateSymbol('TSLA').valid).toBe(true);
        expect(validateSymbol('BTCUSDT').valid).toBe(true);
        expect(validateSymbol('EURUSD').valid).toBe(true);
        expect(validateSymbol('THYAO.IS').valid).toBe(true);
    });

    it('should reject empty symbol', () => {
        expect(validateSymbol('').valid).toBe(false);
        expect(validateSymbol('   ').valid).toBe(false);
        expect(validateSymbol(null as any).valid).toBe(false);
    });

    it('should reject symbols with dangerous characters', () => {
        expect(validateSymbol('AAPL;DROP TABLE').valid).toBe(false);
        expect(validateSymbol('<script>').valid).toBe(false);
        expect(validateSymbol("' OR 1=1").valid).toBe(false);
        expect(validateSymbol('AAPL--').valid).toBe(false);
    });

    it('should reject symbols with special characters', () => {
        expect(validateSymbol('AAPL@').valid).toBe(false);
        expect(validateSymbol('AAPL#').valid).toBe(false);
        expect(validateSymbol('AAPL$').valid).toBe(false);
    });

    it('should reject too long symbols', () => {
        expect(validateSymbol('A'.repeat(21)).valid).toBe(false);
    });
});

describe('Order Validation - Quantity', () => {
    it('should accept valid quantities', () => {
        expect(validateQuantity(1).valid).toBe(true);
        expect(validateQuantity(100).valid).toBe(true);
        expect(validateQuantity(0.001).valid).toBe(true);
        expect(validateQuantity(1000000).valid).toBe(true);
    });

    it('should reject invalid quantities', () => {
        expect(validateQuantity(0).valid).toBe(false);
        expect(validateQuantity(-1).valid).toBe(false);
        expect(validateQuantity(null).valid).toBe(false);
        expect(validateQuantity(undefined).valid).toBe(false);
        expect(validateQuantity('abc').valid).toBe(false);
        expect(validateQuantity(1000001).valid).toBe(false);
    });
});

describe('Order Validation - Price', () => {
    it('should accept valid prices', () => {
        expect(validatePrice(100).valid).toBe(true);
        expect(validatePrice(0.01).valid).toBe(true);
        expect(validatePrice(1000000).valid).toBe(true);
    });

    it('should reject invalid prices', () => {
        expect(validatePrice(0).valid).toBe(false);
        expect(validatePrice(-1).valid).toBe(false);
        expect(validatePrice(null).valid).toBe(false);
        expect(validatePrice('abc').valid).toBe(false);
        expect(validatePrice(1000000001).valid).toBe(false);
    });
});

describe('Order Validation - Type and Prices', () => {
    it('should accept market order without prices', () => {
        expect(validateOrderTypeAndPrices('market').valid).toBe(true);
    });

    it('should require limitPrice for limit orders', () => {
        expect(validateOrderTypeAndPrices('limit').valid).toBe(false);
        expect(validateOrderTypeAndPrices('limit', 100).valid).toBe(true);
    });

    it('should require stopPrice for stop orders', () => {
        expect(validateOrderTypeAndPrices('stop').valid).toBe(false);
        expect(validateOrderTypeAndPrices('stop', undefined, 100).valid).toBe(true);
    });

    it('should require both for stop_limit', () => {
        expect(validateOrderTypeAndPrices('stop_limit').valid).toBe(false);
        expect(validateOrderTypeAndPrices('stop_limit', 100, 90).valid).toBe(true);
    });

    it('should reject same limit and stop price', () => {
        expect(validateOrderTypeAndPrices('stop_limit', 100, 100).valid).toBe(false);
    });
});

describe('Order Validation - Status Transition', () => {
    it('should allow pending to filled', () => {
        expect(validateStatusTransition('pending', 'filled').valid).toBe(true);
    });

    it('should allow pending to cancelled', () => {
        expect(validateStatusTransition('pending', 'cancelled').valid).toBe(true);
    });

    it('should reject filled to pending', () => {
        expect(validateStatusTransition('filled', 'pending').valid).toBe(false);
    });

    it('should reject filled to cancelled', () => {
        expect(validateStatusTransition('filled', 'cancelled').valid).toBe(false);
    });

    it('should reject cancelled to anything', () => {
        expect(validateStatusTransition('cancelled', 'pending').valid).toBe(false);
        expect(validateStatusTransition('cancelled', 'filled').valid).toBe(false);
    });
});

describe('Order Validation - Sanitize Order', () => {
    it('should accept valid market order', () => {
        const result = validateAndSanitizeOrder({
            symbol: 'AAPL',
            side: 'buy',
            type: 'market',
            quantity: 10,
        });
        expect(result.valid).toBe(true);
        expect(result.data?.symbol).toBe('AAPL');
        expect(result.data?.side).toBe('buy');
        expect(result.data?.type).toBe('market');
        expect(result.data?.quantity).toBe(10);
    });

    it('should accept valid limit order', () => {
        const result = validateAndSanitizeOrder({
            symbol: 'TSLA',
            side: 'sell',
            type: 'limit',
            quantity: 5,
            limitPrice: 250,
        });
        expect(result.valid).toBe(true);
        expect(result.data?.limitPrice).toBe(250);
    });

    it('should reject invalid symbol', () => {
        const result = validateAndSanitizeOrder({
            symbol: 'INVALID!',
            side: 'buy',
            type: 'market',
            quantity: 10,
        });
        expect(result.valid).toBe(false);
        expect(result.reason).toBeDefined();
    });

    it('should reject invalid quantity', () => {
        const result = validateAndSanitizeOrder({
            symbol: 'AAPL',
            side: 'buy',
            type: 'market',
            quantity: -1,
        });
        expect(result.valid).toBe(false);
    });

    it('should reject missing limitPrice for limit order', () => {
        const result = validateAndSanitizeOrder({
            symbol: 'AAPL',
            side: 'buy',
            type: 'limit',
            quantity: 10,
        });
        expect(result.valid).toBe(false);
    });

    it('should reject missing stopPrice for stop order', () => {
        const result = validateAndSanitizeOrder({
            symbol: 'AAPL',
            side: 'buy',
            type: 'stop',
            quantity: 10,
        });
        expect(result.valid).toBe(false);
    });

    it('should sanitize symbol to uppercase', () => {
        const result = validateAndSanitizeOrder({
            symbol: 'aapl',
            side: 'buy',
            type: 'market',
            quantity: 10,
        });
        expect(result.valid).toBe(true);
        expect(result.data?.symbol).toBe('AAPL');
    });
});