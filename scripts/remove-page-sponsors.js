import fs from 'fs';
const p = 'app/(marketing)/page.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Remove sidebarSponsors import
c = c.replace('import { sidebarSponsors } from "@/lib/sponsors";\n', '');

// Remove HeartHandshake from imports
c = c.replace('HeartHandshake, ', '');

// Remove SponsorBanner component
const sponsorBannerStart = c.indexOf('const SponsorBanner = () => {');
const sponsorBannerEnd = c.indexOf('}\n\n// 60 minutes', sponsorBannerStart);
if (sponsorBannerStart >= 0 && sponsorBannerEnd > sponsorBannerStart) {
    c = c.substring(0, sponsorBannerStart) + c.substring(sponsorBannerEnd);
}

// Remove sponsor item from SUPPORT array (the HeartHandshake one)
c = c.replace('    {\n        icon: HeartHandshake, title: \'Sponsor Ol\', primary: true,\n        body: \'Monthly tiers from $5, a one-time gift, or a custom partnership. Sponsors are shown on this site, in the app and in the README.\',\n        cta: { label: \'Sponsor Katmanlarını Gör\', href: \'/sponsor\' },\n    },\n', '');

// Remove kicker="Support" line
c = c.replace('                    kicker="Support"\n', '');

// Remove const [sponsor] = sidebarSponsors(); and if block
c = c.replace('    const [sponsor] = sidebarSponsors();\n    if (!sponsor) return null;\n', '');

// Remove entire sponsor section
const sponsorSectionStart = c.indexOf('<section id="sponsor"');
const sponsorSectionEnd = c.indexOf('</section>', sponsorSectionStart);
if (sponsorSectionStart >= 0 && sponsorSectionEnd > sponsorSectionStart) {
    c = c.substring(0, sponsorSectionStart) + c.substring(sponsorSectionEnd + 10);
}

fs.writeFileSync(p, c, 'utf-8');
console.log('Page sponsor references removed');
