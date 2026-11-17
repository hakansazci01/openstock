// Topluluk bağlantıları, uygulama, giriş sayfası ve e-postalar genelinde kullanılır
export const REPO_URL = 'https://github.com/hakanborsa/OpenStock';
// Sponsorluk alıcı GitHub hesabı. Kuruluşun GitHub Sponsors listesi canlıyken (github.com/sponsors/hakanborsa) 'hakanborsa'ya geçin;
// her bağlantı ona uyarlanır.
export const SPONSOR_GITHUB_ACCOUNT = 'hakanborsa';
export const SPONSOR_URL = `https://github.com/sponsors/${SPONSOR_GITHUB_ACCOUNT}`;
// GitHub ödeme sayfasını tutarlı miktar ve sıklıkla açar

// Uygulama sahibi ve marka bilgisi
export const APP_OWNER_NAME = 'Hakan Borsa Analizi';
export const APP_OWNER_BRAND = 'hakanborsa';
export const APP_OWNER_DESCRIPTION = 'Hakan Borsa Analizi tarafından işletilen, finansal verileri ve al-sat sinyallerini tek bir yerde sunan açık kaynaklı borsa takip uygulamasıdır.';
export const APP_OWNER_EMAIL = 'hakansazci@gmail.com';
export const APP_COPYRIGHT_HOLDER = 'Hakan Borsa Analizi';
export const sponsorCheckoutUrl = (amount?: number, frequency: 'recurring' | 'one-time' = 'recurring') =>
    `${SPONSOR_URL}/sponsorships?frequency=${frequency}${amount ? `&amount=${amount}` : ''}`;
export const DISCORD_URL = 'https://discord.gg/JkJ8kfxgxB';
export const GOOD_FIRST_ISSUES_URL = `${REPO_URL}/issues?q=is%3Aopen+label%3A%22good+first+issue%22`;

// Kayıt formu seçim seçenekleri
export const INVESTMENT_GOALS = [
    { value: 'Growth', label: 'Büyüme' },
    { value: 'Income', label: 'Gelir' },
    { value: 'Balanced', label: 'Dengeli' },
    { value: 'Conservative', label: 'Güvenci' },
];

export const RISK_TOLERANCE_OPTIONS = [
    { value: 'Low', label: 'Düşük' },
    { value: 'Medium', label: 'Orta' },
    { value: 'High', label: 'Yüksek' },
];

export const PREFERRED_INDUSTRIES = [
    { value: 'Technology', label: 'Teknoloji' },
    { value: 'Healthcare', label: 'Sağlık' },
    { value: 'Finance', label: 'Finans' },
    { value: 'Energy', label: 'Enerji' },
    { value: 'Consumer Goods', label: 'Tüketim Malları' },
];

export const ALERT_TYPE_OPTIONS = [
    { value: 'upper', label: 'Üst' },
    { value: 'lower', label: 'Alt' },
];

export const CONDITION_OPTIONS = [
    { value: 'greater', label: 'Büyüktür (>)' },
    { value: 'less', label: 'Küçüktür (<)' },
];

// TradingView widgets, built per market from lib/markets.ts groups
type SymbolGroup = { title: string; symbols: [symbol: string, name: string][] };

export const marketOverviewConfig = (groups: SymbolGroup[]) => ({
    colorTheme: 'dark',
    dateRange: '12M',
    locale: 'en',
    largeChartUrl: '',
    isTransparent: true,
    showFloatingTooltip: true,
    plotLineColorGrowing: '#47d9bb', // brand teal (oklch 0.80 0.13 176)
    plotLineColorFalling: '#47d9bb',
    gridLineColor: 'rgba(240, 243, 250, 0)',
    scaleFontColor: '#adaba3', // --muted
    belowLineFillColorGrowing: 'rgba(71, 217, 187, 0.12)',
    belowLineFillColorFalling: 'rgba(71, 217, 187, 0.12)',
    belowLineFillColorGrowingBottom: 'rgba(71, 217, 187, 0)',
    belowLineFillColorFallingBottom: 'rgba(71, 217, 187, 0)',
    symbolActiveColor: 'rgba(71, 217, 187, 0.08)',
    tabs: groups.map(({ title, symbols }) => ({ title, symbols: symbols.map(([s, d]) => ({ s, d })) })),
    support_host: 'https://www.tradingview.com',
    showSymbolLogo: true,
    showChart: true,
});

export const marketQuotesConfig = (groups: SymbolGroup[]) => ({
    locale: 'en',
    showSymbolLogo: true,
    colorTheme: 'dark',
    isTransparent: true,
    symbolsGroups: groups.map(({ title, symbols }) => ({ name: title, symbols: symbols.map(([name, displayName]) => ({ name, displayName })) })),
});

