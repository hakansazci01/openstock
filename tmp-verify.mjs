const BASE = 'http://localhost:3000';

const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email: 'testbot@example.com', password: 'Test12345!' }),
});
console.log('sign-in:', login.status, login.status !== 200 ? await login.text() : '');
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

const created = await call('/api/bots', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
        name: 'SmokeBot',
        symbols: ['AAPL', 'AKBNK.IS'],
        strategy: 'sma_cross',
        initialCapital: 10000,
        strategyConfig: { fastPeriod: 10, slowPeriod: 30 },
    }),
});
console.log('POST /api/bots:', created.status, created.text.slice(0, 200));
const botId = JSON.parse(created.text).bot._id;

for (const action of ['run', 'pause', 'start', 'reset']) {
    const res = await call(`/api/bots/${botId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
    });
    console.log(`POST action=${action}:`, res.status, res.text.slice(0, 220));
}

const detail = await call(`/api/bots/${botId}`);
console.log('GET detail:', detail.status, detail.text.slice(0, 400));

const page = await call(`/bots/${botId}`);
console.log('GET /bots/[id]:', page.status, 'len', page.text.length);

const signals = await call('/api/signals?symbols=AKBNK.IS,AAPL');
console.log('GET /api/signals:', signals.status, signals.text.slice(0, 400));

const del = await call(`/api/bots/${botId}`, { method: 'DELETE' });
console.log('DELETE bot:', del.status, del.text.slice(0, 160));

const delPage = await call(`/bots/${botId}`);
console.log('GET /bots/[id] after delete:', delPage.status);
