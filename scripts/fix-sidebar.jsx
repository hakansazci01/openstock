const fs = require('fs');
const p = 'components/shell/Sidebar.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Remove orphan </div> line - the one between two empty lines before the profile div
const lines = c.split('\n');
const out = [];
for (let i = 0; i < lines.length; i++) {
    if (
        lines[i] === '            </div>' &&
        lines[i + 1] === '' &&
        lines[i + 2] === '' &&
        lines[i + 3] === '            <div className="flex items-center gap-2.5 border-t border-line pt-3 px-1">'
    ) {
        continue;
    }
    out.push(lines[i]);
}
fs.writeFileSync(p, out.join('\n'), 'utf-8');
console.log('Sidebar.tsx fixed');