export const STOCK_HEATMAP_CONFIG = {
    dataSource: 'SPX500',
    blockSize: 'market_cap_basic',
    blockColor: 'Değişim',
    grouping: 'sector',
    isTransparent: true,
    locale: 'en',
    symbolUrl: '',
    colorTheme: 'dark',
    exchanges: [],
    hasTopBar: false,
    isDataSetEnabled: false,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
};

export const CRYPTO_HEATMAP_CONFIG = {
    dataSource: 'Crypto',
    blockSize: 'market_cap_calc',
    blockColor: 'Değişim',
    locale: 'en',
    symbolUrl: '',
    colorTheme: 'dark',
    hasTopBar: false,
    isDataSetEnabled: false,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
    isTransparent: true,
};

export const timelineConfig = (market: 'stock' | 'crypto' | 'forex') => ({
    displayMode: 'regular',
    feedMode: 'market',
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'en',
    market,
});

export const symbolInfoConfig = (symbol: string) => ({
    symbol,
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'en',
    width: '100%',
});

export const singleQuoteConfig = (symbol: string) => ({
    symbol,
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'en',
});

export const CANDLE_CHART_WIDGET_CONFIG = (symbol: string) => ({
    allow_symbol_change: false,
    calendar: false,
    details: true,
    hide_side_toolbar: false, // drawing tools (trend lines, Fibonacci, text); drawings last until reload
    hide_top_toolbar: false,
    hide_legend: false,
    hide_volume: false,
    hotlist: false,
    interval: 'D',
    locale: 'en',
    save_image: false,
    style: 1,
    symbol: symbol.toUpperCase(),
    theme: 'dark',
    timezone: 'exchange',
    backgroundColor: '#1f1e1a', // --card
    gridColor: 'rgba(255, 255, 255, 0.04)',
    watchlist: [],
    withdateranges: false,
    compareSymbols: [],
    studies: [],
    width: '100%',
    height: 600,
});

export const TECHNICAL_ANALYSIS_WIDGET_CONFIG = (symbol: string) => ({
    symbol: symbol.toUpperCase(),
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'en',
    width: '100%',
    height: 400,
    interval: '1h',
    largeChartUrl: '',
});

// embed-widget-company-profile.js was retired by TradingView (403); symbol-profile.js takes the same config
export const COMPANY_PROFILE_WIDGET_CONFIG = (symbol: string) => ({
    symbol: symbol.toUpperCase(),
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'en',
    width: '100%',
    height: 440,
});

export const COMPANY_FINANCIALS_WIDGET_CONFIG = (symbol: string) => ({
    symbol: symbol.toUpperCase(),
    colorTheme: 'dark',
    isTransparent: true,
    locale: 'en',
    width: '100%',
    height: 464,
    displayMode: 'regular',
    largeChartUrl: '',
});

