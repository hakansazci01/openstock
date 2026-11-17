import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import { isPublicPath } from '@/lib/public-paths';

const isDev = process.env.NODE_ENV !== 'production';

// State-changing API paths that require CSRF token validation
const CSRF_PROTECTED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// Paths exempt from CSRF (e.g., webhooks that don't use browser cookies)
const CSRF_EXEMPT_PATHS = [
    '/api/auth/',
    '/api/inngest',
    '/api/health',
];

/**
 * Content Security Policy.
 */
function buildCsp(nonce: string): string {
    return [
        "default-src 'self'",
        [
            "script-src 'self'",
            `'nonce-${nonce}'`,
            "'strict-dynamic'",
            ...(isDev ? ["'unsafe-eval'"] : []),
            'https://s3.tradingview.com',
            'https://platform.twitter.com',
            'https://cdn.tailwindcss.com',
        ].join(' '),
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' https: data: blob:",
        [
            "connect-src 'self'",
            ...(isDev ? ['ws:', 'wss:', 'http://localhost:*'] : []),
            'https://finnhub.io',
            'https://api.github.com',
            'https://*.sentry.io',
            'https://www.google-analytics.com',
            'https://*.vercel-insights.com',
        ].join(' '),
        "frame-src 'self' https://*.tradingview.com https://tradingview.com https://www.tradingview-widget.com https://platform.twitter.com https://www.youtube.com",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "worker-src 'self' blob:",
        ...(isDev ? [] : ['upgrade-insecure-requests']),
    ].join('; ');
}

function applySecurityHeaders(response: NextResponse, csp: string) {
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function validateCSRF(request: NextRequest): { valid: boolean; reason?: string } {
    const method = request.method;
    const pathname = request.nextUrl.pathname;

    if (!CSRF_PROTECTED_METHODS.has(method)) return { valid: true };

    if (CSRF_EXEMPT_PATHS.some((p) => pathname.startsWith(p))) return { valid: true };

    if (isDev) return { valid: true };

    const csrfToken = request.headers.get('x-csrf-token');
    const csrfCookie = request.cookies.get('csrf-token')?.value;

    if (!csrfToken || !csrfCookie) {
        return { valid: false, reason: 'CSRF token eksik' };
    }
    if (csrfToken !== csrfCookie) {
        return { valid: false, reason: 'CSRF token uyuşmuyor' };
    }

    return { valid: true };
}

export async function proxy(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = buildCsp(nonce);

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    if (request.nextUrl.pathname.startsWith('/api/')) {
        const csrf = validateCSRF(request);
        if (!csrf.valid) {
            return NextResponse.json(
                { error: csrf.reason || 'CSRF doğrulama başarısız' },
                { status: 403 }
            );
        }
    }

    if (isPublicPath(request.nextUrl.pathname)) {
        const response = NextResponse.next({ request: { headers: requestHeaders } });
        applySecurityHeaders(response, csp);
        return response;
    }

    const sessionCookie = getSessionCookie(request);

    if (!sessionCookie) {
        const response = NextResponse.redirect(new URL('/sign-in', request.url));
        applySecurityHeaders(response, csp);
        return response;
    }

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    applySecurityHeaders(response, csp);
    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|assets).*)',
        '/api/:path*',
    ],
};