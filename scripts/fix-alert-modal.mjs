import fs from 'fs';

const p = 'C:/Users/hakan/OneDrive/Desktop/OpenStock-main/OpenStock-main/components/watchlist/CreateAlertModal.tsx';
let c = fs.readFileSync(p, 'utf-8');

// Remove the cloud upsell else-branch (lines: ) : ( ... )} before </DialogContent>
// Match from "                ) : (" to the closing "                )}" just before </DialogContent>
const old = `                ) : (
                    // Alerts are an OpenStock Bulut feature; the free hourly site points people to it
                    <div>
                        <p className="kicker text-brand-ink">OpenStock Bulut</p>
                        <DialogTitle className="mt-1 text-xl font-bold tracking-tight">Fiyat Uyarısıs come with Cloud</DialogTitle>
                        <DialogDescription className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                            Cloud adds email Fiyat Uyarısıs and live quotes for $5 a month. yakında geliyor. Kendi Sunucudaing includes both today.
                        </DialogDescription>
                        <div className="mt-5 flex gap-2">
                            <Link href="/#data" className="btn btn-primary h-11 flex-1">See OpenStock Bulut</Link>
                            <Link href="/#Kendi Sunucuda" className="btn btn-ghost h-11">Kendi Sunucuda</Link>
                        </div>
                    </div>
                )}`;

const replacement = `                )}`;

if (c.includes(old)) {
    c = c.replace(old, replacement);
    fs.writeFileSync(p, c, 'utf-8');
    console.log('CreateAlertModal.tsx: cloud upsell removed');
} else {
    console.log('CreateAlertModal.tsx: pattern not found, trying fallback');
    // Fallback: remove everything from ") : (" to the ")}" before "</DialogContent>"
    const startIdx = c.indexOf('                ) : (');
    const endIdx = c.indexOf('                )}\n            </DialogContent>');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        c = c.substring(0, startIdx) + `                )}` + c.substring(endIdx + `                )}\n            </DialogContent>`.length - `                )}\n            </DialogContent>`.length + `                )}\n            </DialogContent>`.length);
        // Simpler: just replace the whole block
        c = c.substring(0, startIdx) + `                )}` + c.substring(endIdx);
        fs.writeFileSync(p, c, 'utf-8');
        console.log('CreateAlertModal.tsx: removed via fallback');
    } else {
        console.log('CreateAlertModal.tsx: fallback also failed');
    }
}
