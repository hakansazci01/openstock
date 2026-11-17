import fs from 'fs';
const p = 'app/(marketing)/page.tsx';
let lines = fs.readFileSync(p, 'utf-8').split('\n');
let out = [];
let skipUntilSectionClose = false;
let inSponsorSection = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip import lines
    if (line.includes('sidebarSponsors') && line.includes('import')) continue;
    if (line.includes('HeartHandshake,') && line.includes('import')) continue;
    
    // Skip SponsorBanner component definition
    if (line.includes('const SponsorBanner = () => {')) {
        skipUntilSectionClose = true;
        continue;
    }
    if (skipUntilSectionClose && line.startsWith('// Floats')) {
        skipUntilSectionClose = false;
        continue;
    }
    if (skipUntilSectionClose) continue;
    
    // Skip const [sponsor] line and following if block
    if (line.includes('const [sponsor] = sidebarSponsors()')) continue;
    if (line.includes('if (!sponsor) return null;')) continue;
    
    // Skip <SponsorBanner /> usage
    if (line.includes('<SponsorBanner />')) continue;
    
    // Skip sponsor item in SUPPORT array
    if (line.includes("title: 'Sponsor Ol'")) continue;
    if (line.includes("icon: HeartHandshake") && line.includes('SUPPORT')) continue;
    if (line.includes("body: 'Monthly tiers from $5")) continue;
    if (line.includes("cta: { label: 'Sponsor Katmanlarını Gör'")) continue;
    
    // Skip kicker="Support" line
    if (line.includes('kicker="Support"')) continue;
    
    // Skip entire sponsor section
    if (line.includes('<section id="sponsor"')) {
        inSponsorSection = true;
        continue;
    }
    if (inSponsorSection && line.includes('</section>')) {
        inSponsorSection = false;
        continue;
    }
    if (inSponsorSection) continue;
    
    out.push(line);
}

fs.writeFileSync(p, out.join('\n'), 'utf-8');
console.log('page.tsx sponsor references fully removed');
