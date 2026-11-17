import fs from 'fs';
const p = 'components/watchlist/CreateAlertModal.tsx';
let c = fs.readFileSync(p, 'utf-8');

const startIdx = c.indexOf('                ) : (');
const endIdx = c.indexOf('                )}\n            </DialogContent>');
console.log('startIdx:', startIdx, 'endIdx:', endIdx);

if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = c.substring(0, startIdx);
    const after = c.substring(endIdx);
    c = before + '                )}' + after;
    fs.writeFileSync(p, c, 'utf-8');
    console.log('SUCCESS: cloud upsell removed from CreateAlertModal.tsx');
} else {
    console.log('FAILED: could not find pattern');
}
