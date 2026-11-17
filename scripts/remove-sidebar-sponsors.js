import fs from 'fs';
const p = 'components/shell/Sidebar.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Remove import line
c = c.replace('import { SIDEBAR_SPONSOR_SLOTS, sidebarSponsors } from "@/lib/sponsors";\n', '');

// Remove partners/openSlots declarations
c = c.replace('    const partners = sidebarSponsors();\n    const openSlots = SIDEBAR_SPONSOR_SLOTS - partners.length;\n', '');

// Remove sponsor section block (lines with partners.map and openSlots)
const startMarker = '            <div className="flex flex-col gap-1.5">\n                {partners.map((sponsor) => (';
const endMarker = '            </div>\n\n            <div className="flex items-center gap-2.5 border-t border-line pt-3 px-1">';
const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker);
if (startIdx >= 0 && endIdx > startIdx) {
    c = c.substring(0, startIdx) + c.substring(endIdx);
    fs.writeFileSync(p, c, 'utf-8');
    console.log('Sidebar sponsor section removed successfully');
} else {
    console.log('Could not find markers. startIdx:', startIdx, 'endIdx:', endIdx);
}
