import { Router } from 'express'
import { getDb } from '../db/schema'
import { randomUUID, createHash } from 'crypto'

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex')
}

const router = Router()

// ===================== TCMB KUR =====================

async function fetchTcmbRate(dateStr: string): Promise<{ eur: number; usd: number } | null> {
  const d = new Date(dateStr)
  // Try up to 7 days back (weekends/holidays)
  for (let i = 0; i < 7; i++) {
    const target = new Date(d)
    target.setDate(target.getDate() - i)
    const dd = String(target.getDate()).padStart(2, '0')
    const mm = String(target.getMonth() + 1).padStart(2, '0')
    const yyyy = target.getFullYear()
    const url = `https://www.tcmb.gov.tr/kurlar/${yyyy}${mm}/${dd}${mm}${yyyy}.xml`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) continue
      const xml = await res.text()
      const eurMatch = xml.match(/<Currency[^>]*CurrencyCode="EUR"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>/i)
      const usdMatch = xml.match(/<Currency[^>]*CurrencyCode="USD"[^>]*>[\s\S]*?<ForexSelling>([\d.,]+)<\/ForexSelling>/i)
      if (eurMatch && usdMatch) {
        return {
          eur: parseFloat(eurMatch[1].replace(',', '.')),
          usd: parseFloat(usdMatch[1].replace(',', '.'))
        }
      }
    } catch (_) { continue }
  }
  return null
}

router.get('/tcmb-kur', async (req, res) => {
  const { date } = req.query as Record<string, string>
  const today = new Date().toISOString().slice(0, 10)
  const targetDate = date || today

  // If date is today or future, use previous day
  const startDate = targetDate >= today
    ? new Date(new Date(today).setDate(new Date(today).getDate() - 1)).toISOString().slice(0, 10)
    : targetDate

  const rates = await fetchTcmbRate(startDate)
  if (rates) {
    res.json(rates)
  } else {
    res.status(404).json({ message: 'Kur bilgisi bulunamadı' })
  }
})

// ===================== KULLANICILAR =====================

router.get('/users', (_req, res) => {
  const db = getDb()
  const users = db.prepare('SELECT id, name, role, created_at FROM kenan_users ORDER BY name').all()
  res.json(users)
})

// Admin kullanıcı ekleme (sadece admin yapabilir)
router.post('/users/register', (req, res) => {
  const db = getDb()
  const { name, password, admin_user } = req.body
  if (!name || !password) return res.status(400).json({ message: 'İsim ve şifre gerekli' })
  if (password.length < 4) return res.status(400).json({ message: 'Şifre en az 4 karakter olmalı' })

  // Admin yetki kontrolü
  if (admin_user) {
    const admin = db.prepare('SELECT role FROM kenan_users WHERE name = ?').get(admin_user) as any
    if (!admin || admin.role !== 'admin') return res.status(403).json({ message: 'Bu işlem için admin yetkisi gerekli' })
  } else {
    return res.status(403).json({ message: 'Admin yetkisi gerekli' })
  }

  const existing = db.prepare('SELECT id FROM kenan_users WHERE name = ?').get(name) as any
  if (existing) return res.status(400).json({ message: 'Bu kullanıcı adı zaten mevcut' })

  const id = randomUUID()
  const hash = hashPassword(password)
  db.prepare('INSERT INTO kenan_users (id, name, password_hash, role) VALUES (?, ?, ?, ?)').run(id, name, hash, 'user')
  res.json({ id, name })
})

// Şifre değiştir
router.put('/users/change-password', (req, res) => {
  const db = getDb()
  const { name, old_password, new_password } = req.body
  if (!name || !old_password || !new_password) return res.status(400).json({ message: 'Tüm alanlar gerekli' })
  if (new_password.length < 4) return res.status(400).json({ message: 'Yeni şifre en az 4 karakter olmalı' })

  const user = db.prepare('SELECT * FROM kenan_users WHERE name = ?').get(name) as any
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' })
  if (user.password_hash !== hashPassword(old_password)) return res.status(401).json({ message: 'Mevcut şifre yanlış' })

  db.prepare('UPDATE kenan_users SET password_hash = ? WHERE name = ?').run(hashPassword(new_password), name)
  res.json({ success: true })
})

// Kullanıcı sil (sadece admin)
router.delete('/users/:name', (req, res) => {
  const db = getDb()
  const { admin_user } = req.query as Record<string, string>
  if (!admin_user) return res.status(403).json({ message: 'Admin yetkisi gerekli' })
  const admin = db.prepare('SELECT role FROM kenan_users WHERE name = ?').get(admin_user) as any
  if (!admin || admin.role !== 'admin') return res.status(403).json({ message: 'Admin yetkisi gerekli' })
  if (req.params.name === admin_user) return res.status(400).json({ message: 'Kendinizi silemezsiniz' })

  const user = db.prepare('SELECT id FROM kenan_users WHERE name = ?').get(req.params.name) as any
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' })

  db.prepare('DELETE FROM kenan_users WHERE name = ?').run(req.params.name)
  res.json({ success: true })
})

// ===================== GİRİŞ LOGU =====================

