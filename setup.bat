@echo off
chcp 65001 >nul
title OpenStock - Tam Otonom Kurulum

echo ========================================
echo  OpenStock - Tam Otonom Kurulum Betigi
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [UYARI] En iyi sonuc icin bu betigi YONETICI olarak calistirin.
    echo.
)

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo [1/8] Node.js kontrol ediliyor...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Node.js kurulu degil!
    echo       https://nodejs.org/ adresinden Node.js 18+ surumunu indirin ve kurun.
    echo       Ardindan bu betigi tekrar calistirin.
    pause
    exit /b 1
)
node --version
echo [OK] Node.js kurulu.

echo.
echo [2/8] MongoDB kontrol ediliyor...
where mongod >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] MongoDB bulunamadi. Otomatik yuklenmeye calisiliyor...
    where winget >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] Winget ile MongoDB yukleniyor...
        winget install MongoDB.MongoDBCommunityServer --accept-package-agreements --accept-source-agreements
        if %errorlevel% neq 0 (
            echo [UYARI] MongoDB otomatik yuklenemedi.
            echo       Lutfen https://www.mongodb.com/try/download/community adresinden el ile kurun.
        ) else (
            echo [OK] MongoDB otomatik yuklendi.
        )
    ) else (
        echo [UYARI] Winget bulunamadi. MongoDB'yi el ile kurun: https://www.mongodb.com/try/download/community
    )
) else (
    mongod --version | head -n 1
    echo [OK] MongoDB zaten kurulu.
)

REM MongoDB data dizinini olustur
if not exist "C:\data\db" (
    mkdir "C:\data\db" 2>nul
    echo [INFO] MongoDB data dizini olusturuldu: C:\data\db
)

echo.
echo [3/8] NPM paketleri yukleniyor...
npm install
if %errorlevel% neq 0 (
    echo [HATA] NPM paketleri yuklenemedi.
    pause
    exit /b 1
)
echo [OK] NPM paketleri yuklendi.

echo.
echo [4/6] .env dosyasi olusturuluyor...
if exist ".env" (
    echo [INFO] .env dosyasi zaten mevcut. Degerler kontrol ediliyor...
) else (
    if exist ".env.template" (
        copy ".env.template" ".env"
        echo [OK] .env olusturuldu.
    ) else (
        echo [UYARI] .env.template bulunamadi, bos .env olusturuluyor.
        type nul > .env
    )
)

REM LIVE_TRADING_ENABLED otomatik true yap
echo [INFO] LIVE_TRADING_ENABLED=true ayarlaniyor...
powershell -Command "(Get-Content .env -Raw) -replace 'LIVE_TRADING_ENABLED=false', 'LIVE_TRADING_ENABLED=true' | Set-Content .env"
if %errorlevel% equ 0 (
    echo [OK] LIVE_TRADING_ENABLED=true
) else (
    echo [UYARI] LIVE_TRADING_ENABLED ayarlanamadi, el ile kontrol edin.
)

echo.
echo [5/6] Uygulama derleniyor (Build)...
npm run build
if %errorlevel% neq 0 (
    echo [HATA] Build basarisiz oldu.
    pause
    exit /b 1
)
echo [OK] Build basarili.

echo.
echo [6/6] Kurulum TAMAMLANDI!
echo ========================================
echo.
echo [OK] Kurulum basariyla tamamlandi.
echo.
echo ========================================
echo  MANUEL ISLEMLER (Gerekli)
echo ========================================
echo.
echo 1. .env dosyasini acip asagidaki alanlari doldurun:
echo    - BETTER_AUTH_SECRET        : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
echo    - ENCRYPTION_MASTER_KEY     : Ayni komutle uretin
echo    - FINNHUB_API_KEY           : https://finnhub.io/register (zaten eklenmis olabilir)
echo    - GEMINI_API_KEY            : https://aistudio.google.com/app/api-keys
echo.
echo 2. Gmail Uygulama Sifresi (E-posta icin):
echo    - Google Hesap > Guvenlik > 2 Adimli Dogrulama etkinlestirin
echo    - Uygulama sifreleri > Yeni sifre olusturun
echo    - NODEMAILER_EMAIL ve NODEMAILER_PASSWORD alanlarini doldurun
echo.
echo 3. Twilio (WhatsApp/SMS icin):
echo    - https://www.twilio.com/try-twilio adresinden hesap olusturun
echo    - TWILIO_ACCOUNT_SID ve TWILIO_AUTH_TOKEN alanlarini doldurun
echo.
echo 4. Broker API Anahtarlari:
echo    - Uygulamayi baslattiktan sonra Broker Config sayfasina girin
echo    - Alpaca, Binance, Kraken, Coinbase, Bybit veya IBKR ayarlari ekleyin
echo.
echo Sistemi baslatmak icin: start.bat calistirin.
echo Uygulama: http://localhost:3000
echo.
pause