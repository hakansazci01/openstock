@echo off
chcp 65001 >nul
title OpenStock - Baslatma

echo ========================================
echo  OpenStock - Baslatiliyor...
echo ========================================
echo.

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

REM .env kontrolu
if not exist ".env" (
    echo [UYARI] .env dosyasi bulunamadi! Lutfen once setup.bat'i calistirin.
    pause
    exit /b 1
)

echo [1/3] MongoDB baslatiliyor...

REM MongoDB data dizinini olustur
if not exist "C:\data\db" (
    mkdir "C:\data\db" 2>nul
    echo [INFO] MongoDB data dizini olusturuldu: C:\data\db
)

REM MongoDB servisini baslatmaya calis (winget kurulumu icin)
net start MongoDB 2>nul
if %errorlevel% equ 0 (
    echo [OK] MongoDB servisi baslatildi.
) else (
    REM Servis yoksa, mongod ile manuel baslat
    mongod --dbpath "C:\data\db" --fork --logpath "C:\data\db\mongod.log" 2>nul
    if %errorlevel% equ 0 (
        echo [OK] MongoDB manuel baslatildi.
    ) else (
        echo [INFO] MongoDB zaten calisabiliyor. Devam ediliyor...
    )
)

timeout /t 2 >nul

echo.
echo [2/3] .env dosyasi kontrol ediliyor...
REM LIVE_TRADING_ENABLED kontrolu
findstr /C:"LIVE_TRADING_ENABLED=true" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] LIVE_TRADING_ENABLED=true
) else (
    echo [UYARI] LIVE_TRADING_ENABLED=true degil. Canli trading kapali olabilir.
)

echo.
echo [3/3] Next.js Uygulama baslatiliyor...
echo.
echo ========================================
echo  Uygulama: http://localhost:3000
echo  Durdurmak icin: CTRL+C
echo ========================================
echo.

npm run dev