router.get('/login-log', (_req, res) => {
  const db = getDb()
  const logs = db.prepare('SELECT * FROM kenan_login_log ORDER BY login_at DESC LIMIT 5').all()
  res.json(logs)
})

// Şifre belirleme (şifresi olmayan eski kullanıcılar için)
router.post('/users/set-password', (req, res) => {
  const db = getDb()
  const { name, password } = req.body
  if (!name || !password) return res.status(400).json({ message: 'İsim ve şifre gerekli' })
  if (password.length < 4) return res.status(400).json({ message: 'Şifre en az 4 karakter olmalı' })

  const user = db.prepare('SELECT * FROM kenan_users WHERE name = ?').get(name) as any
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' })
  if (user.password_hash) return res.status(400).json({ message: 'Bu kullanıcının şifresi zaten belirlenmiş' })

  db.prepare('UPDATE kenan_users SET password_hash = ? WHERE name = ?').run(hashPassword(password), name)
  res.json({ success: true })
})

// Giriş yap (şifre doğrulamalı)
router.post('/login', (req, res) => {
  const db = getDb()
  const { user_name, password } = req.body
  if (!user_name || !password) return res.status(400).json({ message: 'Kullanıcı adı ve şifre gerekli' })

  const user = db.prepare('SELECT * FROM kenan_users WHERE name = ?').get(user_name) as any
  if (!user) return res.status(404).json({ message: 'Kullanıcı bulunamadı' })
  if (!user.password_hash) return res.status(403).json({ message: 'needs_password', needs_password: true })
  if (user.password_hash !== hashPassword(password)) return res.status(401).json({ message: 'Şifre yanlış' })

  const id = randomUUID()
  db.prepare('INSERT INTO kenan_login_log (id, user_name) VALUES (?, ?)').run(id, user_name)
  res.json({ success: true, user_name, role: user.role || 'user' })
})

// ===================== AUDIT LOG =====================

function logAudit(tableName: string, recordId: string, action: string, changes: any, changedBy: string) {
  const db = getDb()
  db.prepare(`
    INSERT INTO kenan_audit_log (id, table_name, record_id, action, changes, changed_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), tableName, recordId, action, JSON.stringify(changes), changedBy)
}

router.get('/audit-log', (req, res) => {
  const db = getDb()
  const { record_id, table_name } = req.query as Record<string, string>
  let sql = 'SELECT * FROM kenan_audit_log WHERE 1=1'
  const params: any[] = []
  if (record_id) { sql += ' AND record_id = ?'; params.push(record_id) }
  if (table_name) { sql += ' AND table_name = ?'; params.push(table_name) }
  sql += ' ORDER BY changed_at DESC LIMIT 50'
  res.json(db.prepare(sql).all(...params))
})

// ===================== CARİ HESAP (birleşik görünüm) =====================

router.get('/cari', (req, res) => {
  const db = getDb()
  const { start, end } = req.query as Record<string, string>

  // Combine ödemeler (çıkan) and siparişler (giren) into unified cari view
  let whereClause = ''
  const params: any[] = []
  if (start) { whereClause += ' AND tarih >= ?'; params.push(start) }
  if (end) { whereClause += ' AND tarih <= ?'; params.push(end) }

  const sql = `
    SELECT * FROM (
      SELECT id, tarih, 'ÖDEME' as islem_tipi, odeme_adi as aciklama, '' as referans,
        0 as giren_eur, tutar_eur as cikan_eur, kur, tl_karsiligi, durum,
        '' as temlikname_no, '' as vade_tarihi, notlar, updated_by, 'odeme' as kaynak,
        COALESCE(hesap_disi, 0) as hesap_disi, created_at
      FROM kenan_odemeler
      WHERE 1=1 ${whereClause}
      UNION ALL
      SELECT id, tarih, 'SİPARİŞ' as islem_tipi,
        musteri || COALESCE(' - ' || siparis_no, '') as aciklama,
        COALESCE(fatura_no, '') as referans,
        COALESCE(tutar_eur, tutar) as giren_eur, 0 as cikan_eur, kur, 0 as tl_karsiligi, durum,
        '' as temlikname_no, '' as vade_tarihi, notlar, updated_by, 'siparis' as kaynak,
        COALESCE(hesap_disi, 0) as hesap_disi, created_at
      FROM kenan_siparisler
      WHERE 1=1 ${whereClause}
    ) combined
    ORDER BY tarih ASC, created_at ASC
  `

  // Double params for both UNIONs
  const allParams = [...params, ...params]
  const rows = db.prepare(sql).all(...allParams)
  res.json(rows)
})

// ===================== ÖDEMELER =====================

router.get('/odemeler', (req, res) => {
  const db = getDb()
  const { donem, durum } = req.query as Record<string, string>
  let sql = 'SELECT * FROM kenan_odemeler WHERE 1=1'
  const params: any[] = []
  if (donem) { sql += ' AND donem = ?'; params.push(donem) }
  if (durum) { sql += ' AND durum = ?'; params.push(durum) }
  sql += ' ORDER BY tarih ASC'
  res.json(db.prepare(sql).all(...params))
})

router.get('/odemeler/summary', (_req, res) => {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN COALESCE(hesap_disi,0)=0 THEN tutar_eur ELSE 0 END), 0) as toplam,
      COALESCE(SUM(CASE WHEN durum='tamamlandi' AND COALESCE(hesap_disi,0)=0 THEN tutar_eur ELSE 0 END), 0) as tamamlanan,
      COALESCE(SUM(CASE WHEN durum='beklemede' AND COALESCE(hesap_disi,0)=0 THEN tutar_eur ELSE 0 END), 0) as bekleyen
    FROM kenan_odemeler
  `).get()
  res.json(row)
})

