// Markets OpenStock can show for free. Coverage was tested against the free data sources:
//   - Finnhub free: US stocks and crypto only (every other exchange returns 403).
//   - TradingView embeds: US, crypto, forex live; TSX + ASX delayed; BSE + XETRA end-of-day.
//     NSE and TVC indices (NIFTY, FTSE, DAX, N225, HSI) are blocked in embeds; LSE, Tokyo, Hong Kong and
//     others block only the candle chart (see CHART_BLOCKED_EXCHANGES in lib/utils.ts).
//   - Tadawul is blocked in embeds and on Finnhub free, so Saudi tiles and tables are priced from Yahoo Finance (lib/yahoo.ts).
//   - BIST (Türkiye) is priced from Yahoo Finance (.IS) since TradingView free embeds block Turkey.
// Adding a market = adding an entry here with symbols from an exchange that renders in embeds.

import { isInternationalSymbol } from "@/lib/utils";

export type MarketId = 'us' | 'in' | 'de' | 'ca' | 'au' | 'sa' | 'tr' | 'crypto' | 'fx';

type Hours = { open: number; close: number }; // minutes of the local day

export type Market = {
    id: MarketId;
    name: string;
    short: string;
    timeZone: string;
    hours: Hours | '24/7' | '24/5';
    tradingDays?: number[]; // 0 = Sunday; Monday to Friday when unset
    feed: 'Live' | 'Delayed' | 'End of day';
    pulse: { symbol: string; label: string; finnhub?: string }[];
    yahoo?: true;
    groups: { title: string; symbols: [symbol: string, name: string][] }[];
    heatmap?: 'stocks' | 'crypto';
    news: 'stock' | 'crypto' | 'forex';
};

const hm = (h: number, m = 0) => h * 60 + m;

