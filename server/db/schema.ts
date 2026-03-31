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

  // Migration: add doviz column to odemeler if missing
  const cols = db.prepare("PRAGMA table_info(kenan_odemeler)").all() as any[]
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
}
