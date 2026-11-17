/**
 * API response'larından hassas alanları kaldırır.
 * Kullanıcı verilerini dışarıya verirken hassas alanları (userId, email, vb.) filtreler.
 */

const SENSITIVE_FIELDS = new Set([
    'userId',
    'email',
    'password',
    'passwordHash',
    'sessionToken',
    'accessToken',
    'refreshToken',
    'apiKey',
    'secretKey',
    'internalNotes',
]);

/**
 * Tek bir nesneden hassas alanları kaldırır.
 */
export function stripSensitiveFields<T extends Record<string, unknown>>(obj: T): T {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
        if (!SENSITIVE_FIELDS.has(key)) {
            result[key] = value;
        }
    }

    return result as T;
}

/**
 * Dizideki her nesneden hassas alanları kaldırır.
 */
export function stripSensitiveFieldsArray<T extends Record<string, unknown>>(arr: T[]): T[] {
    return arr.map((item) => stripSensitiveFields(item));
}

/**
 * Kullanıcı profil verilerini dışarıya verirken hassas alanları kaldırır.
 */
export function sanitizeUserProfile(user: Record<string, unknown>): Record<string, unknown> {
    return {
        id: user.id,
        name: user.name,
        role: user.role,
        country: user.country,
        createdAt: user.createdAt,
    };
}