router.post('/odemeler', (req, res) => {
  const db = getDb()
  const id = randomUUID()
  const { tarih, odeme_adi, tl_tutar, tutar_eur, kur, doviz, durum, donem, notlar, hesap_disi, kategori, user } = req.body

  // Currency-aware EUR calculation
  let finalEur = tutar_eur || 0
  let finalTl = tl_tutar || 0
  const currency = (doviz || 'TL').toUpperCase()
  if (currency === 'EUR') {
    finalEur = finalTl
  } else if (finalTl && kur && !tutar_eur) {
    finalEur = Math.round((finalTl / kur) * 100) / 100
  }
  const tl_karsiligi = currency === 'TL' ? finalTl : (kur ? finalEur * kur : 0)
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO kenan_odemeler (id, tarih, odeme_adi, tl_tutar, tutar_eur, kur, doviz, tl_karsiligi, durum, donem, notlar, hesap_disi, kategori, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tarih, odeme_adi, finalTl, finalEur, kur || null, currency, tl_karsiligi || null, durum || 'beklemede', donem || null, notlar || null, hesap_disi ? 1 : 0, kategori || '', user || null, now)

  logAudit('kenan_odemeler', id, 'create', { tarih, odeme_adi, tl_tutar: finalTl, tutar_eur: finalEur, kur, durum }, user || 'system')
  res.json({ id })
})

router.put('/odemeler/:id', (req, res) => {
  const db = getDb()
  const { tarih, odeme_adi, tl_tutar, tutar_eur, kur, doviz, durum, donem, notlar, hesap_disi, kategori, user } = req.body

  // Get old values for audit
  const old = db.prepare('SELECT * FROM kenan_odemeler WHERE id = ?').get(req.params.id) as any
  if (!old) return res.status(404).json({ message: 'Kayıt bulunamadı' })

  let finalEur = tutar_eur || 0
  let finalTl = tl_tutar || 0
  const currency = (doviz || 'TL').toUpperCase()
  if (currency === 'EUR') {
    finalEur = finalTl
  } else if (finalTl && kur && !tutar_eur) {
    finalEur = Math.round((finalTl / kur) * 100) / 100
  }
  const tl_karsiligi = currency === 'TL' ? finalTl : (kur ? finalEur * kur : 0)
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE kenan_odemeler SET tarih=?, odeme_adi=?, tl_tutar=?, tutar_eur=?, kur=?, doviz=?, tl_karsiligi=?, durum=?, donem=?, notlar=?, hesap_disi=?, kategori=?, updated_by=?, updated_at=?
    WHERE id=?
  `).run(tarih, odeme_adi, finalTl, finalEur, kur || null, currency, tl_karsiligi || null, durum || 'beklemede', donem || null, notlar || null, hesap_disi !== undefined ? (hesap_disi ? 1 : 0) : (old.hesap_disi || 0), kategori !== undefined ? (kategori || '') : (old.kategori || ''), user || null, now, req.params.id)

  // Build changes diff
  const changes: Record<string, { old: any; new: any }> = {}
  const fields = ['tarih', 'odeme_adi', 'tl_tutar', 'tutar_eur', 'kur', 'durum', 'donem', 'notlar']
  const newVals: Record<string, any> = { tarih, odeme_adi, tl_tutar: finalTl, tutar_eur: finalEur, kur, durum, donem, notlar }
  for (const f of fields) {
    if (String(old[f] ?? '') !== String(newVals[f] ?? '')) {
      changes[f] = { old: old[f], new: newVals[f] }
    }
  }
  if (Object.keys(changes).length > 0) {
    logAudit('kenan_odemeler', req.params.id, 'update', changes, user || 'system')
  }

  res.json({ success: true })
})

router.delete('/odemeler/:id', (req, res) => {
  const db = getDb()
  const { user } = req.query as Record<string, string>
  const old = db.prepare('SELECT * FROM kenan_odemeler WHERE id = ?').get(req.params.id)
  db.prepare('DELETE FROM kenan_odemeler WHERE id = ?').run(req.params.id)
  logAudit('kenan_odemeler', req.params.id, 'delete', old, user || 'system')
  res.json({ success: true })
})

// ===================== SİPARİŞLER =====================

router.get('/siparisler', (req, res) => {
  const db = getDb()
  const { durum } = req.query as Record<string, string>
  let sql = 'SELECT * FROM kenan_siparisler WHERE 1=1'
  const params: any[] = []
  if (durum) { sql += ' AND durum = ?'; params.push(durum) }
  sql += ' ORDER BY tarih ASC'
  res.json(db.prepare(sql).all(...params))
})

router.get('/siparisler/summary', (_req, res) => {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN COALESCE(hesap_disi,0)=0 THEN tutar_eur ELSE 0 END), 0) as toplam,
      COALESCE(SUM(CASE WHEN durum='tamamlandi' AND COALESCE(hesap_disi,0)=0 THEN tutar_eur ELSE 0 END), 0) as tamamlanan,
      COALESCE(SUM(CASE WHEN durum='beklemede' AND COALESCE(hesap_disi,0)=0 THEN tutar_eur ELSE 0 END), 0) as bekleyen
    FROM kenan_siparisler
  `).get()
  res.json(row)
})

