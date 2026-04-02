# Kayteks - Kenan Özsoy | Finans Takip Sistemi

## Proje Özeti

Kayteks tekstil firmasının Kenan Özsoy ile cari hesap, sipariş ve ödeme takibi yapan full-stack web uygulaması. Gerçek TCMB kurlarıyla TL→EUR dönüşümü yapar.

## Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS (dark theme, custom CSS variables) |
| Backend | Express.js + TypeScript (tsx watch) |
| Database | SQLite (better-sqlite3, WAL mode) |
| Icons | lucide-react |
| Dev | concurrently (client + server paralel) |

## Proje Yapısı

```
kenan-ozsoy/
├── src/
│   ├── pages/
│   │   ├── KenanOzsoyPage.tsx      # Ana sayfa (layout, login, tab yönetimi)
│   │   ├── OdemelerPage.tsx        # Ödemeler sekmesi (kategori toplamları dahil)
│   │   ├── SiparislerPage.tsx      # Siparişler sekmesi (termin tarihleri dahil)
│   │   └── OdemePlanlamaPage.tsx   # Planlama sekmesi (cari bilgi + oluşacak bakiye)
│   ├── components/
│   │   └── Modal.tsx               # Ortak modal bileşeni
│   ├── lib/
│   │   ├── api.ts                  # API client (fetch wrapper)
│   │   └── kenan-utils.ts          # Ortak util fonksiyonları (formatEur, formatTl, formatDate vb.)
│   ├── main.tsx                    # React entry
│   └── styles/                     # CSS dosyaları
├── server/
│   ├── index.ts                    # Express sunucu (port 3001)
│   ├── db/schema.ts                # SQLite schema + migration'lar
│   ├── routes/kenan.ts             # Tüm API route'ları
│   └── seed-kenan.ts               # Veritabanı seed scripti
├── data/kenan.db                   # SQLite veritabanı (gitignore)
├── vite.config.ts                  # Vite config (port 5174, proxy → 3001)
└── package.json
```

## Çalıştırma

```bash
# Tüm sistem (client + server)
npm run dev

# Sadece client (port 5174)
npm run dev:client

# Sadece server (port 3001)
npm run dev:server

# Veritabanı seed
npm run db:seed
```

## Portlar

| Servis | Port |
|--------|------|
| Frontend (Vite) | 5174 |
| Backend (Express) | 3001 |
| Vite proxy | /api → localhost:3001 |

## Production Sunucu (Kayteks)

| Bilgi | Değer |
|-------|-------|
| Domain | https://finans.kayteks.com |
| Sunucu IP | 94.102.15.75 |
| CloudPanel | https://cp.veriops.com |
| CloudPanel Kullanıcı | kayteks |
| CloudPanel Şifre | nDmkVKqjvNK73oogi1k8 |
| SSH Kullanıcı | kayteks-finans |
| SSH Şifre | CloudPanel → Ayarlar → Yeni Parola Oluştur |
| Proje Dizini | /home/kayteks-finans/htdocs/finans.kayteks.com |
| Port | 3001 |
| Process Manager | PM2 (name: finans) |
| Node.js | v18.20.8 |

### Deploy (Güncelleme) Adımları

```bash
# 1. Local'de commit + push
git add -A && git commit -m "açıklama" && git push

# 2. SSH bağlan
ssh kayteks-finans@94.102.15.75

# 3. Güncelle (tek komut)
cd ~/htdocs/finans.kayteks.com && git pull && npm run build:all && pm2 restart finans
```

### PM2 Komutları (SSH'da)

```bash
pm2 status          # Durumu gör
pm2 logs finans     # Logları gör
pm2 restart finans  # Yeniden başlat
pm2 stop finans     # Durdur
pm2 start finans    # Başlat
```

### Render (Yedek)

