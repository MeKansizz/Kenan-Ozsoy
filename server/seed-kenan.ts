import { getDb, initSchema } from './db/schema'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'kenan_ozsoy_data.json')
const raw = fs.readFileSync(dataPath, 'utf-8')
const data = JSON.parse(raw)

initSchema()
const db = getDb()

// Clear existing kenan data
db.exec('DELETE FROM kenan_odemeler')
db.exec('DELETE FROM kenan_siparisler')


console.log('Cleared existing kenan data.')

// Import ödemeler
const insertOdeme = db.prepare(`
  INSERT INTO kenan_odemeler (id, tarih, odeme_adi, tl_tutar, tutar_eur, kur, tl_karsiligi, durum, donem, notlar, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`)

let odemeCount = 0
for (const o of data.odemeler) {
  const doviz = (o.doviz || '').toLowerCase()
  let tutar_eur = o.tutar_eur || 0
  let tl_tutar = o.tl || 0
  let kur = o.kur || 0
  let tl_karsiligi = 0

  if (doviz === 'eur' && kur === 1.0) {
    // Direct EUR amount - tl field is actually EUR
    tutar_eur = tl_tutar
    tl_karsiligi = 0
  } else if (doviz === 'usd') {
    // USD amount with EUR/USD cross rate
    // tl field has USD amount, kur is EUR/USD rate
    // tutar_eur already calculated in JSON
    tl_karsiligi = 0
  } else {
    // TL amount with EUR/TRY kur
    tl_karsiligi = tl_tutar
    if (kur > 0 && tl_tutar > 0) {
      tutar_eur = Math.round((tl_tutar / kur) * 100) / 100
    }
  }

  const durum = o.durum === 'tamamlandi' ? 'tamamlandi' : 'beklemede'

  insertOdeme.run(
    randomUUID(),
    o.tarih,
    o.odeme_adi,
    tl_tutar,
    tutar_eur,
    kur,
    tl_karsiligi,
    durum,
    null, // donem
    null  // notlar
  )
  odemeCount++
}
console.log(`Imported ${odemeCount} ödemeler.`)

// Import siparişler
const insertSiparis = db.prepare(`
  INSERT INTO kenan_siparisler (id, tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, tutar_eur, vade_gun, durum, notlar, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`)

let siparisCount = 0
for (const s of data.siparisler) {
  const doviz = (s.doviz || 'eur').toLowerCase()
  let tutar_eur = s.tutar || 0

  if (doviz === 'usd') {
    // USD order - kur is EUR/USD cross rate, tutar is EUR equivalent
    // tutar_doviz has the USD amount
    tutar_eur = s.tutar || 0
  }

  const durum = s.durum === 'tamamlandi' ? 'tamamlandi' : 'beklemede'

  insertSiparis.run(
    randomUUID(),
    s.tarih,
    s.fatura_no || null,
    s.musteri,
    s.siparis_no || null,
    s.tutar,
    s.kur || null,
    doviz.toUpperCase(),
    tutar_eur,
    s.vade_gun || null,
    durum,
    null, // notlar
    )
  siparisCount++
}
console.log(`Imported ${siparisCount} siparişler.`)

console.log('\nImport complete!')
console.log(`Total: ${odemeCount} ödemeler + ${siparisCount} siparişler`)