router.post('/siparisler', (req, res) => {
  const db = getDb()
  const id = randomUUID()
  const { tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, vade_gun, durum, notlar, hesap_disi, maliyet_iplik, maliyet_boya, maliyet_navlun, iplik_cinsi, iplik_miktar, iplik_birim_fiyat, iplik_birim_doviz, iplik_entries, boyahane, iplik_termin, boya_termin, user } = req.body

  const tutar_eur = tutar // EUR or USD amount directly
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO kenan_siparisler (id, tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, tutar_eur, vade_gun, durum, notlar, hesap_disi, maliyet_iplik, maliyet_boya, maliyet_navlun, iplik_cinsi, iplik_miktar, iplik_birim_fiyat, iplik_birim_doviz, iplik_entries, boyahane, iplik_termin, boya_termin, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tarih, fatura_no || null, musteri, siparis_no || null, tutar, kur || null, doviz || 'EUR', tutar_eur, vade_gun || null, durum || 'beklemede', notlar || null, hesap_disi ? 1 : 0, maliyet_iplik || 0, maliyet_boya || 0, maliyet_navlun || 0, iplik_cinsi || '', iplik_miktar || 0, iplik_birim_fiyat || 0, iplik_birim_doviz || 'EUR', iplik_entries ? JSON.stringify(iplik_entries) : '[]', boyahane || '', iplik_termin || '', boya_termin || '', user || null, now)

  logAudit('kenan_siparisler', id, 'create', { tarih, musteri, tutar, doviz, durum }, user || 'system')
  res.json({ id })
})

router.put('/siparisler/:id', (req, res) => {
  const db = getDb()
  const { tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, tutar_eur, vade_gun, durum, notlar, hesap_disi, maliyet_iplik, maliyet_boya, maliyet_navlun, iplik_cinsi, iplik_miktar, iplik_birim_fiyat, iplik_birim_doviz, iplik_entries, boyahane, iplik_termin, boya_termin, user } = req.body

  const old = db.prepare('SELECT * FROM kenan_siparisler WHERE id = ?').get(req.params.id) as any
  if (!old) return res.status(404).json({ message: 'Kayıt bulunamadı' })

  const now = new Date().toISOString()

  db.prepare(`
    UPDATE kenan_siparisler SET tarih=?, fatura_no=?, musteri=?, siparis_no=?, tutar=?, kur=?, doviz=?, tutar_eur=?, vade_gun=?, durum=?, notlar=?, hesap_disi=?, maliyet_iplik=?, maliyet_boya=?, maliyet_navlun=?, iplik_cinsi=?, iplik_miktar=?, iplik_birim_fiyat=?, iplik_birim_doviz=?, iplik_entries=?, boyahane=?, iplik_termin=?, boya_termin=?, updated_by=?, updated_at=?
    WHERE id=?
  `).run(tarih, fatura_no || null, musteri, siparis_no || null, tutar, kur || null, doviz || 'EUR', tutar_eur || tutar, vade_gun || null, durum || 'beklemede', notlar || null, hesap_disi !== undefined ? (hesap_disi ? 1 : 0) : (old.hesap_disi || 0), maliyet_iplik !== undefined ? (maliyet_iplik || 0) : (old.maliyet_iplik || 0), maliyet_boya !== undefined ? (maliyet_boya || 0) : (old.maliyet_boya || 0), maliyet_navlun !== undefined ? (maliyet_navlun || 0) : (old.maliyet_navlun || 0), iplik_cinsi !== undefined ? (iplik_cinsi || '') : (old.iplik_cinsi || ''), iplik_miktar !== undefined ? (iplik_miktar || 0) : (old.iplik_miktar || 0), iplik_birim_fiyat !== undefined ? (iplik_birim_fiyat || 0) : (old.iplik_birim_fiyat || 0), iplik_birim_doviz !== undefined ? (iplik_birim_doviz || 'EUR') : (old.iplik_birim_doviz || 'EUR'), iplik_entries !== undefined ? JSON.stringify(iplik_entries) : (old.iplik_entries || '[]'), boyahane !== undefined ? (boyahane || '') : (old.boyahane || ''), iplik_termin !== undefined ? (iplik_termin || '') : (old.iplik_termin || ''), boya_termin !== undefined ? (boya_termin || '') : (old.boya_termin || ''), user || null, now, req.params.id)

  const changes: Record<string, { old: any; new: any }> = {}
  const fields = ['tarih', 'fatura_no', 'musteri', 'siparis_no', 'tutar', 'kur', 'doviz', 'vade_gun', 'durum', 'notlar']
  const newVals: Record<string, any> = { tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, vade_gun, durum, notlar }
  for (const f of fields) {
    if (String(old[f] ?? '') !== String(newVals[f] ?? '')) {
      changes[f] = { old: old[f], new: newVals[f] }
    }
  }
  if (Object.keys(changes).length > 0) {
    logAudit('kenan_siparisler', req.params.id, 'update', changes, user || 'system')
  }

  res.json({ success: true })
})

