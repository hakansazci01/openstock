import fs from 'fs';
const p = 'components/watchlist/CreateAlertModal.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Remove the alertsEnabled import line
c = c.replace('import { alertsEnabled } from "@/lib/market-data";\n', '');

// Remove the ternary wrapper
c = c.replace('{alertsEnabled ? (\n                    <>', '<>');
c = c.replace('                    </>\n                )}', '</>');

fs.writeFileSync(p, c, 'utf-8');
console.log('Done');
