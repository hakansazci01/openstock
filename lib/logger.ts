import pino from 'pino';

// Do not use pino transports (worker threads) here. Next.js bundles this module
// for the server runtime and the worker resolves thread-stream relative to a
// wrong root ("C:\ROOT\node_modules\thread-stream/..."), which crashed the
// process on every log line. Plain JSON logs are safe in every runtime.
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    base: {
        service: 'openstock',
        version: process.env.npm_package_version || '0.1.0',
    },
    redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'user.password',
        'user.email',
    ],
});

/**
 * Structured logger wrapper - hassas verileri maskelemek için
 */
export function logInfo(message: string, meta?: Record<string, unknown>) {
    logger.info(meta, message);
}

export function logWarn(message: string, meta?: Record<string, unknown>) {
    logger.warn(meta, message);
}

export function logError(message: string, error?: unknown, meta?: Record<string, unknown>) {
    logger.error({ err: error instanceof Error ? error : new Error(String(error)), ...meta }, message);
}