router.delete('/siparisler/:id', (req, res) => {
  const db = getDb()
  const { user } = req.query as Record<string, string>
  const old = db.prepare('SELECT * FROM kenan_siparisler WHERE id = ?').get(req.params.id)
  db.prepare('DELETE FROM kenan_siparisler WHERE id = ?').run(req.params.id)
  logAudit('kenan_siparisler', req.params.id, 'delete', old, user || 'system')
  res.json({ success: true })
})

// === ÖDEME PLANLAMADA TOGGLE ===

// Tarih sırasına göre doğru sira hesapla
function calcSiraByDate(db: any, tarih: string): number {
  // Tüm plan öğelerini tarih ve sira ile çek
  const odemeler = db.prepare("SELECT tarih, plan_sira as sira FROM kenan_odemeler WHERE planlamada = 1 AND (hesap_disi IS NULL OR hesap_disi = 0) AND plan_sira IS NOT NULL ORDER BY plan_sira ASC").all() as any[]
  const planlar = db.prepare("SELECT s.tarih, p.sira FROM kenan_planlama p JOIN kenan_siparisler s ON p.siparis_id = s.id ORDER BY p.sira ASC").all() as any[]
  const maliyetler = db.prepare("SELECT termin as tarih, sira FROM kenan_planlama_maliyet ORDER BY sira ASC").all() as any[]

  const all = [...odemeler, ...planlar, ...maliyetler].sort((a, b) => a.sira - b.sira)
  if (all.length === 0) return 1

  // Tarihine göre doğru pozisyonu bul
  let insertIdx = all.length // default: sona ekle
  for (let i = 0; i < all.length; i++) {
    if (tarih <= all[i].tarih) {
      insertIdx = i
      break
    }
  }

  // Sira hesapla (iki komşu arasında)
  if (insertIdx === 0) return all[0].sira - 1
  if (insertIdx >= all.length) return all[all.length - 1].sira + 1
  return (all[insertIdx - 1].sira + all[insertIdx].sira) / 2
}

router.put('/odemeler/:id/planlamada', (req, res) => {
  const db = getDb()
  const { planlamada } = req.body
  const val = planlamada ? 1 : 0
  if (val === 1) {
    const current = db.prepare('SELECT plan_sira, tarih FROM kenan_odemeler WHERE id = ?').get(req.params.id) as any
    if (!current?.plan_sira) {
      const sira = calcSiraByDate(db, current?.tarih || '9999-12-31')
      db.prepare('UPDATE kenan_odemeler SET planlamada = 1, plan_sira = ? WHERE id = ?').run(sira, req.params.id)
      return res.json({ success: true })
    }
  }
  db.prepare('UPDATE kenan_odemeler SET planlamada = ? WHERE id = ?').run(val, req.params.id)
  res.json({ success: true })
})

// === ÖDEME PLAN SIRA ===

router.put('/odemeler/:id/plan-sira', (req, res) => {
  const db = getDb()
  const { sira } = req.body
  db.prepare('UPDATE kenan_odemeler SET plan_sira = ? WHERE id = ?').run(sira, req.params.id)
  res.json({ success: true })
})

// Tüm planlama öğelerini tarihe göre yeniden sırala (ödeme + sipariş karışık)
router.post('/planlama/sort-by-date', (_req, res) => {
  const db = getDb()
  const odemeler = db.prepare("SELECT id, tarih, 'odeme' as tip FROM kenan_odemeler WHERE planlamada = 1 AND (hesap_disi IS NULL OR hesap_disi = 0)").all() as any[]
  const planlar = db.prepare("SELECT p.id, s.tarih, 'siparis' as tip FROM kenan_planlama p JOIN kenan_siparisler s ON p.siparis_id = s.id").all() as any[]
  const maliyetler = db.prepare("SELECT id, termin as tarih, 'maliyet' as tip FROM kenan_planlama_maliyet").all() as any[]

  const all = [...odemeler, ...planlar, ...maliyetler].sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''))

  const stmtOdeme = db.prepare('UPDATE kenan_odemeler SET plan_sira = ? WHERE id = ?')
  const stmtPlan = db.prepare('UPDATE kenan_planlama SET sira = ? WHERE id = ?')
  const stmtMaliyet = db.prepare('UPDATE kenan_planlama_maliyet SET sira = ? WHERE id = ?')

  db.transaction(() => {
    all.forEach((item, i) => {
      const sira = i + 1
      if (item.tip === 'odeme') stmtOdeme.run(sira, item.id)
      else if (item.tip === 'siparis') stmtPlan.run(sira, item.id)
      else stmtMaliyet.run(sira, item.id)
    })
  })()

  // Marker'ları mevcut pozisyonlarına göre yeniden numarala (aralara sığsın)
  const markers = db.prepare('SELECT id, sira FROM kenan_plan_markers ORDER BY sira ASC').all() as any[]
  const stmtMarker = db.prepare('UPDATE kenan_plan_markers SET sira = ? WHERE id = ?')
  db.transaction(() => {
    markers.forEach((m, i) => stmtMarker.run(all.length + i + 1, m.id))
  })()

  res.json({ sorted: all.length, markers: markers.length })
})

