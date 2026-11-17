# OpenStock - Otonom Kurulum Rehberi

Bu rehber, OpenStock uygulamasının başka bir bilgisayarda sıfırdan nasıl kurulacağını ve çalıştırılacağını açıklar.

## 📋 Gereksinimler

- Windows 10/11
- İnternet bağlantısı (Node.js ve MongoDB indirimi için)
- Yönetici yetkileri (MongoDB servisi için önerilir)

## 🚀 Hızlı Kurulum

### Adım 1: Dosyaları Kopyalayın

Tüm `OpenStock-main` klasörünü hedef bilgisayara kopyalayın.

### Adım 2: Kurulumu Çalıştırın

`setup.bat` dosyasını **yönetici olarak** çalıştırın:

1. `setup.bat`'e sağ tıklayın → **Yönetici olarak çalıştır**
2. Betik şunları yapar:
   - Node.js kontrolü ve kurulum uyarısı
   - MongoDB kontrolü ve kurulum uyarısı
   - NPM paketlerini yükler
   - `.env` dosyasını oluşturur
   - Uygulamayı derler (build)

### Adım 3: .env Dosyasını Doldurun

Kurulum sonrası oluşturulan `.env` dosyasını bir metin editörü ile açın ve **zorunlu** alanları doldurun:

```env
BETTER_AUTH_SECRET=<64 karakterli rastgele string>
FINNHUB_API_KEY=<finnhub.io'dan alinan API anahtari>
ENCRYPTION_MASTER_KEY=<64 karakterli rastgele hex string>
```

**Rastgele string üretmek için:**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Adım 4: Uygulamayı Başlatın

`start.bat` dosyasını çift tıklayın:

1. MongoDB başlatılır
2. Next.js uygulama başlatılır
3. Tarayıcınızda `http://localhost:3000` adresine gidin

## 📁 Dosya Yapısı

```
OpenStock-main/
├── setup.bat          # Otonom kurulum betigi
├── start.bat          # Uygulama baslatma betigi
├── .env.template      # Ortaklik dosyasi sablonu
├── .env               # Gercek ayarlar (siz olusturursunuz)
├── package.json       # NPM bagimliliklari
├── next.config.ts     # Next.js ayarlari
└── ...                # Uygulama dosyalari
```

## 🔐 Güvenlik Ayarları (Gerekli)

Gerçek para işlemleri için `.env` dosyasında şunları yapılandırın:

```env
LIVE_TRADING_ENABLED=true
LIVE_MAX_ORDER_NOTIONAL_USD=100
LIVE_MAX_DAILY_NOTIONAL_USD=500
LIVE_MAX_DAILY_LOSS_USD=100
```

## 🏦 Desteklenen Borsalar

- **Alpaca** - ABD hisse senedi
- **Binance** - Kripto para
- **Kraken** - Kripto para
- **Coinbase** - Kripto para
- **Bybit** - Kripto para
- **Interactive Brokers** - Global hisse senedi

Broker kimlik bilgilerini uygulama içindeki Broker Config sayfasından ekleyin.

## 🛠 Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| Node.js bulunamadı | https://nodejs.org'dan kurun |
| MongoDB bulunamadı | https://www.mongodb.com/try/download/community'dan kurun |
| Port 3000 kullanımda | Başka bir uygulama kapatın veya portu değiştirin |
| .env hatası | .env dosyasının mevcut olduğundan ve doldurulduğundan emin olun |
| Build hatası | `npm install` komutunu tekrar çalıştırın |

## 📞 Destek

Hata alıyorsanız lütfen hata mesajını ve işletim sistemi sürümünü paylaşın.