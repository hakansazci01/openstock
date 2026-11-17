import fs from 'fs';
const p = 'components/watchlist/CreateAlertModal.tsx';
let c = fs.readFileSync(p, 'utf-8');

c = c.replace('                )}                )}', '                )}');

fs.writeFileSync(p, c, 'utf-8');
console.log('Fixed duplicate )}');
