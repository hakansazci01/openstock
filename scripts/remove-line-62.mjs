import fs from 'fs';
const p = 'app/(marketing)/page.tsx';
const lines = fs.readFileSync(p, 'utf-8').split('\n');
if (lines[61].trim() === '];') {
    lines.splice(61, 1);
    fs.writeFileSync(p, lines.join('\n'), 'utf-8');
    console.log('Line 62 removed');
} else {
    console.log('Line 62 is:', JSON.stringify(lines[61]));
}
