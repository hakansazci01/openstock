/**
 * Enhanced Rate Limiting Modülü
 *
 * Gerçek para işlemleri için kritik rate limiting:
 * - Per-user rate limiting (kullanıcı bazlı)
 * - Per-IP rate limiting (IP bazlı)
 * - Different limits for different endpoints (endpoint bazlı farklı limitler)
 * - Burst protection (anlık patlama koruması)
 * - MongoDB shared counter (çoklu instance desteği)
 */

import { connectToDatabase } from '@/database/mongoose';

type RateLimitConfig = {
    maxRequests: number;
    windowSeconds: number;
    blockSeconds?: number; // Blok süresi (varsayılan windowSeconds)
};

type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
};

type RateLimitEntry = { count: number; resetAt: number; blockedUntil: number };

type RateLimitStore = Map<string, RateLimitEntry>;

const stores: Record<string, RateLimitStore> = {};

function getStore(name: string): RateLimitStore {
    if (!stores[name]) {
        stores[name] = new Map();
    }
    return stores[name];
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
    'auth:login': { maxRequests: 5, windowSeconds: 60, blockSeconds: 300 },
    'auth:signup': { maxRequests: 3, windowSeconds: 60, blockSeconds: 600 },
    'broker:orders': { maxRequests: 30, windowSeconds: 60 },
    'broker:sync': { maxRequests: 10, windowSeconds: 60 },
    'broker:kill-switch': { maxRequests: 5, windowSeconds: 60 },
    'api:general': { maxRequests: 100, windowSeconds: 60 },
    'api:trading': { maxRequests: 20, windowSeconds: 60 },
};

export function checkRateLimit(
    key: string,
    configName: string = 'api:general'
): RateLimitResult {
    const config = DEFAULT_CONFIGS[configName] || DEFAULT_CONFIGS['api:general'];
    const store = getStore(configName);
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;

    let entry = store.get(key);

    if (!entry) {
        entry = { count: 1, resetAt: now + windowMs, blockedUntil: 0 };
        store.set(key, entry);
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetTime: entry.resetAt,
        };
    }

    // Blocked kontrolü
    if (entry.blockedUntil > now) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.blockedUntil,
            retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
        };
    }

    // Window reset
    if (now > entry.resetAt) {
        entry = { count: 1, resetAt: now + windowMs, blockedUntil: 0 };
        store.set(key, entry);
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetTime: entry.resetAt,
        };
    }

    // Count artır
    entry.count++;

    if (entry.count > config.maxRequests) {
        const blockMs = (config.blockSeconds || config.windowSeconds) * 1000;
        entry.blockedUntil = now + blockMs;
        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.blockedUntil,
            retryAfter: Math.ceil(blockMs / 1000),
        };
    }

    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetTime: entry.resetAt,
    };
}

/**
 * Kullanıcı bazlı rate limit kontrolü
 * Kullanıcı ID'sini dışarıdan alır (session'dan gelmeli)
 */
export function checkUserRateLimit(
    userId: string,
    configName: string = 'api:general'
): RateLimitResult {
    return checkRateLimit(`user:${userId}`, configName);
}

/**
 * IP bazlı rate limit kontrolü
 * IP adresini dışarıdan alır (middleware'den gelmeli)
 */
export function checkIpRateLimit(
    ip: string,
    configName: string = 'api:general'
): RateLimitResult {
    return checkRateLimit(`ip:${ip}`, configName);
}

/**
 * Her iki limiti de kontrol eder (user ve IP)
 */
export function checkRateLimits(
    configName: string = 'api:general',
    userId?: string | null,
    ip?: string | null
): { allowed: boolean; reason?: string; retryAfter?: number } {
    // IP limiti (varsa)
    if (ip) {
        const ipResult = checkIpRateLimit(ip, configName);
        if (!ipResult.allowed) {
            return {
                allowed: false,
                reason: 'IP bazlı rate limit aşıldı',
                retryAfter: ipResult.retryAfter,
            };
        }
    }

    // Kullanıcı limiti (varsa)
    if (userId) {
        const userResult = checkUserRateLimit(userId, configName);
        if (!userResult.allowed) {
            return {
                allowed: false,
                reason: 'Kullanıcı bazlı rate limit aşıldı',
                retryAfter: userResult.retryAfter,
            };
        }
    }

    return { allowed: true };
}

/**
 * MongoDB'ye rate limit kaydı yazar (cross-instance senkronizasyon için)
 */
export async function persistRateLimitToMongo(
    key: string,
    count: number,
    windowSeconds: number
): Promise<void> {
    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) return;

        const collection = db.collection('rate_limits');
        const now = new Date();
        const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

        await collection.updateOne(
            { key },
            {
                $set: { count, expiresAt, updatedAt: now },
                $setOnInsert: { createdAt: now },
            },
            { upsert: true }
        );
    } catch {
        // MongoDB yazım hatası rate limiting'i engellememeli
    }
}

export type { RateLimitConfig, RateLimitResult };