| Bilgi | Değer |
|-------|-------|
| URL | https://kenan-ozsoy.onrender.com |
| Dashboard | https://dashboard.render.com |
| Auto-Deploy | On Commit (git push ile otomatik) |

## GitHub

| Bilgi | Değer |
|-------|-------|
| Repo | https://github.com/MeKansizz/Kenan-Ozsoy |
| Visibility | Public |
| Branch | main |

## Veritabanı Şeması

### kenan_odemeler
Ödeme kayıtları (TL → EUR dönüşümlü)
- `id` TEXT PK, `tarih`, `odeme_adi`, `tl_tutar`, `tutar_eur`, `kur`, `durum`, `donem`, `notlar`, `updated_by`
- `kategori` TEXT DEFAULT 'Muhtelif' — Ödeme kategorisi (Çek, Banka, Muhtelif, Maaş / SGK, İplik Cari, İplik İhtiyaç, Boyahane)
- `planlamada` INTEGER DEFAULT 0 — Planlamaya dahil mi (0/1)
- `plan_sira` INTEGER DEFAULT 0 — Planlama sıralama numarası
- `hesap_disi` INTEGER DEFAULT 0 — Hesap dışı mı (0/1)

### kenan_siparisler
Sipariş kayıtları (EUR/USD)
- `id` TEXT PK, `tarih`, `fatura_no`, `musteri`, `siparis_no`, `tutar`, `kur`, `doviz`, `tutar_eur`, `vade_gun`, `durum`, `notlar`, `updated_by`
- `maliyet_iplik` REAL DEFAULT 0 — İplik maliyet
- `maliyet_boya` REAL DEFAULT 0 — Boya maliyet
- `maliyet_boyahane` TEXT DEFAULT '' — Boyahane ismi
- `maliyet_navlun` REAL DEFAULT 0 — Navlun maliyet
- `iplik_termin` TEXT DEFAULT '' — İplik termin tarihi
- `boya_termin` TEXT DEFAULT '' — Boya termin tarihi

### kenan_users
Kullanıcı yönetimi (şifreli giriş)
- `id`, `name` UNIQUE, `password_hash`

### kenan_login_log
Giriş kayıtları
- `id`, `user_name`, `login_at`

### kenan_audit_log
Değişiklik takibi
- `id`, `table_name`, `record_id`, `action`, `changes`, `changed_by`

## API Endpoints

```
GET    /api/kenan/tcmb-kur?date=YYYY-MM-DD   # TCMB döviz kuru
GET    /api/kenan/users                        # Kullanıcı listesi
POST   /api/kenan/users/register               # Yeni kullanıcı
POST   /api/kenan/users/set-password           # İlk şifre belirleme
PUT    /api/kenan/users/change-password         # Şifre değiştirme
POST   /api/kenan/login                        # Giriş
GET    /api/kenan/login-log                    # Giriş logları
GET    /api/kenan/cari                         # Birleşik cari hesap görünümü
GET    /api/kenan/odemeler                     # Ödeme listesi
POST   /api/kenan/odemeler                     # Yeni ödeme
PUT    /api/kenan/odemeler/:id                 # Ödeme güncelle
DELETE /api/kenan/odemeler/:id                 # Ödeme sil
GET    /api/kenan/siparisler                   # Sipariş listesi
POST   /api/kenan/siparisler                   # Yeni sipariş
PUT    /api/kenan/siparisler/:id               # Sipariş güncelle
DELETE /api/kenan/siparisler/:id               # Sipariş sil
```

## UI Yapısı

### Üst Kısım Layout
- Sol: Başlık "Cari Hesap Nakit Akış"
- Sağ: Login paneli + Son Girişler dropdown + Deploy kutusu (yan yana)
- Son Girişler: Tıklanınca aşağı açılan dropdown panel (Clock ikonu + son giriş yapan kullanıcı adı)

