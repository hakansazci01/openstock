/**
 * Error Handling Modülü
 *
 * Gerçek para işlemleri için kritik hata yönetimi:
 * - Hassas bilgi sızdırmaması (stack trace, API key, db connection string)
 * - Structured error responses
 * - HTTP status code yönetimi
 * - Loglama ve audit trail
 */

export type ErrorCode =
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR'
    | 'BROKER_ERROR'
    | 'INSUFFICIENT_FUNDS'
    | 'ORDER_REJECTED'
    | 'KILL_SWITCH_ACTIVE'
    | 'CIRCUIT_BREAKER_ACTIVE'
    | 'DUPLICATE_ORDER';

export interface AppError extends Error {
    statusCode: number;
    errorCode: ErrorCode;
    isOperational: true;
    details?: Record<string, unknown>;
}

export function createAppError(
    message: string,
    statusCode: number,
    errorCode: ErrorCode,
    details?: Record<string, unknown>
): AppError {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    error.errorCode = errorCode;
    error.isOperational = true;
    error.details = details;
    return error;
}

export function isAppError(error: unknown): error is AppError {
    return (
        error instanceof Error &&
        'statusCode' in error &&
        'errorCode' in error &&
        'isOperational' in error
    );
}

export function handleError(error: unknown): {
    statusCode: number;
    errorCode: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    shouldLog: boolean;
} {
    // Bilinmeyen hatalar için güvenli defaults
    if (!isAppError(error)) {
        return {
            statusCode: 500,
            errorCode: 'INTERNAL_ERROR',
            message: 'Sunucu hatası oluştu',
            shouldLog: true,
        };
    }

    // Hassas bilgi sızdırma kontrolü
    const safeMessage = error.message.includes('API_KEY') ||
        error.message.includes('MONGODB_URI') ||
        error.message.includes('SECRET') ||
        error.message.includes('PASSWORD')
        ? 'Sunucu yapılandırma hatası'
        : error.message;

    return {
        statusCode: error.statusCode,
        errorCode: error.errorCode,
        message: safeMessage,
        details: error.details,
        shouldLog: error.statusCode >= 500,
    };
}

export function createErrorResponse(
    error: unknown
): {
    status: number;
    body: {
        error: string;
        errorCode: ErrorCode;
        details?: Record<string, unknown>;
        timestamp: string;
    };
} {
    const { statusCode, errorCode, message, details, shouldLog } = handleError(error);

    if (shouldLog) {
        console.error('Server Error:', {
            errorCode,
            message,
            details,
            timestamp: new Date().toISOString(),
        });
    }

    return {
        status: statusCode,
        body: {
            error: message,
            errorCode,
            details,
            timestamp: new Date().toISOString(),
        },
    };
}

export function createValidationError(
    message: string,
    field?: string
): AppError {
    return createAppError(
        message,
        400,
        'VALIDATION_ERROR',
        field ? { field } : undefined
    );
}

export function createUnauthorizedError(
    message: string = 'Yetkisiz erişim'
): AppError {
    return createAppError(message, 401, 'UNAUTHORIZED');
}

export function createForbiddenError(
    message: string = 'Erişim engellendi'
): AppError {
    return createAppError(message, 403, 'FORBIDDEN');
}

export function createNotFoundError(
    message: string = 'Kaynak bulunamadı'
): AppError {
    return createAppError(message, 404, 'NOT_FOUND');
}

export function createRateLimitedError(
    retryAfter?: number
): AppError {
    return createAppError(
        'Çok fazla istek. Lütfen daha sonra tekrar deneyin.',
        429,
        'RATE_LIMITED',
        retryAfter ? { retryAfter } : undefined
    );
}

export function createBrokerError(
    message: string,
    broker?: string
): AppError {
    return createAppError(
        message,
        502,
        'BROKER_ERROR',
        broker ? { broker } : undefined
    );
}

export function createInsufficientFundsError(): AppError {
    return createAppError(
        'Yetersiz bakiye',
        400,
        'INSUFFICIENT_FUNDS'
    );
}

export function createKillSwitchError(reason?: string): AppError {
    return createAppError(
        reason || 'Trading durduruldu (kill switch)',
        403,
        'KILL_SWITCH_ACTIVE',
        reason ? { reason } : undefined
    );
}

export function createCircuitBreakerError(reason?: string): AppError {
    return createAppError(
        reason || 'Devre kesici aktif',
        403,
        'CIRCUIT_BREAKER_ACTIVE',
        reason ? { reason } : undefined
    );
}

export function createDuplicateOrderError(): AppError {
    return createAppError(
        'Aynı emir zaten işlenmiş',
        409,
        'DUPLICATE_ORDER'
    );
}

