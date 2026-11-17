import 'dotenv/config';

import { getWatchlistData } from '../lib/actions/finnhub.actions.js';

const SYMBOL = 'AAPL';

console.log('--- STARTING VERIFICATION ---');

// We will rely on manual verification for Server Actions mostly because they depend on Next.js context (headers, cache).
// But we can test models and Finnhub actions.

async function verifyFinnhub() {
    console.log('1. Testing Finnhub Quote...');
    const data = await getWatchlistData([SYMBOL]);
    console.log('Finnhub Data:', data);
    if (data.length > 0 && data[0].price > 0) {
        console.log('✅ Finnhub Quote Fetch Success');
    } else {
        console.error('❌ Finnhub Quote Fetch Failed');
    }
}

// Just verifying Finnhub for now as it's the external dependency.
// Database interactions are standard Mongoose.
async function main() {
    await verifyFinnhub();
    process.exit(0);
}

main();
