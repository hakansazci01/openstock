const BASE = 'http://localhost:3000';

const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: 'testbot@example.com', password: 'Test12345!' }),
});
if (login.status !== 200) {
    console.log('sign-in failed:', login.status, await login.text());
    process.exit(1);
}
const setCookies = login.headers.getSetCookie?.() ?? [];
const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');

const call = async (path, opts = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: { cookie, ...(opts.headers ?? {}) },
        redirect: 'manual',
    });
    const text = await res.text();
    return { status: res.status, text };
};

const pages = ['/dashboard', '/watchlist', '/bots', '/bots/new', '/profile', '/admin', '/admin/users', '/admin/settings', '/stocks/AAPL', '/s/AAPL', '/compare', '/about', '/help', '/changelog', '/api-docs', '/sign-in', '/sign-up'];
for (const p of pages) {
    const res = await call(p);
    const err = res.text.includes('Application error') || res.text.includes('Internal Server Error');
    console.log(`${p}: ${res.status} len=${res.text.length}${err ? '  <-- ERROR PAGE' : ''}`);
}

const admin = await call('/admin');
console.log('admin has stats:', /bot|trade|alert/i.test(admin.text));
const users = await call('/admin/users');
console.log('admin/users len:', users.text.length);
const settings = await call('/admin/settings');
console.log('admin/settings len:', settings.text.length);