// Default list in the search palette (static on purpose, see searchStocks)
export const POPULAR_STOCKS = [
    // US Teknoloji Devleri (Magnificent 7 + genişleme)
    { symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corp', exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corp', exchange: 'NASDAQ' },
    { symbol: 'GOOGL', name: 'Alphabet Inc Class A', exchange: 'NASDAQ' },
    { symbol: 'GOOG', name: 'Alphabet Inc Class C', exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc', exchange: 'NASDAQ' },
    { symbol: 'META', name: 'Meta Platforms Inc', exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc', exchange: 'NASDAQ' },
    { symbol: 'AMD', name: 'Advanced Micro Devices Inc', exchange: 'NASDAQ' },
    { symbol: 'INTC', name: 'Intel Corp', exchange: 'NASDAQ' },
    { symbol: 'CRM', name: 'Salesforce Inc', exchange: 'NYSE' },
    { symbol: 'ADBE', name: 'Adobe Inc', exchange: 'NASDAQ' },
    { symbol: 'NFLX', name: 'Netflix Inc', exchange: 'NASDAQ' },
    { symbol: 'ORCL', name: 'Oracle Corp', exchange: 'NYSE' },
    { symbol: 'CSCO', name: 'Cisco Systems Inc', exchange: 'NASDAQ' },
    { symbol: 'AVGO', name: 'Broadcom Inc', exchange: 'NASDAQ' },
    { symbol: 'TXN', name: 'Texas Instruments Inc', exchange: 'NASDAQ' },
    { symbol: 'QCOM', name: 'Qualcomm Inc', exchange: 'NASDAQ' },
    { symbol: 'IBM', name: 'International Business Machines Corp', exchange: 'NYSE' },
    // US Finans
    { symbol: 'JPM', name: 'JPMorgan Chase & Co', exchange: 'NYSE' },
    { symbol: 'BAC', name: 'Bank of America Corp', exchange: 'NYSE' },
    { symbol: 'WFC', name: 'Wells Fargo & Co', exchange: 'NYSE' },
    { symbol: 'GS', name: 'Goldman Sachs Group Inc', exchange: 'NYSE' },
    { symbol: 'V', name: 'Visa Inc Class A', exchange: 'NYSE' },
    { symbol: 'MA', name: 'Mastercard Inc Class A', exchange: 'NYSE' },
    { symbol: 'PYPL', name: 'PayPal Holdings Inc', exchange: 'NASDAQ' },
    // US Tüketici ve Endüstri
    { symbol: 'WMT', name: 'Walmart Inc', exchange: 'NYSE' },
    { symbol: 'COST', name: 'Costco Wholesale Corp', exchange: 'NASDAQ' },
    { symbol: 'KO', name: 'Coca-Cola Co', exchange: 'NYSE' },
    { symbol: 'PEP', name: 'PepsiCo Inc', exchange: 'NASDAQ' },
    { symbol: 'MCD', name: "McDonald's Corp", exchange: 'NYSE' },
    { symbol: 'NKE', name: 'Nike Inc Class B', exchange: 'NYSE' },
    { symbol: 'SBUX', name: 'Starbucks Corp', exchange: 'NASDAQ' },
    // BIST Türk Hisseleri (Güncel)
    { symbol: 'THYAO.IS', name: 'Turk Hava Yollari AO', exchange: 'BIST' },
    { symbol: 'GARAN.IS', name: 'Garanti Bankasi AS', exchange: 'BIST' },
    { symbol: 'ISCTR.IS', name: 'Is Bankasi AS', exchange: 'BIST' },
    { symbol: 'AKBNK.IS', name: 'Akbank TAS', exchange: 'BIST' },
    { symbol: 'YKBNK.IS', name: 'Yapi Kredi Bankasi AS', exchange: 'BIST' },
    { symbol: 'SISE.IS', name: 'Sisecam', exchange: 'BIST' },
    { symbol: 'EREGL.IS', name: 'Eregli Demir ve Celik Fabrikalari TAS', exchange: 'BIST' },
    { symbol: 'KCHOL.IS', name: 'Koc Holding AS', exchange: 'BIST' },
    { symbol: 'SAHOL.IS', name: 'Sabiha Holding', exchange: 'BIST' },
    { symbol: 'TUPRS.IS', name: 'Turkiye Petrol Rafinerileri AS', exchange: 'BIST' },
    { symbol: 'ASELS.IS', name: 'Aselsan Elektronik Sanayi ve Ticaret AS', exchange: 'BIST' },
    { symbol: 'BIMAS.IS', name: 'BIM Birlesik Magazalar AS', exchange: 'BIST' },
    { symbol: 'FROTO.IS', name: 'Ford Otosan', exchange: 'BIST' },
    { symbol: 'TOASO.IS', name: 'Tofas Turk Otomobil Fabrikasi AS', exchange: 'BIST' },
    { symbol: 'EKGYO.IS', name: 'Emlak Konut Gayrettepe', exchange: 'BIST' },
    { symbol: 'GUBRF.IS', name: 'Goodyear Lastikleri TAS', exchange: 'BIST' },
    { symbol: 'TAVHL.IS', name: 'TAV Havalimanlari Holding AS', exchange: 'BIST' },
    { symbol: 'MIGROS.IS', name: 'Migros Ticaret AS', exchange: 'BIST' },
];

export const NO_MARKET_NEWS =
    '<p class="mobile-text" style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#4b5563;">Bugün piyasa haberi mevcut değil. Lütfen yarın tekrar kontrol edin.</p>';

export const WATCHLIST_TABLE_HEADER = [
    'Şirket',
    'Sembol',
    'Fiyat',
    'Değişim',
    'Piyasa Değeri',
    'F/K Oranı',
    'Uyarı',
    'İşlem',
];

export const PASSWORD_RULES = [
    { label: 'En az 8 karakter', test: (pw: string) => pw.length >= 8 },
    { label: 'En az 1 büyük harf', test: (pw: string) => /[A-Z]/.test(pw) },
    { label: 'En az 1 küçük harf', test: (pw: string) => /[a-z]/.test(pw) },
    { label: 'En az 1 rakam', test: (pw: string) => /[0-9]/.test(pw) },
] as const;

export const PASSWORD_VALIDATION = {
    required: 'Şifre gereklidir',
    minLength: { value: 8, message: 'Password must be En az 8 karakter' },
    pattern: {
        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
        message: 'Şifre büyük harf, küçük harf ve bir rakam içermelidir',
    },
};

