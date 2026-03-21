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
  const users = db.prepare('SELECT id, name, created_at FROM kenan_users ORDER BY name').all()
  res.json(users)
})

// Kayıt ol (şifre ile)
router.post('/users/register', (req, res) => {
  const db = getDb()
  const { name, password } = req.body
  if (!name || !password) return res.status(400).json({ message: 'İsim ve şifre gerekli' })
  if (password.length < 4) return res.status(400).json({ message: 'Şifre en az 4 karakter olmalı' })

  const existing = db.prepare('SELECT id FROM kenan_users WHERE name = ?').get(name) as any
  if (existing) return res.status(400).json({ message: 'Bu kullanıcı adı zaten mevcut' })

  const id = randomUUID()
  const hash = hashPassword(password)
  db.prepare('INSERT INTO kenan_users (id, name, password_hash) VALUES (?, ?, ?)').run(id, name, hash)
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
  res.json({ success: true, user_name })
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
        created_at
      FROM kenan_odemeler
      WHERE 1=1 ${whereClause}
      UNION ALL
      SELECT id, tarih, 'SİPARİŞ' as islem_tipi,
        musteri || COALESCE(' - ' || siparis_no, '') as aciklama,
        COALESCE(fatura_no, '') as referans,
        COALESCE(tutar_eur, tutar) as giren_eur, 0 as cikan_eur, kur, 0 as tl_karsiligi, durum,
        '' as temlikname_no, '' as vade_tarihi, notlar, updated_by, 'siparis' as kaynak,
        created_at
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
      COALESCE(SUM(tutar_eur), 0) as toplam,
      COALESCE(SUM(CASE WHEN durum='tamamlandi' THEN tutar_eur ELSE 0 END), 0) as tamamlanan,
      COALESCE(SUM(CASE WHEN durum='beklemede' THEN tutar_eur ELSE 0 END), 0) as bekleyen
    FROM kenan_odemeler
  `).get()
  res.json(row)
})

router.post('/odemeler', (req, res) => {
  const db = getDb()
  const id = randomUUID()
  const { tarih, odeme_adi, tl_tutar, tutar_eur, kur, durum, donem, notlar, user } = req.body

  // TL girildi → EUR = TL / kur
  let finalEur = tutar_eur || 0
  let finalTl = tl_tutar || 0
  if (tl_tutar && kur && !tutar_eur) {
    finalEur = Math.round((tl_tutar / kur) * 100) / 100
  }
  const tl_karsiligi = finalTl || (kur ? finalEur * kur : 0)
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO kenan_odemeler (id, tarih, odeme_adi, tl_tutar, tutar_eur, kur, tl_karsiligi, durum, donem, notlar, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tarih, odeme_adi, finalTl, finalEur, kur || null, tl_karsiligi || null, durum || 'beklemede', donem || null, notlar || null, user || null, now)

  logAudit('kenan_odemeler', id, 'create', { tarih, odeme_adi, tl_tutar: finalTl, tutar_eur: finalEur, kur, durum }, user || 'system')
  res.json({ id })
})

router.put('/odemeler/:id', (req, res) => {
  const db = getDb()
  const { tarih, odeme_adi, tl_tutar, tutar_eur, kur, durum, donem, notlar, user } = req.body

  // Get old values for audit
  const old = db.prepare('SELECT * FROM kenan_odemeler WHERE id = ?').get(req.params.id) as any
  if (!old) return res.status(404).json({ message: 'Kayıt bulunamadı' })

  let finalEur = tutar_eur || 0
  let finalTl = tl_tutar || 0
  if (tl_tutar && kur && !tutar_eur) {
    finalEur = Math.round((tl_tutar / kur) * 100) / 100
  }
  const tl_karsiligi = finalTl || (kur ? finalEur * kur : 0)
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE kenan_odemeler SET tarih=?, odeme_adi=?, tl_tutar=?, tutar_eur=?, kur=?, tl_karsiligi=?, durum=?, donem=?, notlar=?, updated_by=?, updated_at=?
    WHERE id=?
  `).run(tarih, odeme_adi, finalTl, finalEur, kur || null, tl_karsiligi || null, durum || 'beklemede', donem || null, notlar || null, user || null, now, req.params.id)

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
      COALESCE(SUM(tutar_eur), 0) as toplam,
      COALESCE(SUM(CASE WHEN durum='tamamlandi' THEN tutar_eur ELSE 0 END), 0) as tamamlanan,
      COALESCE(SUM(CASE WHEN durum='beklemede' THEN tutar_eur ELSE 0 END), 0) as bekleyen
    FROM kenan_siparisler
  `).get()
  res.json(row)
})

router.post('/siparisler', (req, res) => {
  const db = getDb()
  const id = randomUUID()
  const { tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, vade_gun, durum, notlar, user } = req.body

  const tutar_eur = tutar // EUR or USD amount directly
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO kenan_siparisler (id, tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, tutar_eur, vade_gun, durum, notlar, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, tarih, fatura_no || null, musteri, siparis_no || null, tutar, kur || null, doviz || 'EUR', tutar_eur, vade_gun || null, durum || 'beklemede', notlar || null, user || null, now)

  logAudit('kenan_siparisler', id, 'create', { tarih, musteri, tutar, doviz, durum }, user || 'system')
  res.json({ id })
})

router.put('/siparisler/:id', (req, res) => {
  const db = getDb()
  const { tarih, fatura_no, musteri, siparis_no, tutar, kur, doviz, tutar_eur, vade_gun, durum, notlar, user } = req.body

  const old = db.prepare('SELECT * FROM kenan_siparisler WHERE id = ?').get(req.params.id) as any
  if (!old) return res.status(404).json({ message: 'Kayıt bulunamadı' })

  const now = new Date().toISOString()

  db.prepare(`
    UPDATE kenan_siparisler SET tarih=?, fatura_no=?, musteri=?, siparis_no=?, tutar=?, kur=?, doviz=?, tutar_eur=?, vade_gun=?, durum=?, notlar=?, updated_by=?, updated_at=?
    WHERE id=?
  `).run(tarih, fatura_no || null, musteri, siparis_no || null, tutar, kur || null, doviz || 'EUR', tutar_eur || tutar, vade_gun || null, durum || 'beklemede', notlar || null, user || null, now, req.params.id)

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

export default router
