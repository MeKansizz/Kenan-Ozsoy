# Kenan Ozsoy Finans Takip - Kurulum

## Gereksinimler
- Node.js 18+
- npm

## Kurulum

1. Zip dosyasini acin
2. Klasore girin:
   ```bash
   cd finans-deploy
   ```
3. Bagimliliklari yukleyin:
   ```bash
   npm install --production
   ```

## Calistirma

### Yontem 1: start.sh ile
```bash
chmod +x start.sh
./start.sh
```

### Yontem 2: Manuel
```bash
PORT=3001 node dist-server/index.js
```

## Erisim

Tarayicida acin: **http://localhost:3001**

## Varsayilan Kullanicilar

| Kullanici | Sifre | Rol |
|-----------|-------|-----|
| MeKansiz | 1234 | admin |
| Kenan | 1234 | user |

## Notlar

- Veritabani ilk calistirmada otomatik olusturulur (`data/kenan.db`)
- Veriler `kenan_ozsoy_data.json` dosyasindan otomatik yuklenir
- Port degistirmek icin: `PORT=8080 node dist-server/index.js`
