import fs from 'fs';
const p = 'app/(marketing)/page.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Remove sidebarSponsors import
c = c.replace('import { sidebarSponsors } from "@/lib/sponsors";\n', '');

// Remove HeartHandshake from import
c = c.replace('HeartHandshake, ', '');

// Remove SponsorBanner component definition
const sbStart = c.indexOf('const SponsorBanner = () => {');
if (sbStart >= 0) {
    // Find the closing of SponsorBanner - look for the } before the next section
    const sbEnd = c.indexOf('// Floats', sbStart);
    if (sbEnd >= 0) {
        c = c.substring(0, sbStart) + c.substring(sbEnd);
    }
}

// Remove const [sponsor] = sidebarSponsors() block
c = c.replace('    const [sponsor] = sidebarSponsors();\n    if (!sponsor) return null;\n', '');

// Remove <SponsorBanner /> usage
c = c.replace('<SponsorBanner />\n', '');

// Remove the entire sponsor section
const sStart = c.indexOf('<section id="sponsor"');
if (sStart >= 0) {
    const sEnd = c.indexOf('</section>', sStart);
    if (sEnd > sStart) {
        c = c.substring(0, sStart) + c.substring(sEnd + 10);
    }
}

// Remove sponsor item from SUPPORT array
c = c.replace('    {\n        icon: HeartHandshake, title: \'Sponsor Ol\', primary: true,\n        body: \'Monthly tiers from $5, a one-time gift, or a custom partnership. Sponsors are shown on this site, in the app and in the README.\',\n        cta: { label: \'Sponsor Katmanlarını Gör\', href: \'/sponsor\' },\n    },\n', '');

// Remove kicker="Support" line
c = c.replace('                    kicker="Support"\n', '');

fs.writeFileSync(p, c, 'utf-8');
console.log('All sponsor references removed from page.tsx');