### Sekmeler (Tab Bar — başlığın altında)
1. **Cari Hesap** — Sipariş + ödeme birleşik tablo (devir bakiye kartları)
2. **Ödemeler** — Ödeme yönetimi + kategori bazlı toplam/tamamlanan/kalan özeti
3. **Siparişler** — Sipariş yönetimi (termin tarihleri, maliyet sütunları)
4. **Planlama** — Ödeme planlama + cari bilgi kartları + oluşacak bakiye

### Cari Hesap Sekmesi
- Devir bakiye, toplam giren (sipariş), toplam çıkan (ödeme), net bakiye kartları
- Hafta bazlı gruplanmış birleşik tablo

### Ödemeler Sekmesi
- Ana toplam kartları (toplam, tamamlanan, kalan)
- Kategori Detayları dropdown butonu — tıklayınca açılır
  - Kategoriler: Çek, Banka, Muhtelif, Maaş / SGK, İplik Cari, İplik İhtiyaç, Boyahane
  - Her kategori için toplam / tamamlanan / kalan kartları (küçük punto)
- Hafta bazlı gruplanmış ödeme tablosu
- Form: Kategori seçimi dahil

### Siparişler Sekmesi
- Tablo sütun sırası: HD, Tarih, Müşteri, Fatura No, Sipariş No, Tutar, Vade, İplik, İplik T., Boya, Boya T., Navlun, Durum, Kişi
- İplik Termin (İplik T.) → İplik sütununun hemen yanında
- Boya Termin (Boya T.) → Boya sütununun hemen yanında
- Vade → Tutar sütununun hemen yanında
- Form: Boyahane + İplik Termin + Boya Termin (3 sütun grid, date input)

### Planlama Sekmesi
- 2 satır × 4 kart bilgi paneli:
  - Satır 1: Devir Bakiye, Toplam Giren (Sipariş), Toplam Çıkan (Ödeme), Net Bakiye
  - Satır 2: Planlanan Ödemeler, Planlanan Siparişler, Denge, Oluşacak Bakiye
- Oluşacak Bakiye = Net Bakiye + Denge
- Denge = Planlanan Siparişler - Planlanan Ödemeler
- Planlama tablosu (sürükle-bırak sıralama)

### Hafta Bazlı Gruplama
- Tablolar ISO hafta numarasına göre gruplanır (H9, H10, H11...)
- Her hafta başlığında: hafta no, tarih aralığı, kayıt sayısı, toplam EUR
- Form'larda tarih seçilince hangi haftaya düştüğü gösterilir

### Durum Sistemi
- `beklemede` → sarı badge
- `tamamlandi` → yeşil badge

### Tema
Dark theme, CSS custom properties:
- `--color-midnight`, `--color-slate`, `--color-steel`, `--color-graphite`
- `--color-text-primary/secondary/muted`
- `copper` (turuncu, ödemeler), `info` (mavi, siparişler)

## İş Kuralları

1. **Devir Bakiyesi**: BASLANGIC_BAKIYE = -1.565.867,46 € (Kayteks borçlu, 24/03/2026 itibariyle)
2. **Dinamik Bakiye**: Devir + Siparişler - Ödemeler
3. **TCMB Kuru**: Tarih girilince otomatik çekilir, manuel düzenlenebilir
4. **EUR Hesaplama**: TL tutar / kur = EUR karşılığı (ödemelerde)
5. **Audit Trail**: Her değişiklik audit_log tablosuna kaydedilir
6. **Kullanıcı Yetki**: İşlem yapmak için giriş yapılmış olmalı
7. **Oluşacak Bakiye Formülü**: Net Bakiye + (Planlanan Siparişler - Planlanan Ödemeler)

## Production Veri Senkronizasyonu

Local veritabanına production verilerini çekmek için:

