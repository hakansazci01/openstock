/**
 * SSRF (Server Side Request Forgery) koruması için URL validasyonu.
 * Sadece güvenli domainlere istek yapmaya izin verir.
 */

const ALLOWED_DOMAINS = new Set([
    'finnhub.io',
    'api.github.com',
    'www.google-analytics.com',
]);

const ALLOWED_PROTOCOLS = new Set(['https:']);

/**
 * URL'nin güvenli bir domain'e mi işaret ettiğini kontrol eder.
 * SSRF saldırılarını önler (localhost, internal IP, özel domainler engellenir).
 */
export function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url);

        // Protokol kontrolü
        if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
            return false;
        }

        // Domain kontrolü
        const hostname = parsed.hostname.toLowerCase();

        // Localhost ve internal IP'leri engelle
        if (
            hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('172.17.') ||
            hostname.startsWith('172.18.') ||
            hostname.startsWith('172.19.') ||
            hostname.startsWith('172.20.') ||
            hostname.startsWith('172.21.') ||
            hostname.startsWith('172.22.') ||
            hostname.startsWith('172.23.') ||
            hostname.startsWith('172.24.') ||
            hostname.startsWith('172.25.') ||
            hostname.startsWith('172.26.') ||
            hostname.startsWith('172.27.') ||
            hostname.startsWith('172.28.') ||
            hostname.startsWith('172.29.') ||
            hostname.startsWith('172.30.') ||
            hostname.startsWith('172.31.') ||
            hostname.endsWith('.local')
        ) {
            return false;
        }

        // Sadece izin verilen domainlere izin ver
        return ALLOWED_DOMAINS.has(hostname);
    } catch {
        return false;
    }
}

/**
 * Sembol validasyonu - sadece güvenli karakterlere izin verir.
 * Path traversal ve injection saldırılarını önler.
 */
export function isValidSymbol(symbol: string): boolean {
    return /^[A-Z0-9.\-]{1,20}$/.test(symbol);
}