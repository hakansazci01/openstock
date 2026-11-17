import fs from 'fs';
const p = 'components/watchlist/AlertsPanel.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Fix 1: Remove the "Uyarılar Cloud ile gelir" empty state when alerts.length === 0 && !alertsEnabled
// Since alertsEnabled is now always true, this branch won't execute, but clean up the text anyway

// Fix 2: Fix the Turkish text in statusOf - "Durduruldu" when !alertsEnabled is fine since alertsEnabled=true now

// Fix 3: Remove the "Alerts moved to Cloud" message when !alertsEnabled and alerts exist

// Fix 4: Fix the empty state text when alerts.length === 0 (the else branch)
// Change "Use the bell on any row, or "Set alert" on a stock page. We email you when it fires."
// to proper Turkish

let changed = false;

// Fix the empty state English text to Turkish
const oldEmpty = 'Use the bell on any row, or “Set alert” on a stock page. We email you when it fires.';
const newEmpty = 'Herhangi bir satırdaki zili kullanın veya bir hisse sayfasında “Uyarı Ayarla”ya basın. Uyarı tetiklendiğinde size e-posta gönderiyoruz.';
if (c.includes(oldEmpty)) {
    c = c.replace(oldEmpty, newEmpty);
    changed = true;
    console.log('Fixed empty state text');
}

// Fix the "Alerts moved to Cloud" text
const oldMoved = 'Alerts moved to <Link href="/#data" className="text-brand-ink hover:underline">OpenStock Cloud</Link>, so these are Durduruldu.';
const newMoved = 'Uyarılar devre dışı.';
if (c.includes(oldMoved)) {
    c = c.replace(oldMoved, newMoved);
    changed = true;
    console.log('Fixed moved text');
}

// Fix the empty state title when alerts.length === 0 && !alertsEnabled
const oldEmptyTitle = 'Uyarılar Cloud ile gelir';
const newEmptyTitle = 'Henüz Uyarı Yok';
if (c.includes(oldEmptyTitle)) {
    c = c.replace(oldEmptyTitle, newEmptyTitle);
    changed = true;
    console.log('Fixed empty title');
}

const oldEmptyDesc = 'Email price alerts are part of OpenStock Cloud, $5 a month and coming soon.';
const newEmptyDesc = 'Fiyat uyarıları şu an aktif. Bir hissede zil simgesine tıklayarak uyarı ekleyebilirsiniz.';
if (c.includes(oldEmptyDesc)) {
    c = c.replace(oldEmptyDesc, newEmptyDesc);
    changed = true;
    console.log('Fixed empty desc');
}

if (changed) {
    fs.writeFileSync(p, c, 'utf-8');
    console.log('AlertsPanel.tsx: fixed');
} else {
    console.log('AlertsPanel.tsx: no changes needed or patterns not found');
}
