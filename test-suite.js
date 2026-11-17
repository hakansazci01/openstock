// test-suite.js — OpenStock smoke test (Node >= 18, no deps)
// Run: cd <project-root> && node test-suite.js
// Ortam: .env içinden ADMIN_PASSWORD / ADMIN_EMAIL → varsayılanlar

import { readFileSync } from 'node:fs';

const envPath = process.env.OPENSTOCK_ENV ?? '.env';
const envText = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = val;
}

const BASE = process.env.OPENSTOCK_URL || 'http://localhost:3000';
const ADMIN_EMAIL = env.ADMIN_EMAIL || 'hakansazci@gmail.com';
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || 'Hakan12345!';



async function req(method, path, body) {
  const u = new URL(BASE + path);
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(u.toString(), opts);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, body: json, text };
}

function cookieJar() {
  let jar = '';
  return {
    add(name, value) { jar += `${name}=${value}; `; },
    get() { return jar; },
    reset() { jar = ''; },
  };
}

const cookies = cookieJar();

async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`,
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${res.statusText}`);
  const setCookies = res.headers.get('set-cookie') || '';
  for (const part of setCookies.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) cookies.add(part.slice(0, idx), part.slice(idx + 1));
  }
  return res.status;
}

async function api(path, { method = 'GET', body, token = null } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookies.get(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json().catch(() => null) };
}

async function main() {
  console.log('\n── 1. Sign-in as admin (' + ADMIN_EMAIL + ') ──');
  const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  console.log('admin login status:', adminLogin);

  console.log('\n── 2. GET /admin ──');
  const adminPage = await req('GET', '/admin');
  console.log('admin page status:', adminPage.status);
  console.log('has admin content:', (adminPage.body?.bodyText || '')?.includes('Genel Bakış') || (adminPage.body?.bodyText || '')?.includes('Yönetim'));

  console.log('\n── 3. GET /dashboard ──');
  const dash = await req('GET', '/dashboard');
  console.log('dashboard status:', dash.status);

  console.log('\n── 4. GET /watchlist ──');
  const wl = await req('GET', '/watchlist');
  console.log('watchlist status:', wl.status);
  console.log('has Semboller:', (wl.body?.bodyText || '')?.includes('Semboller'));
  console.log('aria-busy present:', (wl.body?.bodyText || '')?.includes('aria-busy'));

  console.log('\n── 5. GET /bots ──');
  const bots = await req('GET', '/bots');
  console.log('bots page status:', bots.status);

  console.log('\n── 6. GET /profile ──');
  const prof = await req('GET', '/profile');
  console.log('profile status:', prof.status);

  console.log('\n── 7. GET /about ──');
  const about = await req('GET', '/about');
  console.log('about status:', about.status);

  console.log('\n── 8. GET /api/signals?symbols=AKBNK.IS,AAPL ──');
  const sig = await api('/api/signals', { method: 'GET', body: { symbols: 'AKBNK.IS,AAPL' } });
  console.log('signals status:', sig.status);
  console.log('signals payload keys:', sig.body?.signals ? Object.keys(sig.body.signals) : sig.body);

  console.log('\n── 9. GET /api/bots ──');
  const botsList = await api('/api/bots');
  console.log('bots list status:', botsList.status);
  console.log('bot count:', botsList.body?.bots?.length ?? 0);

  if (botsList.body?.bots?.length) {
    const botId = botsList.body.bots[0]._id || botsList.body.bots[0].id;
    console.log('\n── 10. GET /api/bots/{id} ──');
    const detail = await api(`/api/bots/${botId}`);
    console.log('bot detail status:', detail.status);

    console.log('\n── 11. POST /api/bots/{id} action=run ──');
    const run = await api(`/api/bots/${botId}`, { method: 'POST', body: { action: 'run' } });
    console.log('run status:', run.status);
    console.log('run payload:', JSON.stringify(run.body));

    console.log('\n── 12. POST action=pause ──');
    const pause = await api(`/api/bots/${botId}`, { method: 'POST', body: { action: 'pause' } });
    console.log('pause status:', pause.status);

    console.log('\n── 13. POST action=start ──');
    const start = await api(`/api/bots/${botId}`, { method: 'POST', body: { action: 'start' } });
    console.log('start status:', start.status);

    console.log('\n── 14. POST action=reset ──');
    const reset = await api(`/api/bots/${botId}`, { method: 'POST', body: { action: 'reset' } });
    console.log('reset status:', reset.status);

    console.log('\n── 15. DELETE /api/bots/{id} ──');
    const del = await api(`/api/bots/${botId}`, { method: 'DELETE', body: {} });
    console.log('delete status:', del.status);

    console.log('\n── 16. GET /api/bots after delete ──');
    const afterDel = await api('/api/bots');
    console.log('bots after delete:', afterDel.body?.bots?.length ?? 0);
  }

  console.log('\n── 17. GET /not-found (missing page) ──');
  const nf = await req('GET', '/not-found');
  console.log('not-found status:', nf.status);

  console.log('\n── 18. GET /admin/users (admin only) ──');
  const users = await api('/admin/users');
  console.log('admin users status:', users.status);

  console.log('\n── 19. GET /admin/settings (admin only) ──');
  const settings = await api('/admin/settings');
  console.log('admin settings status:', settings.status);

  console.log('\n✅ Smoke test done.');
}

main().catch((err) => {
  console.error('\n❌ ERROR:', err.message);
  process.exit(1);
});
