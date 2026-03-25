import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { randomUUID, createHash } from 'crypto'
import { initSchema } from './db/schema'
import { getDb } from './db/schema'
import kenanRoutes from './routes/kenan'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

// Init DB
initSchema()

// Auto-seed if DB is empty
function autoSeed() {
  const db = getDb()
  const count = db.prepare('SELECT COUNT(*) as c FROM kenan_odemeler').get() as any
  if (count.c > 0) return

  const dataPath = path.join(process.cwd(), 'kenan_ozsoy_data.json')
  if (!fs.existsSync(dataPath)) return

  console.log('Database empty, seeding...')
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  const insertOdeme = db.prepare(`INSERT INTO kenan_odemeler (id, tarih, odeme_adi, tl_tutar, tutar_eur, kur, tl_karsiligi, durum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
  for (const o of data.odemeler) {
    const doviz = (o.doviz || '').toLowerCase()
    let tutar_eur = o.tutar_eur || 0
    let tl_tutar = o.tl || 0
    let tl_karsiligi = 0
    if (doviz === 'eur' && o.kur === 1) { tutar_eur = tl_tutar; tl_karsiligi = 0 }
    else if (doviz === 'usd') { tl_karsiligi = 0 }
    else { tl_karsiligi = tl_tutar; if (o.kur > 0 && tl_tutar > 0) tutar_eur = Math.round((tl_tutar / o.kur) * 100) / 100 }
    insertOdeme.run(randomUUID(), o.tarih, o.odeme_adi, tl_tutar, tutar_eur, o.kur || 0, tl_karsiligi, 'beklemede')
  }

  const insertSiparis = db.prepare(`INSERT INTO kenan_siparisler (id, tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, tutar_eur, vade_gun, durum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
  for (const s of data.siparisler) {
    insertSiparis.run(randomUUID(), s.tarih, s.fatura_no || null, s.musteri, s.siparis_no || null, s.tutar, s.kur || null, (s.doviz || 'EUR').toUpperCase(), s.tutar_eur || s.tutar, s.vade_gun || null, 'beklemede')
  }
  console.log(`Seeded ${data.odemeler.length} ödemeler + ${data.siparisler.length} siparişler`)

  // Seed default users
  const hash = (pw: string) => createHash('sha256').update(pw).digest('hex')
  const userCount = db.prepare('SELECT COUNT(*) as c FROM kenan_users').get() as any
  if (userCount.c === 0) {
    const defaultUsers = [
      { name: 'MeKansiz', password: '1234', role: 'admin' },
      { name: 'Kenan', password: '1234', role: 'user' },
    ]
    const insertUser = db.prepare('INSERT INTO kenan_users (id, name, password_hash, role) VALUES (?, ?, ?, ?)')
    for (const u of defaultUsers) {
      insertUser.run(randomUUID(), u.name, hash(u.password), u.role)
    }
    console.log(`Seeded ${defaultUsers.length} default users`)
  }
}
autoSeed()

// Routes
app.use('/api/kenan', kenanRoutes)

// Production: serve built frontend
const distPath = path.join(process.cwd(), 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Kenan Özsoy running on http://localhost:${PORT}`)
})
