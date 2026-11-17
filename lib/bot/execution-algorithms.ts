/**
 * Order Execution Algoritmaları Modülü
 *
 * Büyük emirlerin piyasayı kırmaması için:
 * - TWAP (Time Weighted Average Price): Zaman bazlı eşit parçalara bölme
 * - Iceberg Order: Büyük order'ı küçük parçalara ayırıp sırayla gönderme
 * - Slippage Tolerance: Maksimum kabul edilebilir fiyat sapması
 */

export interface ExecutionConfig {
    slippageTolerancePercent: number;
    twapIntervalSeconds: number;
    twapSlices: number;
    icebergSliceSize: number;
    minOrderSize: number;
}

export interface SlicedOrder {
    sliceIndex: number;
    quantity: number;
    price?: number;
    side: 'buy' | 'sell';
    symbol: string;
    type: 'market' | 'limit';
    scheduledAt?: Date;
}

export interface ExecutionResult {
    slices: SlicedOrder[];
    totalQuantity: number;
    averagePrice?: number;
    totalNotional: number;
    slippagePercent?: number;
}

export const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
    slippageTolerancePercent: 0.5,
    twapIntervalSeconds: 60,
    twapSlices: 5,
    icebergSliceSize: 1,
    minOrderSize: 0.001,
};

/**
 * Slippage kontrolü - istenen fiyatla gerçekleşen fiyat arasındaki sapmayı hesaplar.
 */
export function calculateSlippage({
    expectedPrice,
    executedPrice,
    side,
}: {
    expectedPrice: number;
    executedPrice: number;
    side: 'buy' | 'sell';
}): { slippagePercent: number; withinTolerance: boolean; config: ExecutionConfig } {
    let slippagePercent: number;

    if (side === 'buy') {
        slippagePercent = ((executedPrice - expectedPrice) / expectedPrice) * 100;
    } else {
        slippagePercent = ((expectedPrice - executedPrice) / expectedPrice) * 100;
    }

    return {
        slippagePercent,
        withinTolerance: slippagePercent <= DEFAULT_EXECUTION_CONFIG.slippageTolerancePercent,
        config: DEFAULT_EXECUTION_CONFIG,
    };
}

/**
 * TWAP (Time Weighted Average Price) order slicing.
 * Büyük order'ı zaman bazlı eşit parçalara böler.
 */
export function createTWAPOrder({
    symbol,
    side,
    totalQuantity,
    startTime = new Date(),
    config = DEFAULT_EXECUTION_CONFIG,
}: {
    symbol: string;
    side: 'buy' | 'sell';
    totalQuantity: number;
    startTime?: Date;
    config?: ExecutionConfig;
}): SlicedOrder[] {
    const sliceQuantity = totalQuantity / config.twapSlices;
    const slices: SlicedOrder[] = [];

    for (let i = 0; i < config.twapSlices; i++) {
        slices.push({
            sliceIndex: i,
            quantity: Math.max(config.minOrderSize, sliceQuantity),
            side,
            symbol,
            type: 'market',
            scheduledAt: new Date(startTime.getTime() + i * config.twapIntervalSeconds * 1000),
        });
    }

    return slices;
}

/**
 * Iceberg Order slicing.
 * Büyük order'ı görünmez parçalara böler; her parayı sırayla gönderir.
 */
export function createIcebergOrder({
    symbol,
    side,
    totalQuantity,
    config = DEFAULT_EXECUTION_CONFIG,
}: {
    symbol: string;
    side: 'buy' | 'sell';
    totalQuantity: number;
    config?: ExecutionConfig;
}): SlicedOrder[] {
    const sliceSize = config.icebergSliceSize || 1;
    const sliceCount = Math.ceil(totalQuantity / sliceSize);
    const slices: SlicedOrder[] = [];
    let remaining = totalQuantity;

    for (let i = 0; i < sliceCount; i++) {
        const quantity = Math.min(sliceSize, remaining);
        slices.push({
            sliceIndex: i,
            quantity: Math.max(config.minOrderSize, quantity),
            side,
            symbol,
            type: 'limit',
        });
        remaining -= quantity;
    }

    return slices;
}

/**
 * Order'u broker'a uygun parçalara böler ve slippage kontrolü uygular.
 */
export function prepareExecution({
    symbol,
    side,
    totalQuantity,
    expectedPrice,
    method = 'twap',
    config = DEFAULT_EXECUTION_CONFIG,
}: {
    symbol: string;
    side: 'buy' | 'sell';
    totalQuantity: number;
    expectedPrice: number;
    method?: 'twap' | 'iceberg' | 'market';
    config?: ExecutionConfig;
}): ExecutionResult {
    let slices: SlicedOrder[];

    if (method === 'iceberg') {
        slices = createIcebergOrder({ symbol, side, totalQuantity, config });
    } else if (method === 'twap') {
        slices = createTWAPOrder({ symbol, side, totalQuantity, config });
    } else {
        slices = [{
            sliceIndex: 0,
            quantity: Math.max(config.minOrderSize, totalQuantity),
            side,
            symbol,
            type: 'market',
        }];
    }

    const totalNotional = slices.reduce((sum, s) => sum + s.quantity * expectedPrice, 0);

    return {
        slices,
        totalQuantity,
        averagePrice: expectedPrice,
        totalNotional,
    };
}

/**
 * Gerçekleştirilen order'ın slippage'ını kontrol eder ve toleransı aşıp aşmadığını söyler.
 */
export function validateExecutionSlippage({
    expectedPrice,
    executedPrices,
    executedQuantities,
    side,
}: {
    expectedPrice: number;
    executedPrices: number[];
    executedQuantities: number[];
    side: 'buy' | 'sell';
}): { withinTolerance: boolean; weightedSlippagePercent: number; details: string[] } {
    let totalExecuted = 0;
    let weightedPriceSum = 0;
    const details: string[] = [];

    for (let i = 0; i < executedPrices.length; i++) {
        const qty = executedQuantities[i] || 0;
        const price = executedPrices[i] || 0;
        totalExecuted += qty;
        weightedPriceSum += price * qty;

        const slippage = calculateSlippage({
            expectedPrice,
            executedPrice: price,
            side,
        });
        details.push(`Parça ${i + 1}: fiyat $${price.toFixed(4)}, slippage %${slippage.slippagePercent.toFixed(2)}`);
    }

    const weightedAveragePrice = totalExecuted > 0 ? weightedPriceSum / totalExecuted : expectedPrice;
    const weightedSlippage = calculateSlippage({
        expectedPrice,
        executedPrice: weightedAveragePrice,
        side,
    });

    return {
        withinTolerance: weightedSlippage.withinTolerance,
        weightedSlippagePercent: weightedSlippage.slippagePercent,
        details,
    };
}

