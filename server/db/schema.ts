import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'data', 'kenan.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initSchema() {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS kenan_odemeler (
      id TEXT PRIMARY KEY,
      tarih TEXT NOT NULL,
      odeme_adi TEXT NOT NULL,
      tl_tutar REAL DEFAULT 0,
      tutar_eur REAL DEFAULT 0,
      kur REAL,
      doviz TEXT DEFAULT 'TL',
      tl_karsiligi REAL,
      durum TEXT DEFAULT 'beklemede',
      donem TEXT,
      notlar TEXT,
      updated_by TEXT,
      updated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kenan_siparisler (
      id TEXT PRIMARY KEY,
      tarih TEXT NOT NULL,
      fatura_no TEXT,
      musteri TEXT NOT NULL,
      siparis_no TEXT,
      tutar REAL NOT NULL,
      kur REAL,
      doviz TEXT DEFAULT 'EUR',
      tutar_eur REAL,
      vade_gun INTEGER,
      durum TEXT DEFAULT 'beklemede',
      notlar TEXT,
      updated_by TEXT,
      updated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kenan_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kenan_login_log (
      id TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      login_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kenan_planlama (
      id TEXT PRIMARY KEY,
      siparis_id TEXT NOT NULL,
      sira REAL DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (siparis_id) REFERENCES kenan_siparisler(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS kenan_plan_markers (
      id TEXT PRIMARY KEY,
      sira REAL DEFAULT 0,
      label TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kenan_planlama_maliyet (
      id TEXT PRIMARY KEY,
      tip TEXT NOT NULL,
      termin TEXT NOT NULL,
      tutar_eur REAL DEFAULT 0,
      sira REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kenan_faturalar (
      id TEXT PRIMARY KEY,
      tarih TEXT NOT NULL,
      fatura_no TEXT,
      musteri TEXT NOT NULL,
      tutar REAL DEFAULT 0,
      doviz TEXT DEFAULT 'EUR',
      kur REAL,
      tutar_eur REAL DEFAULT 0,
      vade_gun INTEGER,
      vade_tarih TEXT,
      durum TEXT DEFAULT 'beklemede',
      notlar TEXT,
      hesap_disi INTEGER DEFAULT 0,
      updated_by TEXT,
      updated_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kenan_audit_log (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      changes TEXT,
      changed_by TEXT,
      changed_at TEXT DEFAULT (datetime('now'))
    );
  `)

  // Migration: add kategori column to odemeler if missing
  const cols = db.prepare("PRAGMA table_info(kenan_odemeler)").all() as any[]
  if (!cols.find((c: any) => c.name === 'kategori')) {
    db.exec("ALTER TABLE kenan_odemeler ADD COLUMN kategori TEXT DEFAULT ''")
  }
  // Migration: add planlamada column to odemeler if missing
  if (!cols.find((c: any) => c.name === 'planlamada')) {
    db.exec("ALTER TABLE kenan_odemeler ADD COLUMN planlamada INTEGER DEFAULT 0")
  }
  // Migration: add doviz column to odemeler if missing
  if (!cols.find((c: any) => c.name === 'doviz')) {
    db.exec("ALTER TABLE kenan_odemeler ADD COLUMN doviz TEXT DEFAULT 'TL'")
  }
  // Migration: add hesap_disi column to odemeler if missing
  if (!cols.find((c: any) => c.name === 'hesap_disi')) {
    db.exec("ALTER TABLE kenan_odemeler ADD COLUMN hesap_disi INTEGER DEFAULT 0")
  }
  // Migration: add hesap_disi column to siparisler if missing
  const sipCols = db.prepare("PRAGMA table_info(kenan_siparisler)").all() as any[]
  if (!sipCols.find((c: any) => c.name === 'hesap_disi')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN hesap_disi INTEGER DEFAULT 0")
  }
  // Migration: add role column to users if missing
  const userCols = db.prepare("PRAGMA table_info(kenan_users)").all() as any[]
  if (!userCols.find((c: any) => c.name === 'role')) {
    db.exec("ALTER TABLE kenan_users ADD COLUMN role TEXT DEFAULT 'user'")
  }
  // Migration: add sira column to planlama if missing
  const planCols = db.prepare("PRAGMA table_info(kenan_planlama)").all() as any[]
  if (planCols.length > 0 && !planCols.find((c: any) => c.name === 'sira')) {
    db.exec("ALTER TABLE kenan_planlama ADD COLUMN sira REAL DEFAULT 0")
  }
  // Migration: add plan_sira column to odemeler if missing
  if (!cols.find((c: any) => c.name === 'plan_sira')) {
    db.exec("ALTER TABLE kenan_odemeler ADD COLUMN plan_sira REAL")
  }
  // Migration: add maliyet columns to siparisler if missing
  if (!sipCols.find((c: any) => c.name === 'maliyet_iplik')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN maliyet_iplik REAL DEFAULT 0")
  }
  if (!sipCols.find((c: any) => c.name === 'maliyet_boya')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN maliyet_boya REAL DEFAULT 0")
  }
  if (!sipCols.find((c: any) => c.name === 'maliyet_navlun')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN maliyet_navlun REAL DEFAULT 0")
  }
  if (!sipCols.find((c: any) => c.name === 'iplik_cinsi')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN iplik_cinsi TEXT DEFAULT ''")
  }
  if (!sipCols.find((c: any) => c.name === 'iplik_miktar')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN iplik_miktar REAL DEFAULT 0")
  }
  if (!sipCols.find((c: any) => c.name === 'iplik_birim_fiyat')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN iplik_birim_fiyat REAL DEFAULT 0")
  }
  if (!sipCols.find((c: any) => c.name === 'boyahane')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN boyahane TEXT DEFAULT ''")
  }
  if (!sipCols.find((c: any) => c.name === 'iplik_termin')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN iplik_termin TEXT DEFAULT ''")
  }
  if (!sipCols.find((c: any) => c.name === 'boya_termin')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN boya_termin TEXT DEFAULT ''")
  }
  if (!sipCols.find((c: any) => c.name === 'iplik_birim_doviz')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN iplik_birim_doviz TEXT DEFAULT 'EUR'")
  }
  if (!sipCols.find((c: any) => c.name === 'iplik_entries')) {
    db.exec("ALTER TABLE kenan_siparisler ADD COLUMN iplik_entries TEXT DEFAULT '[]'")
  }
  // Migration: add grup column to planlama_maliyet if missing (iplik_cinsi veya boyahane)
  const maliyetCols = db.prepare("PRAGMA table_info(kenan_planlama_maliyet)").all() as any[]
  if (maliyetCols.length > 0 && !maliyetCols.find((c: any) => c.name === 'grup')) {
    db.exec("ALTER TABLE kenan_planlama_maliyet ADD COLUMN grup TEXT DEFAULT ''")
  }
  // Migration: add banka column to faturalar if missing
  const fatCols = db.prepare("PRAGMA table_info(kenan_faturalar)").all() as any[]
  if (!fatCols.find((c: any) => c.name === 'banka')) {
    db.exec("ALTER TABLE kenan_faturalar ADD COLUMN banka TEXT DEFAULT ''")
  }
  // Migration: add temlik column to faturalar if missing
  if (!fatCols.find((c: any) => c.name === 'temlik')) {
    db.exec("ALTER TABLE kenan_faturalar ADD COLUMN temlik TEXT DEFAULT 'verilmedi'")
  }
}