router.post('/planlama/init-sira', (_req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT id FROM kenan_odemeler WHERE plan_sira IS NULL AND (hesap_disi IS NULL OR hesap_disi = 0) ORDER BY tarih ASC').all() as any[]
  if (rows.length === 0) { res.json({ initialized: 0 }); return }
  const max = (db.prepare('SELECT COALESCE(MAX(plan_sira), 0) as m FROM kenan_odemeler').get() as any).m
  const stmt = db.prepare('UPDATE kenan_odemeler SET plan_sira = ? WHERE id = ?')
  db.transaction(() => { rows.forEach((r: any, i: number) => stmt.run(max + i + 1, r.id)) })()
  res.json({ initialized: rows.length })
})

// === PLANLAMA ===

router.get('/planlama', (_req, res) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT p.id, p.siparis_id, p.sira, p.created_by, p.created_at,
           s.tarih, s.musteri, s.siparis_no, s.fatura_no, s.tutar, s.kur, s.doviz, s.tutar_eur, s.vade_gun, s.durum
    FROM kenan_planlama p
    JOIN kenan_siparisler s ON p.siparis_id = s.id
    ORDER BY p.sira ASC
  `).all()
  res.json(rows)
})

router.post('/planlama', (req, res) => {
  const db = getDb()
  const { siparis_id, sira, user } = req.body
  const existing = db.prepare('SELECT id FROM kenan_planlama WHERE siparis_id = ?').get(siparis_id)
  if (existing) {
    res.status(400).json({ message: 'Bu sipariş zaten plana eklenmiş' })
    return
  }
  const id = randomUUID()
  let finalSira = sira
  if (finalSira == null) {
    const siparis = db.prepare('SELECT tarih FROM kenan_siparisler WHERE id = ?').get(siparis_id) as any
    finalSira = calcSiraByDate(db, siparis?.tarih || '9999-12-31')
  }
  db.prepare('INSERT INTO kenan_planlama (id, siparis_id, sira, created_by) VALUES (?, ?, ?, ?)').run(id, siparis_id, finalSira, user || 'system')

  // Siparişin iplik/boya maliyetini otomatik planlamaya ekle (grup bazlı)
  const sip = db.prepare('SELECT maliyet_iplik, maliyet_boya, iplik_termin, boya_termin, COALESCE(iplik_cinsi, \'\') as iplik_cinsi, COALESCE(boyahane, \'\') as boyahane FROM kenan_siparisler WHERE id = ?').get(siparis_id) as any
  if (sip) {
    // İplik maliyet — iplik_cinsi + iplik_termin grubundaki toplam
    if (sip.iplik_termin && sip.maliyet_iplik > 0) {
      const existingMaliyet = db.prepare('SELECT id FROM kenan_planlama_maliyet WHERE tip = ? AND termin = ? AND COALESCE(grup, \'\') = ?').get('iplik', sip.iplik_termin, sip.iplik_cinsi)
      if (!existingMaliyet) {
        const toplamRow = db.prepare(`SELECT SUM(maliyet_iplik) as toplam FROM kenan_siparisler WHERE iplik_termin = ? AND COALESCE(iplik_cinsi, '') = ? AND (hesap_disi IS NULL OR hesap_disi = 0)`).get(sip.iplik_termin, sip.iplik_cinsi) as any
        const maliyetId = randomUUID()
        const maliyetSira = calcSiraByDate(db, sip.iplik_termin)
        db.prepare('INSERT INTO kenan_planlama_maliyet (id, tip, termin, tutar_eur, sira, grup) VALUES (?, ?, ?, ?, ?, ?)').run(maliyetId, 'iplik', sip.iplik_termin, toplamRow?.toplam || 0, maliyetSira, sip.iplik_cinsi)
      }
    }
    // Boya maliyet — boyahane + boya_termin grubundaki toplam
    if (sip.boya_termin && sip.maliyet_boya > 0) {
      const existingMaliyet = db.prepare('SELECT id FROM kenan_planlama_maliyet WHERE tip = ? AND termin = ? AND COALESCE(grup, \'\') = ?').get('boya', sip.boya_termin, sip.boyahane)
      if (!existingMaliyet) {
        const toplamRow = db.prepare(`SELECT SUM(maliyet_boya) as toplam FROM kenan_siparisler WHERE boya_termin = ? AND COALESCE(boyahane, '') = ? AND (hesap_disi IS NULL OR hesap_disi = 0)`).get(sip.boya_termin, sip.boyahane) as any
        const maliyetId = randomUUID()
        const maliyetSira = calcSiraByDate(db, sip.boya_termin)
        db.prepare('INSERT INTO kenan_planlama_maliyet (id, tip, termin, tutar_eur, sira, grup) VALUES (?, ?, ?, ?, ?, ?)').run(maliyetId, 'boya', sip.boya_termin, toplamRow?.toplam || 0, maliyetSira, sip.boyahane)
      }
    }
  }

  res.json({ id, siparis_id, sira: finalSira })
})

router.put('/planlama/:id/sira', (req, res) => {
  const db = getDb()
  const { sira } = req.body
  db.prepare('UPDATE kenan_planlama SET sira = ? WHERE id = ?').run(sira, req.params.id)
  res.json({ success: true })
})

router.delete('/planlama/:id', (req, res) => {
  const db = getDb()
  const plan = db.prepare('SELECT siparis_id FROM kenan_planlama WHERE id = ?').get(req.params.id) as any
  if (plan) {
    const sip = db.prepare('SELECT iplik_termin, boya_termin, COALESCE(iplik_cinsi, \'\') as iplik_cinsi, COALESCE(boyahane, \'\') as boyahane FROM kenan_siparisler WHERE id = ?').get(plan.siparis_id) as any
    db.prepare('DELETE FROM kenan_planlama WHERE id = ?').run(req.params.id)

    // Grup bazında başka sipariş kaldı mı kontrol et
    if (sip?.iplik_termin) {
      const remaining = db.prepare(`
        SELECT COUNT(*) as cnt FROM kenan_planlama p
        JOIN kenan_siparisler s ON s.id = p.siparis_id
        WHERE s.iplik_termin = ? AND COALESCE(s.iplik_cinsi, '') = ? AND s.maliyet_iplik > 0
      `).get(sip.iplik_termin, sip.iplik_cinsi) as any
      if (remaining.cnt === 0) {
        db.prepare('DELETE FROM kenan_planlama_maliyet WHERE tip = ? AND termin = ? AND COALESCE(grup, \'\') = ?').run('iplik', sip.iplik_termin, sip.iplik_cinsi)
      }
    }
    if (sip?.boya_termin) {
      const remaining = db.prepare(`
        SELECT COUNT(*) as cnt FROM kenan_planlama p
        JOIN kenan_siparisler s ON s.id = p.siparis_id
        WHERE s.boya_termin = ? AND COALESCE(s.boyahane, '') = ? AND s.maliyet_boya > 0
      `).get(sip.boya_termin, sip.boyahane) as any
      if (remaining.cnt === 0) {
        db.prepare('DELETE FROM kenan_planlama_maliyet WHERE tip = ? AND termin = ? AND COALESCE(grup, \'\') = ?').run('boya', sip.boya_termin, sip.boyahane)
      }
    }
  } else {
    db.prepare('DELETE FROM kenan_planlama WHERE id = ?').run(req.params.id)
  }
  res.json({ success: true })
})

// === PLAN MARKERS (boş bakiye satırları) ===

router.get('/planlama/markers', (_req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT id, sira, label, created_at FROM kenan_plan_markers ORDER BY sira ASC').all()
  res.json(rows)
})

router.post('/planlama/markers', (req, res) => {
  const db = getDb()
  const { sira, label } = req.body
  const id = randomUUID()
  // En başa ekle: en küçük sira'dan 1 çıkar
  const minOdeme = (db.prepare('SELECT COALESCE(MIN(plan_sira), 1) as m FROM kenan_odemeler WHERE planlamada = 1').get() as any).m
  const minPlan = (db.prepare('SELECT COALESCE(MIN(sira), 1) as m FROM kenan_planlama').get() as any).m
  const minMarker = (db.prepare('SELECT COALESCE(MIN(sira), 1) as m FROM kenan_plan_markers').get() as any).m
  const finalSira = sira ?? (Math.min(minOdeme, minPlan, minMarker) - 1)
  db.prepare('INSERT INTO kenan_plan_markers (id, sira, label) VALUES (?, ?, ?)').run(id, finalSira, label || '')
  res.json({ id, sira: finalSira })
})

router.put('/planlama/markers/:id/sira', (req, res) => {
  const db = getDb()
  const { sira } = req.body
  db.prepare('UPDATE kenan_plan_markers SET sira = ? WHERE id = ?').run(sira, req.params.id)
  res.json({ success: true })
})

router.delete('/planlama/markers/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM kenan_plan_markers WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// === PLANLAMA MALİYET (iplik/boya termin grupları) ===

// Termin + grup bazlı maliyet özeti (sağ taraf)
// İplik: iplik_cinsi + iplik_termin bazında
// Boya: boyahane + boya_termin bazında
router.get('/planlama/maliyet-summary', (_req, res) => {
  const db = getDb()
  const iplik = db.prepare(`
    SELECT iplik_termin as termin, COALESCE(iplik_cinsi, '') as grup, SUM(maliyet_iplik) as toplam, COUNT(*) as adet
    FROM kenan_siparisler
    WHERE iplik_termin != '' AND iplik_termin IS NOT NULL AND maliyet_iplik > 0 AND (hesap_disi IS NULL OR hesap_disi = 0)
    GROUP BY iplik_termin, iplik_cinsi ORDER BY iplik_termin ASC
  `).all() as any[]
  const boya = db.prepare(`
    SELECT boya_termin as termin, COALESCE(boyahane, '') as grup, SUM(maliyet_boya) as toplam, COUNT(*) as adet
    FROM kenan_siparisler
    WHERE boya_termin != '' AND boya_termin IS NOT NULL AND maliyet_boya > 0 AND (hesap_disi IS NULL OR hesap_disi = 0)
    GROUP BY boya_termin, boyahane ORDER BY boya_termin ASC
  `).all() as any[]

  // Hangileri zaten plana eklenmiş?
  const planned = db.prepare('SELECT tip, termin, COALESCE(grup, \'\') as grup FROM kenan_planlama_maliyet').all() as any[]
  const plannedSet = new Set(planned.map((p: any) => `${p.tip}:${p.termin}:${p.grup}`))

  // İplik kg toplamlarını iplik_entries JSON'dan hesapla
  const allSip = db.prepare(`
    SELECT iplik_termin, COALESCE(iplik_cinsi, '') as iplik_cinsi, COALESCE(iplik_entries, '[]') as iplik_entries, COALESCE(iplik_miktar, 0) as iplik_miktar
    FROM kenan_siparisler
    WHERE iplik_termin != '' AND iplik_termin IS NOT NULL AND maliyet_iplik > 0 AND (hesap_disi IS NULL OR hesap_disi = 0)
  `).all() as any[]

  // İplik detay: her gruptaki bireysel iplik kalemleri (cinsi, kg, birim fiyat, döviz)
  const kgMap: Record<string, number> = {}
  const detayMap: Record<string, { cinsi: string; miktar: number; birim_fiyat: number; doviz: string }[]> = {}
  for (const s of allSip) {
    const key = `${s.iplik_termin}:${s.iplik_cinsi}`
    if (!detayMap[key]) detayMap[key] = []
    let kg = 0
    try {
      const entries = JSON.parse(s.iplik_entries || '[]')
      if (entries.length > 0) {
        for (const e of entries) {
          const m = parseFloat(e.miktar) || 0
          const bf = parseFloat(e.birim_fiyat) || 0
          kg += m
          detayMap[key].push({ cinsi: e.cinsi || '', miktar: m, birim_fiyat: bf, doviz: e.doviz || 'EUR' })
        }
      } else {
        kg = s.iplik_miktar || 0
        if (kg > 0) detayMap[key].push({ cinsi: s.iplik_cinsi || '', miktar: kg, birim_fiyat: 0, doviz: 'EUR' })
      }
    } catch {
      kg = s.iplik_miktar || 0
      if (kg > 0) detayMap[key].push({ cinsi: s.iplik_cinsi || '', miktar: kg, birim_fiyat: 0, doviz: 'EUR' })
    }
    kgMap[key] = (kgMap[key] || 0) + kg
  }

  res.json({
    iplik: iplik.map(r => ({
      ...r,
      toplam_kg: kgMap[`${r.termin}:${r.grup}`] || 0,
      detay: detayMap[`${r.termin}:${r.grup}`] || [],
      planned: plannedSet.has(`iplik:${r.termin}:${r.grup}`),
    })),
    boya: boya.map(r => ({ ...r, planned: plannedSet.has(`boya:${r.termin}:${r.grup}`) })),
  })
})

// Plana eklenmiş maliyet satırları (sol taraf)
router.get('/planlama/maliyet', (_req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM kenan_planlama_maliyet ORDER BY sira ASC').all()
  res.json(rows)
})

// Maliyet satırını plana ekle
router.post('/planlama/maliyet', (req, res) => {
  const db = getDb()
  const { tip, termin, tutar_eur, grup } = req.body
  // Zaten var mı?
  const existing = db.prepare('SELECT id FROM kenan_planlama_maliyet WHERE tip = ? AND termin = ? AND COALESCE(grup, \'\') = ?').get(tip, termin, grup || '')
  if (existing) return res.status(400).json({ message: 'Bu maliyet zaten planda' })

  const id = randomUUID()
  const sira = calcSiraByDate(db, termin)
  db.prepare('INSERT INTO kenan_planlama_maliyet (id, tip, termin, tutar_eur, sira, grup) VALUES (?, ?, ?, ?, ?, ?)').run(id, tip, termin, tutar_eur || 0, sira, grup || '')
  res.json({ id, sira })
})

// Maliyet sıra güncelle
router.put('/planlama/maliyet/:id/sira', (req, res) => {
  const db = getDb()
  const { sira } = req.body
  db.prepare('UPDATE kenan_planlama_maliyet SET sira = ? WHERE id = ?').run(sira, req.params.id)
  res.json({ success: true })
})

// Maliyet plandan çıkar
router.delete('/planlama/maliyet/:id', (req, res) => {
  const db = getDb()
  db.prepare('DELETE FROM kenan_planlama_maliyet WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