```bash
# Production'dan verileri çek ve local DB'ye yaz
curl -s https://finans.kayteks.com/api/kenan/siparisler | node -e "
const http = require('http');
const data = require('fs').readFileSync('/dev/stdin','utf8');
const items = JSON.parse(data);
// Her item için local API'ye POST/PUT
"

# Veya basitçe: production API'den çek, local API'ye POST et
# Ödemeler
curl -s https://finans.kayteks.com/api/kenan/odemeler > /tmp/odemeler.json
# Siparişler
curl -s https://finans.kayteks.com/api/kenan/siparisler > /tmp/siparisler.json
```

## Geliştirme Kuralları

### 1. Varsayılan Plan Modu
- Basit olmayan HER görev için plan moduna gir (3+ adım veya mimari kararlar)
- Bir şey ters giderse DUR ve yeniden planla — körü körüne devam etme
- Belirsizliği azaltmak için baştan detaylı spesifikasyon yaz

### 2. Alt-Ajan Stratejisi
- Ana bağlam penceresini temiz tutmak için alt-ajanları bol bol kullan
- Araştırma, keşif ve paralel analizi alt-ajanlara yükle
- Karmaşık problemlerde alt-ajanlarla daha fazla işlem gücü harca
- Odaklı yürütme için her alt-ajana tek bir görev ver

### 3. Kendini Geliştirme Döngüsü
- Kullanıcıdan HERHANGİ bir düzeltme sonrası: `tasks/lessons.md`'yi güncelle
- Aynı hatanın tekrarını önleyen kurallar yaz
- Hata oranı düşene kadar bu dersleri acımasızca geliştir
- Her oturum başında ilgili projenin derslerini gözden geçir

### 4. Tamamlanmadan Önce Doğrulama
- Çalıştığını kanıtlamadan bir görevi asla tamamlandı olarak işaretleme
- Gerektiğinde ana dal ile değişikliklerin arasındaki farkı kontrol et
- Kendine sor: "Kıdemli bir mühendis bunu onaylar mıydı?"
- Testleri çalıştır, logları kontrol et, doğruluğu kanıtla

### 5. Zarafet Talep Et (Dengeli)
- Basit olmayan değişikliklerde dur ve sor: "Daha zarif bir yol var mı?"
- Çözüm yamalı hissediyorsa: "Şu an bildiklerimle zarif çözümü uygula"
- Basit, bariz düzeltmelerde bunu atla — aşırı mühendislik yapma
- Sunmadan önce kendi işini sorgula

### 6. Otonom Hata Düzeltme
- Hata raporu verildiğinde: direkt düzelt. El tutulmasını bekleme
- Loglara, hatalara, başarısız testlere bak — sonra çöz
- Kullanıcıdan sıfır bağlam değişikliği gereksin
- CI testleri başarısız olunca nasıl yapılacağı söylenmeden git düzelt

## Görev Yönetimi

1. **Plan Önce**: `tasks/todo.md`'ye işaretlenebilir maddelerle plan yaz
2. **Planı Doğrula**: Uygulamaya başlamadan önce onayla
3. **İlerlemeyi Takip Et**: İlerledikçe maddeleri tamamlandı işaretle
4. **Değişiklikleri Açıkla**: Her adımda üst düzey özet sun
5. **Sonuçları Belgele**: `tasks/todo.md`'ye inceleme bölümü ekle
6. **Dersleri Kaydet**: Düzeltmelerden sonra `tasks/lessons.md`'yi güncelle

## Temel İlkeler

- **Önce Sadelik**: Her değişikliği olabildiğince basit yap. Minimal kod etkisi.
- **Tembellik Yok**: Kök nedeni bul. Geçici çözüm yok. Kıdemli standartlar.
- **Immutability**: Objeleri mutate etme, yeni obje oluştur (`{ ...obj, key: val }`)
- **Dosya Boyutu**: 200-400 satır normal, 800 max. Fonksiyonlar <50 satır.
- **Error Handling**: Her riskli operasyon try/catch ile sarılmalı
- **Hardcoded Yok**: Sabitler const olarak tanımlanmalı, `.env` kullanılmalı