export const MARKETS: Market[] = [
    {
        id: 'us', name: 'Amerika Birleşik Devletleri', short: 'US', timeZone: 'America/New_York', hours: { open: hm(9, 30), close: hm(16) }, feed: 'Live',
        pulse: [
            { symbol: 'AMEX:SPY', label: 'S&P 500', finnhub: 'SPY' },
            { symbol: 'NASDAQ:QQQ', label: 'Nasdaq 100', finnhub: 'QQQ' },
            { symbol: 'AMEX:DIA', label: 'Dow 30', finnhub: 'DIA' },
            { symbol: 'AMEX:IWM', label: 'Russell 2000', finnhub: 'IWM' },
        ],
        groups: [
            { title: 'Finans', symbols: [['NYSE:JPM', 'JPMorgan Chase'], ['NYSE:BAC', 'Bank of America'], ['NYSE:WFC', 'Wells Fargo'], ['NYSE:GS', 'Goldman Sachs'], ['NYSE:MA', 'Mastercard'], ['NYSE:V', 'Visa']] },
            { title: 'Teknoloji', symbols: [['NASDAQ:AAPL', 'Apple'], ['NASDAQ:MSFT', 'Microsoft'], ['NASDAQ:NVDA', 'NVIDIA'], ['NASDAQ:GOOGL', 'Alphabet'], ['NASDAQ:META', 'Meta'], ['NASDAQ:AMD', 'AMD']] },
            { title: 'Tüketici', symbols: [['NASDAQ:AMZN', 'Amazon'], ['NASDAQ:TSLA', 'Tesla'], ['NYSE:WMT', 'Walmart'], ['NASDAQ:COST', 'Costco'], ['NYSE:KO', 'Coca-Cola'], ['NASDAQ:NFLX', 'Netflix']] },
        ],
        heatmap: 'stocks', news: 'stock',
    },
    {
        id: 'in', name: 'Hindistan', short: 'IN', timeZone: 'Asia/Kolkata', hours: { open: hm(9, 15), close: hm(15, 30) }, feed: 'End of day',
        pulse: [
            { symbol: 'BSE:SENSEX', label: 'Sensex' },
            { symbol: 'BSE:RELIANCE', label: 'Reliance' },
            { symbol: 'BSE:TCS', label: 'TCS' },
            { symbol: 'BSE:HDFCBANK', label: 'HDFC Bank' },
        ],
        groups: [
            { title: 'Bankalar', symbols: [['BSE:HDFCBANK', 'HDFC Bank'], ['BSE:ICICIBANK', 'ICICI Bank'], ['BSE:SBIN', 'State Bank of India'], ['BSE:KOTAKBANK', 'Kotak Mahindra'], ['BSE:AXISBANK', 'Axis Bank']] },
            { title: 'Teknoloji', symbols: [['BSE:TCS', 'TCS'], ['BSE:INFY', 'Infosys'], ['BSE:WIPRO', 'Wipro']] },
        ],
        news: 'stock',
    },
    {
        id: 'de', name: 'Almanya', short: 'DE', timeZone: 'Europe/Berlin', hours: { open: hm(9), close: hm(17, 30) }, feed: 'Delayed',
        pulse: [
            { symbol: 'XETRA:DAX', label: 'DAX' },
            { symbol: 'XETRA:SAP', label: 'SAP' },
            { symbol: 'XETRA:SIE', label: 'Siemens' },
            { symbol: 'XETRA:ALV', label: 'Allianz' },
        ],
        groups: [
            { title: 'Teknoloji & Endüstri', symbols: [['XETRA:SAP', 'SAP'], ['XETRA:SIE', 'Siemens'], ['XETRA:FRE', 'Fresenius'], ['XETRA:VNA', 'Vonovia'], ['XETRA:ZAL', 'Zalando']] },
            { title: 'Finans & Otomotiv', symbols: [['XETRA:ALV', 'Allianz'], ['XETRA:MUV2', 'München Rück'], ['XETRA:VOW', 'Volkswagen'], ['XETRA:BMW', 'BMW'], ['XETRA:DAI', 'Mercedes-Benz']] },
        ],
        news: 'stock',
    },
    {
        id: 'ca', name: 'Kanada', short: 'CA', timeZone: 'America/Toronto', hours: { open: hm(9, 30), close: hm(16) }, feed: 'Delayed',
        pulse: [
            { symbol: 'TSX:SHOP', label: 'Shopify' },
            { symbol: 'TSX:RY', label: 'Royal Bank' },
            { symbol: 'TSX:ENB', label: 'Enbridge' },
            { symbol: 'TSX:CNQ', label: 'Canadian Natural Resources' },
        ],
        groups: [
            { title: 'Finans', symbols: [['TSX:RY', 'Royal Bank'], ['TSX:TD', 'TD Bank'], ['TSX:BNS', 'Scotiabank'], ['TSX:BMO', 'Bank of Montreal'], ['TSX:CM', 'CIBC']] },
            { title: 'Enerji & Kaynak', symbols: [['TSX:ENB', 'Enbridge'], ['TSX:CNQ', 'Canadian Natural Resources'], ['TSX:SU', 'Suncor'], ['TSX:CNRL', 'Canadian Natural'], ['TSX:IMO', 'Imperial Oil']] },
        ],
        news: 'stock',
    },
    {
        id: 'au', name: 'Avustralya', short: 'AU', timeZone: 'Australia/Sydney', hours: { open: hm(10), close: hm(16) }, feed: 'Delayed',
        pulse: [
            { symbol: 'ASX:CBA', label: 'Commonwealth Bank' },
            { symbol: 'ASX:BHP', label: 'BHP Group' },
            { symbol: 'ASX:NAB', label: 'National Australia Bank' },
            { symbol: 'ASX:WES', label: 'Westfarmers' },
        ],
        groups: [
            { title: 'Bankalar', symbols: [['ASX:CBA', 'Commonwealth Bank'], ['ASX:NAB', 'National Australia Bank'], ['ASX:WBC', 'Westpac'], ['ASX:ANZ', 'ANZ Group']] },
            { title: 'Kaynak & Enerji', symbols: [['ASX:BHP', 'BHP Group'], ['ASX:RIO', 'Rio Tinto'], ['ASX:FMG', 'Fortescue'], ['ASX:WDS', 'Woodside Energy']] },
        ],
        news: 'stock',
    },
    {
        id: 'sa', name: 'Suudi Arabistan', short: 'SA', timeZone: 'Asia/Riyadh', hours: { open: hm(10), close: hm(15) }, feed: 'Delayed', yahoo: true, tradingDays: [0, 1, 2, 3, 4],
        pulse: [
            { symbol: 'TADAWUL:2222', label: 'Saudi Aramco' },
            { symbol: 'TADAWUL:2010', label: 'SABIC' },
            { symbol: 'TADAWUL:2082', label: 'ACWA Power' },
            { symbol: 'TADAWUL:1111', label: 'Tadawul Group' },
        ],
        groups: [
            { title: 'Enerji & Malzeme', symbols: [['TADAWUL:2222', 'Saudi Aramco'], ['TADAWUL:2010', 'SABIC'], ['TADAWUL:2082', 'ACWA Power'], ['TADAWUL:1111', 'Tadawul Group']] },
            { title: 'Telekom & Tüketici', symbols: [['TADAWUL:7010', 'STC Group'], ['TADAWUL:7020', 'Mobily'], ['TADAWUL:7030', 'Zain KSA'], ['TADAWUL:2280', 'Almarai'], ['TADAWUL:4300', 'Dar Alarkan']] },
        ],
        news: 'stock',
    },
    {
        id: 'tr', name: 'Türkiye', short: 'TR', timeZone: 'Europe/Istanbul', hours: { open: hm(10), close: hm(18) }, feed: 'Delayed', yahoo: true,
        pulse: [
            { symbol: 'XU100.IS', label: 'BIST 100' },
            { symbol: 'THYAO.IS', label: 'Turkish Airlines' },
            { symbol: 'ASELS.IS', label: 'ASELSAN' },
            { symbol: 'AKBNK.IS', label: 'Akbank' },
        ],
        groups: [
            { title: 'Bankalar', symbols: [['AKBNK.IS', 'Akbank'], ['GARAN.IS', 'Garanti BBVA'], ['ISCTR.IS', 'Isbank'], ['YKBNK.IS', 'Yapi Kredi'], ['HALKB.IS', 'Halkbank']] },
            { title: 'Endüstri & Taşımacılık', symbols: [['THYAO.IS', 'Turkish Airlines'], ['ASELS.IS', 'ASELSAN'], ['FROTO.IS', 'Ford Otosan'], ['PGSUS.IS', 'Pegasus'], ['TAVHL.IS', 'TAV Airports']] },
            { title: 'Tüketim & Enerji', symbols: [['BIMAS.IS', 'BIM'], ['TUPRS.IS', 'Tupras'], ['SISE.IS', 'Sisecam'], ['EREGL.IS', 'Eregli Iron & Steel'], ['KCHOL.IS', 'Koc Holding']] },
        ],
        news: 'stock',
    },
    {
        id: 'crypto', name: 'Kripto', short: 'CRYPTO', timeZone: 'America/New_York', hours: '24/7', feed: 'Live',
        pulse: [
            { symbol: 'BINANCE:BTCUSDT', label: 'Bitcoin' },
            { symbol: 'BINANCE:ETHUSDT', label: 'Ethereum' },
            { symbol: 'BINANCE:SOLUSDT', label: 'Solana' },
            { symbol: 'BINANCE:XRPUSDT', label: 'Ripple' },
        ],
        groups: [
            { title: 'Büyükler', symbols: [['BINANCE:BTCUSDT', 'Bitcoin'], ['BINANCE:ETHUSDT', 'Ethereum'], ['BINANCE:BNBUSDT', 'BNB'], ['BINANCE:SOLUSDT', 'Solana'], ['BINANCE:XRPUSDT', 'Ripple']] },
            { title: 'DeFi & Diğer', symbols: [['BINANCE:ADAUSDT', 'Cardano'], ['BINANCE:DOGEUSDT', 'Dogecoin'], ['BINANCE:AVAXUSDT', 'Avalanche'], ['BINANCE:LINKUSDT', 'Chainlink'], ['BINANCE:DOTUSDT', 'Polkadot'], ['BINANCE:MATICUSDT', 'Polygon'], ['BINANCE:TRXUSDT', 'TRON'], ['BINANCE:BCHUSDT', 'Bitcoin Cash'], ['BINANCE:LTCUSDT', 'Litecoin'], ['BINANCE:UNIUSDT', 'Uniswap'], ['BINANCE:ATOMUSDT', 'Cosmos'], ['BINANCE:ALGOUSDT', 'Algorand'], ['BINANCE:VETUSDT', 'VeChain'], ['BINANCE:ICPUSDT', 'Internet Computer'], ['BINANCE:FILUSDT', 'Filecoin'], ['BINANCE:NEARUSDT', 'Near Protocol'], ['BINANCE:APTUSDT', 'Aptos'], ['BINANCE:SUIUSDT', 'Sui'], ['BINANCE:INJUSDT', 'Injective'], ['BINANCE:SEIUSDT', 'Sei Network']] },
        ],
        heatmap: 'crypto', news: 'crypto',
    },
    {
        id: 'fx', name: 'Döviz', short: 'FX', timeZone: 'America/New_York', hours: '24/5', feed: 'Live',
        pulse: [
            { symbol: 'FX:EURUSD', label: 'EUR / USD' },
            { symbol: 'FX:GBPUSD', label: 'GBP / USD' },
            { symbol: 'FX:USDJPY', label: 'USD / JPY' },
            { symbol: 'FX:AUDUSD', label: 'AUD / USD' },
        ],
        groups: [
            { title: 'Büyükler', symbols: [['FX:EURUSD', 'EUR / USD'], ['FX:GBPUSD', 'GBP / USD'], ['FX:USDJPY', 'USD / JPY'], ['FX:USDCHF', 'USD / CHF'], ['FX:AUDUSD', 'AUD / USD'], ['FX:USDCAD', 'USD / CAD'], ['FX:NZDUSD', 'NZD / USD'], ['FX:USDSEK', 'USD / SEK'], ['FX:USDNOK', 'USD / NOK'], ['FX:USDMXN', 'USD / MXN'], ['FX:EURGBP', 'EUR / GBP'], ['FX:EURJPY', 'EUR / JPY'], ['FX:GBPJPY', 'GBP / JPY'], ['FX:CHFJPY', 'CHF / JPY']] },
            { title: 'Komoditik Döviz', symbols: [['FX:AUDUSD', 'AUD / USD'], ['FX:USDCAD', 'USD / CAD'], ['FX:NZDUSD', 'NZD / USD'], ['FX:USDSEK', 'USD / SEK'], ['FX:USDNOK', 'USD / NOK'], ['FX:USDMXN', 'USD / MXN'], ['FX:EURGBP', 'EUR / GBP'], ['FX:EURJPY', 'EUR / JPY'], ['FX:GBPJPY', 'GBP / JPY'], ['FX:CHFJPY', 'CHF / JPY']] },
        ],
        news: 'forex',
    },
];
export const DEFAULT_MARKET: MarketId = 'tr';
export const MARKET_COOKIE = 'openstock-market';
export const getMarket = (id?: string | null) => MARKETS.find((m) => m.id === id) ?? MARKETS[0];
const COUNTRY_MARKET: Record<string, MarketId> = { IN: 'in', DE: 'de', CA: 'ca', AU: 'au', SA: 'sa', TR: 'tr' };
export const marketForCountry = (country?: string | null): MarketId => COUNTRY_MARKET[country?.trim().toUpperCase() ?? ''] ?? DEFAULT_MARKET;
export const hasFinnhubQuotes = (symbol: string) => {
    const upper = symbol.toUpperCase();
    if (upper.startsWith('BINANCE:')) return true;
    return !upper.includes(':') && !isInternationalSymbol(upper);
};
export function isMarketOpen(market: Market, date = new Date()) {
    if (market.hours === '24/7') return true;
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: market.timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
            .formatToParts(date).map((p) => [p.type, p.value]),
    );
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    const minutes = Number(parts.hour) * 60 + Number(parts.minute);
    if (market.hours === '24/5') {
        if (day === 6) return false;
        if (day === 0) return minutes >= hm(17);
        if (day === 5) return minutes < hm(17);
        return true;
    }
    return (market.tradingDays ?? [1, 2, 3, 4, 5]).includes(day) && minutes >= market.hours.open && minutes < market.hours.close;
}