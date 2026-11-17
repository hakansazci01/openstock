const fs = require('fs');
const p = 'components/shell/Sidebar.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Remove orphan </div> - find </div> that is between two empty lines, 
// where previous non-empty is </div> and next non-empty is profile div
const lines = c.split('\n');
const out = [];
for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '</div>') {
        // Check if previous non-empty line is also </div> and next non-empty is profile div
        let prevNonEmpty = -1;
        let nextNonEmpty = -1;
        for (let j = i - 1; j >= 0; j--) { if (lines[j].trim() !== '') { prevNonEmpty = j; break; } }
        for (let j = i + 1; j < lines.length; j++) { if (lines[j].trim() !== '') { nextNonEmpty = j; break; } }
        if (
            prevNonEmpty >= 0 && lines[prevNonEmpty].trim() === '</div>' &&
            nextNonEmpty >= 0 && lines[nextNonEmpty].includes('<div className="flex items-center gap-2.5 border-t border-line pt-3 px-1"')
        ) {
            continue; // skip this orphan </div>
        }
    }
    out.push(lines[i]);
}
fs.writeFileSync(p, out.join('\n'), 'utf-8');
console.log('Sidebar.tsx fixed - orphan div removed');
