import { useEffect, useState, useMemo, useCallback, Fragment } from 'react'
import { api } from '@/lib/api'
import { Plus, Trash2, Edit3, X, Filter, ArrowDownCircle, ArrowUpCircle, RefreshCw, Users, Clock, UserCheck, Search } from 'lucide-react'

const DURUM_OPTIONS = ['beklemede', 'tamamlandi']
const DURUM_LABELS: Record<string, string> = { beklemede: 'Beklemede', tamamlandi: 'Tamamlandı' }
const BASLANGIC_BAKIYE = -1565867.46

function formatEur(val: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' €'
}
function formatTl(val: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' ₺'
}
function formatCurrency(val: number, doviz?: string): string {
  const formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  const symbol = doviz === 'EUR' ? ' €' : doviz === 'USD' ? ' $' : ' ₺'
  return formatted + symbol
}
function formatKur(val: number | null | undefined): string {
  if (!val) return '-'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}
function formatNum(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined) return '-'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val)
}
function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getWeekDateRange(year: number, week: number): string {
  const jan1 = new Date(year, 0, 1)
  const dayOffset = (jan1.getDay() + 6) % 7
  const firstMonday = new Date(year, 0, 1 + (dayOffset === 0 ? -6 : 1 - dayOffset))
  const weekStart = new Date(firstMonday)
  weekStart.setDate(firstMonday.getDate() + (week - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`
  return `${fmt(weekStart)} - ${fmt(weekEnd)}`
}

function groupByWeek<T extends { tarih: string }>(items: T[]): { week: number; year: number; items: T[] }[] {
  const groups: Record<string, { week: number; year: number; items: T[] }> = {}
  for (const item of items) {
    const week = getWeekNumber(item.tarih)
    const year = new Date(item.tarih).getFullYear()
    const key = `${year}-W${week}`
    if (!groups[key]) groups[key] = { week, year, items: [] }
    groups[key].items.push(item)
  }
  return Object.values(groups).sort((a, b) => a.year === b.year ? a.week - b.week : a.year - b.year)
}

function maskedEur(val: number, loggedIn: boolean): string {
  return loggedIn ? formatEur(val) : '****'
}
function maskedTl(val: number, loggedIn: boolean): string {
  return loggedIn ? formatTl(val) : '****'
}
function maskedCurrency(val: number, loggedIn: boolean, doviz?: string): string {
  return loggedIn ? formatCurrency(val, doviz) : '****'
}
function maskedNum(val: string | number, loggedIn: boolean): string {
  return loggedIn ? String(val) : '****'
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-[--color-steel] border border-[--color-graphite] text-sm text-[--color-text-primary] focus:outline-none focus:border-copper"

// ==================== KUR HOOK ====================
function useKur() {
  const [cachedRates, setCachedRates] = useState<Record<string, { eur: number; usd: number }>>({})

  const fetchKur = useCallback(async (date: string) => {
    if (cachedRates[date]) return cachedRates[date]
    try {
      const rates = await api.kenanGetTcmbKur(date)
      setCachedRates(prev => ({ ...prev, [date]: rates }))
      return rates
    } catch {
      return null
    }
  }, [cachedRates])

  return { fetchKur, cachedRates }
}

// ==================== LOGIN PANEL ====================
function LoginPanel({ currentUser, currentRole, onUserChange }: { currentUser: string; currentRole: string; onUserChange: (u: string, role: string) => void }) {
  const [users, setUsers] = useState<any[]>([])
  const [loginLog, setLoginLog] = useState<any[]>([])
  const [mode, setMode] = useState<'idle' | 'login' | 'register' | 'changepass' | 'setpass'>('idle')
  const isAdmin = currentRole === 'admin'
  const [loginName, setLoginName] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [regName, setRegName] = useState('')
  const [regPass, setRegPass] = useState('')
  const [regPassConfirm, setRegPassConfirm] = useState('')
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [setPassName, setSetPassName] = useState('')
  const [setPassVal, setSetPassVal] = useState('')
  const [setPassConfirm, setSetPassConfirm] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    const [u, l] = await Promise.all([api.kenanGetUsers(), api.kenanGetLoginLog()])
    setUsers(u)
    setLoginLog(l)
  }

  useEffect(() => { load() }, [])

  const handleLogin = async () => {
    setError('')
    try {
      const result = await api.kenanLogin(loginName, loginPass)
      const role = result?.role || 'user'
      onUserChange(loginName, role)
      localStorage.setItem('kenan_current_user', loginName)
      localStorage.setItem('kenan_current_role', role)
      setLoginName(''); setLoginPass('')
      setMode('idle')
      load()
    } catch (err: any) {
      if (err.message === 'needs_password') {
        setSetPassName(loginName)
        setLoginName(''); setLoginPass('')
        setMode('setpass')
        setError('')
        return
      }
      setError(err.message || 'Giriş başarısız')
    }
  }

  const handleSetPassword = async () => {
    setError('')
    if (setPassVal !== setPassConfirm) { setError('Şifreler eşleşmiyor'); return }
    if (setPassVal.length < 4) { setError('Şifre en az 4 karakter olmalı'); return }
    try {
      await api.kenanSetPassword(setPassName, setPassVal)
      // Otomatik giriş yap
      const loginResult = await api.kenanLogin(setPassName, setPassVal)
      const loginRole = loginResult?.role || 'user'
      onUserChange(setPassName, loginRole)
      localStorage.setItem('kenan_current_user', setPassName)
      localStorage.setItem('kenan_current_role', loginRole)
      setSetPassName(''); setSetPassVal(''); setSetPassConfirm('')
      setMode('idle')
      load()
    } catch (err: any) {
      setError(err.message || 'Şifre belirleme başarısız')
    }
  }

  const handleRegister = async () => {
    setError('')
    if (regPass !== regPassConfirm) { setError('Şifreler eşleşmiyor'); return }
    try {
      await api.kenanRegister(regName, regPass, currentUser)
      setRegName(''); setRegPass(''); setRegPassConfirm('')
      setMode('idle')
      load()
    } catch (err: any) {
      setError(err.message || 'Kayıt başarısız')
    }
  }

  const handleChangePass = async () => {
    setError('')
    try {
      await api.kenanChangePassword(currentUser, oldPass, newPass)
      setOldPass(''); setNewPass('')
      setMode('idle')
      alert('Şifre başarıyla değiştirildi')
    } catch (err: any) {
      setError(err.message || 'Şifre değiştirme başarısız')
    }
  }

  const handleLogout = () => {
    onUserChange('', '')
    localStorage.removeItem('kenan_current_user')
    localStorage.removeItem('kenan_current_role')
  }

  const smallInput = "px-2 py-1.5 rounded-lg bg-[--color-steel] border border-[--color-graphite] text-sm text-[--color-text-primary] focus:outline-none focus:border-copper"

  return (
    <div className="flex items-start gap-4">
      {/* Last 5 logins */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-3 min-w-[280px]">
        <div className="flex items-center gap-2 text-xs text-[--color-text-muted] mb-2">
          <Clock size={12} /> Son Girişler
        </div>
        {loginLog.length === 0 ? (
          <div className="text-xs text-[--color-text-muted]">Henüz giriş yok</div>
        ) : (
          <div className="space-y-1">
            {loginLog.map((l: any, i: number) => (
              <div key={l.id} className="flex items-center justify-between text-xs">
                <span className={`font-medium ${i === 0 ? 'text-emerald-400' : 'text-[--color-text-secondary]'}`}>
                  {i === 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />}
                  {l.user_name}
                </span>
                <span className="text-[--color-text-muted] font-mono text-[10px]">
                  {new Date(l.login_at + 'Z').toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auth area */}
      <div className="flex flex-col gap-2">
        {currentUser ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/30 rounded-lg px-3 py-2">
              <UserCheck size={14} className="text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">{currentUser}</span>
            </div>
            <button onClick={() => setMode(mode === 'changepass' ? 'idle' : 'changepass')}
              className="px-3 py-2 rounded-lg border border-[--color-graphite] text-[--color-text-muted] text-xs hover:bg-[--color-steel]">
              Şifre Değiştir
            </button>
            {isAdmin && (
              <button onClick={() => { setMode(mode === 'register' ? 'idle' : 'register'); setError('') }}
                className="px-3 py-2 rounded-lg border border-emerald-400/30 text-emerald-400 text-xs hover:bg-emerald-400/10">
                <Users size={12} className="inline mr-1" />Kullanıcı Ekle
              </button>
            )}
            <button onClick={handleLogout}
              className="px-3 py-2 rounded-lg border border-red-400/30 text-red-400 text-xs hover:bg-red-400/10">
              Çıkış
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-400">Giriş yapılmadı</span>
            <button onClick={() => { setMode('login'); setError('') }}
              className="px-3 py-2 rounded-lg bg-copper text-white text-xs font-medium hover:bg-copper-dark">
              Giriş Yap
            </button>
          </div>
        )}

        {/* Login form */}
        {mode === 'login' && !currentUser && (
          <div className="flex items-center gap-2 bg-[--color-slate] border border-[--color-graphite] rounded-lg p-2">
            <select value={loginName} onChange={e => setLoginName(e.target.value)} className={`${smallInput} w-36`}>
              <option value="">Kullanıcı...</option>
              {users.map((u: any) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Şifre"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} className={`${smallInput} w-28`} />
            <button onClick={handleLogin} className="px-3 py-1.5 rounded-lg bg-copper text-white text-xs font-medium">Giriş</button>
            <button onClick={() => setMode('idle')} className="text-[--color-text-muted]"><X size={14} /></button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        )}

        {/* Register form + user list (admin only) */}
        {mode === 'register' && isAdmin && (
          <div className="bg-[--color-slate] border border-[--color-graphite] rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2">
              <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Kullanıcı adı" className={`${smallInput} w-32`} />
              <input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="Şifre" className={`${smallInput} w-24`} />
              <input type="password" value={regPassConfirm} onChange={e => setRegPassConfirm(e.target.value)} placeholder="Tekrar"
                onKeyDown={e => e.key === 'Enter' && handleRegister()} className={`${smallInput} w-24`} />
              <button onClick={handleRegister} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium">Ekle</button>
              <button onClick={() => setMode('idle')} className="text-[--color-text-muted]"><X size={14} /></button>
            </div>
            {error && <span className="text-xs text-red-400">{error}</span>}
            <div className="border-t border-[--color-graphite] pt-2">
              <div className="text-[10px] text-[--color-text-muted] mb-1">Mevcut Kullanıcılar</div>
              <div className="space-y-1">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between text-xs bg-[--color-steel] rounded px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[--color-text-primary] font-medium">{u.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-copper/10 text-copper' : 'bg-info/10 text-info'}`}>
                        {u.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                      </span>
                    </div>
                    {u.name !== currentUser && (
                      <button onClick={async () => {
                        if (!confirm(`"${u.name}" kullanıcısını silmek istediğinize emin misiniz?`)) return
                        try {
                          await api.kenanDeleteUser(u.name, currentUser)
                          load()
                        } catch (err: any) { setError(err.message) }
                      }} className="text-red-400 hover:text-red-300">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Set password form (eski şifresiz kullanıcılar) */}
        {mode === 'setpass' && (
          <div className="flex items-center gap-2 bg-[--color-slate] border border-amber-400/30 rounded-lg p-2">
            <span className="text-xs text-amber-400 font-medium">{setPassName} - İlk şifrenizi belirleyin:</span>
            <input type="password" value={setPassVal} onChange={e => setSetPassVal(e.target.value)} placeholder="Yeni şifre" className={`${smallInput} w-28`} />
            <input type="password" value={setPassConfirm} onChange={e => setSetPassConfirm(e.target.value)} placeholder="Tekrar"
              onKeyDown={e => e.key === 'Enter' && handleSetPassword()} className={`${smallInput} w-28`} />
            <button onClick={handleSetPassword} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium">Belirle</button>
            <button onClick={() => { setMode('idle'); setSetPassName('') }} className="text-[--color-text-muted]"><X size={14} /></button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        )}

        {/* Change password form */}
        {mode === 'changepass' && currentUser && (
          <div className="flex items-center gap-2 bg-[--color-slate] border border-[--color-graphite] rounded-lg p-2">
            <input type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} placeholder="Mevcut şifre" className={`${smallInput} w-28`} />
            <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Yeni şifre"
              onKeyDown={e => e.key === 'Enter' && handleChangePass()} className={`${smallInput} w-28`} />
            <button onClick={handleChangePass} className="px-3 py-1.5 rounded-lg bg-copper text-white text-xs font-medium">Değiştir</button>
            <button onClick={() => setMode('idle')} className="text-[--color-text-muted]"><X size={14} /></button>
            {error && <span className="text-xs text-red-400">{error}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ==================== CARİ HESAP (birleşik görünüm) ====================

interface CariEntry {
  id: string; tarih: string; islem_tipi: string; referans: string; aciklama: string;
  giren_eur: number; cikan_eur: number; kur: number; tl_karsiligi: number;
  durum: string; updated_by: string; kaynak: string;
}

function CariSection({ currentUser }: { currentUser: string }) {
  const loggedIn = !!currentUser
  const [entries, setEntries] = useState<CariEntry[]>([])
  const [filters, setFilters] = useState({ start: '', end: '' })
  const [showFilters, setShowFilters] = useState(false)

  const load = async () => {
    const params: Record<string, string> = {}
    if (filters.start) params.start = filters.start
    if (filters.end) params.end = filters.end
    const data = await api.kenanGetCari(params)
    setEntries(data)
  }

  useEffect(() => { load() }, [filters])

  const summary = useMemo(() => {
    const tamamlananlar = entries.filter(e => e.durum === 'tamamlandi')
    const toplam_giren = tamamlananlar.reduce((s, e) => s + (e.giren_eur || 0), 0)
    const toplam_cikan = tamamlananlar.reduce((s, e) => s + (e.cikan_eur || 0), 0)
    const net = BASLANGIC_BAKIYE + toplam_giren - toplam_cikan
    return { toplam_giren, toplam_cikan, net }
  }, [entries])

  const runningBalances = useMemo(() => {
    let bal = BASLANGIC_BAKIYE
    return entries.map(e => {
      if (e.durum === 'tamamlandi') {
        bal += (e.giren_eur || 0) - (e.cikan_eur || 0)
      }
      return bal
    })
  }, [entries])

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Devir Bakiye (2025)</div>
          <div className="text-lg font-bold text-red-400 font-mono">{maskedEur(Math.abs(BASLANGIC_BAKIYE), loggedIn)}</div>
          <div className="text-xs text-red-400/70 mt-1">Kayteks borçlu</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-[--color-text-muted] mb-1"><ArrowDownCircle size={14} className="text-emerald-400" /> Toplam Giren (Sipariş)</div>
          <div className="text-lg font-bold text-emerald-400 font-mono">{maskedEur(summary.toplam_giren, loggedIn)}</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs text-[--color-text-muted] mb-1"><ArrowUpCircle size={14} className="text-copper" /> Toplam Çıkan (Ödeme)</div>
          <div className="text-lg font-bold text-copper font-mono">{maskedEur(summary.toplam_cikan, loggedIn)}</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Net Bakiye</div>
          <div className={`text-lg font-bold font-mono ${summary.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{maskedEur(Math.abs(summary.net), loggedIn)}</div>
          <div className={`text-xs mt-1 ${summary.net >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>{summary.net < 0 ? 'Kayteks borçlu' : 'Kenan borçlu'}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-[--color-text-muted] bg-[--color-steel] px-3 py-2 rounded-lg">Veriler Sipariş & Ödeme sekmesinden otomatik gelir</div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${showFilters ? 'border-copper text-copper' : 'border-[--color-graphite] text-[--color-text-secondary] hover:bg-[--color-steel]'}`}>
          <Filter size={14} /> Filtrele
        </button>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[--color-graphite] text-[--color-text-secondary] hover:bg-[--color-steel] text-sm"><RefreshCw size={14} /></button>
      </div>

      {showFilters && (
        <div className="flex items-center gap-3 bg-[--color-slate] border border-[--color-graphite] rounded-xl p-3">
          <input type="date" value={filters.start} onChange={e => setFilters(p => ({ ...p, start: e.target.value }))} className="px-3 py-1.5 rounded-lg bg-[--color-steel] border border-[--color-graphite] text-sm text-[--color-text-primary]" />
          <span className="text-[--color-text-muted] text-sm">—</span>
          <input type="date" value={filters.end} onChange={e => setFilters(p => ({ ...p, end: e.target.value }))} className="px-3 py-1.5 rounded-lg bg-[--color-steel] border border-[--color-graphite] text-sm text-[--color-text-primary]" />
          <button onClick={() => setFilters({ start: '', end: '' })} className="text-xs text-copper hover:underline">Temizle</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[--color-graphite]">
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Tarih</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Kaynak</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Açıklama</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Referans</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-emerald-400 uppercase">Giren €</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-copper uppercase">Çıkan €</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Kur</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Bakiye €</th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Durum</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-[--color-text-muted] uppercase">Son Değişiklik</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[--color-graphite]/50 bg-[--color-steel]/30">
                <td className="px-3 py-2 text-sm text-[--color-text-primary]">24/03/2026</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">DEVİR</span></td>
                <td className="px-3 py-2 text-sm font-medium text-[--color-text-primary]" colSpan={2}>Devir Bakiyesi (2025)</td>
                <td className="px-3 py-2 text-right text-sm text-[--color-text-muted]">-</td>
                <td className="px-3 py-2 text-right text-sm text-[--color-text-muted]">-</td>
                <td className="px-3 py-2 text-right text-sm text-[--color-text-muted]">-</td>
                <td className="px-3 py-2 text-right text-sm font-mono font-semibold text-red-400">{maskedEur(Math.abs(BASLANGIC_BAKIYE), loggedIn)}</td>
                <td className="px-3 py-2 text-center"><span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">Borç</span></td>
                <td></td>
              </tr>
              {entries.map((e, idx) => (
                <tr key={`${e.kaynak}-${e.id}`} className={`border-b border-[--color-graphite]/50 hover:bg-[--color-steel]/50 transition-colors ${e.durum === 'beklemede' ? 'opacity-50 italic' : ''}`}>
                  <td className="px-3 py-2 text-sm text-[--color-text-primary]">{formatDate(e.tarih)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.kaynak === 'siparis' ? 'bg-info/10 text-info' : 'bg-copper/10 text-copper'}`}>
                      {e.islem_tipi}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm text-[--color-text-secondary] max-w-[250px] truncate">{e.aciklama || '-'}</td>
                  <td className="px-3 py-2 text-sm text-[--color-text-secondary]">{e.referans || '-'}</td>
                  <td className="px-3 py-2 text-right text-sm font-mono text-emerald-400">{e.giren_eur > 0 ? maskedEur(e.giren_eur, loggedIn) : '-'}</td>
                  <td className="px-3 py-2 text-right text-sm font-mono text-copper">{e.cikan_eur > 0 ? maskedEur(e.cikan_eur, loggedIn) : '-'}</td>
                  <td className="px-3 py-2 text-right text-sm font-mono text-[--color-text-muted]">{loggedIn ? formatKur(e.kur) : '****'}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={`text-sm font-mono font-semibold ${runningBalances[idx] >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {maskedEur(Math.abs(runningBalances[idx]), loggedIn)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.durum === 'tamamlandi' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                      {DURUM_LABELS[e.durum] || e.durum}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-[10px] text-[--color-text-muted]">{e.updated_by || '-'}</td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-[--color-text-muted]">Henüz kayıt yok. Sipariş & Ödeme sekmesinden veri girin.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-[--color-graphite] text-xs text-[--color-text-muted]">Toplam {entries.length} kayıt</div>
      </div>
    </div>
  )
}

// ==================== SİPARİŞ & ÖDEME TAKİP ====================

interface Odeme {
  id: string; tarih: string; odeme_adi: string; tl_tutar: number; tutar_eur: number; kur: number;
  tl_karsiligi: number; doviz: string; durum: string; donem: string; notlar: string; updated_by: string;
  hesap_disi: number;
}

interface Siparis {
  id: string; tarih: string; fatura_no: string; musteri: string; siparis_no: string;
  tutar: number; kur: number; doviz: string; tutar_eur: number; vade_gun: number;
  durum: string; notlar: string; updated_by: string;
  hesap_disi: number;
}

// ==================== MODAL COMPONENT ====================
function Modal({ open, onClose, title, children, color = 'copper' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; color?: string }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-[--color-midnight] border border-[--color-graphite] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className={`flex items-center justify-between px-5 py-4 border-b border-[--color-graphite]`}>
          <h3 className={`text-base font-semibold ${color === 'info' ? 'text-info' : 'text-copper'}`}>{title}</h3>
          <button onClick={onClose} className="text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors"><X size={18} /></button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

function SiparisOdemeSection({ currentUser }: { currentUser: string }) {
  const loggedIn = !!currentUser
  const [odemeler, setOdemeler] = useState<Odeme[]>([])
  const [siparisler, setSiparisler] = useState<Siparis[]>([])
  const [showOdemeForm, setShowOdemeForm] = useState(false)
  const [showSiparisForm, setShowSiparisForm] = useState(false)
  const [editOdemeId, setEditOdemeId] = useState<string | null>(null)
  const [editSiparisId, setEditSiparisId] = useState<string | null>(null)
  const [odemeSearch, setOdemeSearch] = useState('')
  const [siparisSearch, setSiparisSearch] = useState('')
  const { fetchKur } = useKur()

  const [odemeForm, setOdemeForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), odeme_adi: '', tl_tutar: '', tutar_eur: '', kur: '', doviz: 'TL', durum: 'beklemede', donem: '', notlar: ''
  })
  const [siparisForm, setSiparisForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), fatura_no: '', musteri: '', siparis_no: '', tutar: '', kur: '', doviz: 'EUR', vade_gun: '', durum: 'beklemede', notlar: ''
  })

  const loadAll = async () => {
    const [o, s] = await Promise.all([api.kenanGetOdemeler(), api.kenanGetSiparisler()])
    setOdemeler(o)
    setSiparisler(s)
  }

  useEffect(() => { loadAll() }, [])

  // Auto-fetch kur when date or doviz changes in ödeme form
  const fetchOdemeKur = async (date: string, doviz?: string) => {
    const d = doviz || odemeForm.doviz || 'TL'
    if (d === 'EUR') {
      setOdemeForm(p => ({ ...p, kur: '1' }))
      return
    }
    const rates = await fetchKur(date)
    if (rates) {
      if (d === 'USD') {
        // EUR/USD = EUR_TL / USD_TL
        const eurUsd = Math.round((rates.eur / rates.usd) * 10000) / 10000
        setOdemeForm(p => ({ ...p, kur: String(eurUsd) }))
      } else {
        // EUR/TL
        setOdemeForm(p => ({ ...p, kur: String(rates.eur) }))
      }
    }
  }

  const fetchSiparisKur = async (date: string) => {
    const rates = await fetchKur(date)
    if (rates) {
      setSiparisForm(p => ({ ...p, kur: String(p.doviz === 'USD' ? rates.usd : rates.eur) }))
    }
  }

  // Compute EUR based on currency type
  const computedEur = useMemo(() => {
    const tutar = parseFloat(odemeForm.tl_tutar) || 0
    const kur = parseFloat(odemeForm.kur) || 0
    if (tutar <= 0) return 0
    const d = odemeForm.doviz || 'TL'
    if (d === 'EUR') return tutar
    if (kur <= 0) return 0
    return Math.round((tutar / kur) * 100) / 100
  }, [odemeForm.tl_tutar, odemeForm.kur, odemeForm.doviz])

  const odemeSummary = useMemo(() => {
    const aktif = odemeler.filter(o => !o.hesap_disi)
    const toplam = aktif.reduce((s, o) => s + o.tutar_eur, 0)
    const tamamlanan = aktif.filter(o => o.durum === 'tamamlandi').reduce((s, o) => s + o.tutar_eur, 0)
    return { toplam, tamamlanan, kalan: toplam - tamamlanan }
  }, [odemeler])

  const siparisSummary = useMemo(() => {
    const aktif = siparisler.filter(o => !o.hesap_disi)
    const toplam = aktif.reduce((s, o) => s + (o.tutar_eur || o.tutar), 0)
    const tamamlanan = aktif.filter(o => o.durum === 'tamamlandi').reduce((s, o) => s + (o.tutar_eur || o.tutar), 0)
    return { toplam, tamamlanan, kalan: toplam - tamamlanan }
  }, [siparisler])

  const dinamikBakiye = BASLANGIC_BAKIYE + siparisSummary.toplam - odemeSummary.toplam

  // Filtered data for search
  const filteredOdemeler = useMemo(() => {
    if (!odemeSearch.trim()) return odemeler
    const q = odemeSearch.toLowerCase()
    return odemeler.filter(o =>
      o.odeme_adi?.toLowerCase().includes(q) ||
      o.tarih?.includes(q) ||
      String(o.tl_tutar).includes(q) ||
      String(o.tutar_eur).includes(q) ||
      o.notlar?.toLowerCase().includes(q)
    )
  }, [odemeler, odemeSearch])

  const filteredSiparisler = useMemo(() => {
    if (!siparisSearch.trim()) return siparisler
    const q = siparisSearch.toLowerCase()
    return siparisler.filter(s =>
      s.musteri?.toLowerCase().includes(q) ||
      s.tarih?.includes(q) ||
      s.siparis_no?.toLowerCase().includes(q) ||
      s.fatura_no?.toLowerCase().includes(q) ||
      String(s.tutar).includes(q) ||
      s.notlar?.toLowerCase().includes(q)
    )
  }, [siparisler, siparisSearch])

  // Unified weeks: her iki tabloyu hizalamak için
  const unifiedWeeks = useMemo(() => {
    const odemeGroups = groupByWeek(filteredOdemeler)
    const siparisGroups = groupByWeek(filteredSiparisler)
    const odemeMap = new Map(odemeGroups.map(g => [`${g.year}-${g.week}`, g.items]))
    const siparisMap = new Map(siparisGroups.map(g => [`${g.year}-${g.week}`, g.items]))
    const allKeys = new Set<string>()
    odemeGroups.forEach(g => allKeys.add(`${g.year}-${g.week}`))
    siparisGroups.forEach(g => allKeys.add(`${g.year}-${g.week}`))
    return Array.from(allKeys)
      .sort((a, b) => {
        const [ay, aw] = a.split('-').map(Number)
        const [by, bw] = b.split('-').map(Number)
        return ay === by ? aw - bw : ay - by
      })
      .map(key => {
        const [year, week] = key.split('-').map(Number)
        const oi = odemeMap.get(key) || []
        const si = siparisMap.get(key) || []
        return { year, week, key, odemeItems: oi as Odeme[], siparisItems: si as Siparis[], maxRows: Math.max(oi.length, si.length, 1) }
      })
  }, [filteredOdemeler, filteredSiparisler])

  // Ödeme handlers
  const resetOdemeForm = () => {
    setOdemeForm({ tarih: new Date().toISOString().slice(0, 10), odeme_adi: '', tl_tutar: '', tutar_eur: '', kur: '', doviz: 'TL', durum: 'beklemede', donem: '', notlar: '' })
    setEditOdemeId(null)
    setShowOdemeForm(false)
  }

  const handleOdemeSubmit = async () => {
    const data = {
      ...odemeForm,
      tl_tutar: parseFloat(odemeForm.tl_tutar) || 0,
      tutar_eur: computedEur || parseFloat(odemeForm.tutar_eur) || 0,
      kur: odemeForm.doviz === 'EUR' ? 1 : (parseFloat(odemeForm.kur) || null),
      user: currentUser,
    }
    if (editOdemeId) await api.kenanUpdateOdeme(editOdemeId, data)
    else await api.kenanCreateOdeme(data)
    resetOdemeForm()
    loadAll()
  }

  const startEditOdeme = (o: Odeme) => {
    const doviz = (o as any).doviz || 'TL'
    setOdemeForm({
      tarih: o.tarih, odeme_adi: o.odeme_adi,
      tl_tutar: o.tl_tutar ? String(o.tl_tutar) : '',
      tutar_eur: o.tutar_eur ? String(o.tutar_eur) : '',
      kur: o.kur ? String(o.kur) : '',
      doviz,
      durum: o.durum, donem: o.donem || '', notlar: o.notlar || ''
    })
    setEditOdemeId(o.id)
    setShowOdemeForm(true)
    // Refresh kur for the saved currency
    fetchOdemeKur(o.tarih, doviz)
  }

  // Sipariş handlers
  const resetSiparisForm = () => {
    setSiparisForm({ tarih: new Date().toISOString().slice(0, 10), fatura_no: '', musteri: '', siparis_no: '', tutar: '', kur: '', doviz: 'EUR', vade_gun: '', durum: 'beklemede', notlar: '' })
    setEditSiparisId(null)
    setShowSiparisForm(false)
  }

  const handleSiparisSubmit = async () => {
    const data = {
      ...siparisForm,
      tutar: parseFloat(siparisForm.tutar) || 0,
      kur: parseFloat(siparisForm.kur) || null,
      vade_gun: parseInt(siparisForm.vade_gun) || null,
      user: currentUser,
    }
    if (editSiparisId) await api.kenanUpdateSiparis(editSiparisId, data)
    else await api.kenanCreateSiparis(data)
    resetSiparisForm()
    loadAll()
  }

  const startEditSiparis = (s: Siparis) => {
    setSiparisForm({
      tarih: s.tarih, fatura_no: s.fatura_no || '', musteri: s.musteri, siparis_no: s.siparis_no || '',
      tutar: String(s.tutar), kur: s.kur ? String(s.kur) : '', doviz: s.doviz || 'EUR',
      vade_gun: s.vade_gun ? String(s.vade_gun) : '', durum: s.durum, notlar: s.notlar || ''
    })
    setEditSiparisId(s.id)
    setShowSiparisForm(true)
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Sipariş Toplamı</div>
          <div className="text-lg font-bold text-info font-mono">{maskedEur(siparisSummary.toplam, loggedIn)}</div>
          <div className="text-xs text-[--color-text-muted] mt-1">Kalan: {maskedEur(siparisSummary.kalan, loggedIn)}</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Ödeme Toplamı</div>
          <div className="text-lg font-bold text-copper font-mono">{maskedEur(odemeSummary.toplam, loggedIn)}</div>
          <div className="text-xs text-[--color-text-muted] mt-1">Kalan: {maskedEur(odemeSummary.kalan, loggedIn)}</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Tamamlanan</div>
          <div className="text-sm font-mono text-emerald-400">Sipariş: {maskedEur(siparisSummary.tamamlanan, loggedIn)}</div>
          <div className="text-sm font-mono text-emerald-400 mt-1">Ödeme: {maskedEur(odemeSummary.tamamlanan, loggedIn)}</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Dinamik Bakiye</div>
          <div className={`text-lg font-bold font-mono ${dinamikBakiye >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{maskedEur(Math.abs(dinamikBakiye), loggedIn)}</div>
          <div className="text-xs text-[--color-text-muted] mt-1">Bakiye + Siparişler - Ödemeler</div>
        </div>
      </div>

      {/* Modals */}
      <Modal open={showOdemeForm} onClose={resetOdemeForm} title={editOdemeId ? 'Ödeme Düzenle' : 'Yeni Ödeme Ekle'} color="copper">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tarih</label>
              <input type="date" value={odemeForm.tarih} onChange={e => { setOdemeForm(p => ({ ...p, tarih: e.target.value })); fetchOdemeKur(e.target.value, odemeForm.doviz) }} className={inputCls} />
              {odemeForm.tarih && <div className="mt-1 text-[10px] font-medium text-copper bg-copper/10 px-2 py-0.5 rounded w-fit">Hafta {getWeekNumber(odemeForm.tarih)}</div>}
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Ödeme Adı</label>
              <input value={odemeForm.odeme_adi} onChange={e => setOdemeForm(p => ({ ...p, odeme_adi: e.target.value }))} placeholder="Firma/Kişi" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tutar ({odemeForm.doviz === 'EUR' ? '€' : odemeForm.doviz === 'USD' ? '$' : '₺'})</label>
              <input type="number" step="0.01" value={odemeForm.tl_tutar} onChange={e => setOdemeForm(p => ({ ...p, tl_tutar: e.target.value, tutar_eur: '' }))} placeholder="Tutar girin" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Para Birimi</label>
              <select value={odemeForm.doviz} onChange={e => { const d = e.target.value; setOdemeForm(p => ({ ...p, doviz: d })); fetchOdemeKur(odemeForm.tarih, d) }} className={inputCls}>
                <option value="TL">₺ TL</option>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">
                {odemeForm.doviz === 'EUR' ? 'Kur' : odemeForm.doviz === 'USD' ? 'Kur (1€ = ?$)' : 'Kur (1€ = ?₺)'} {odemeForm.doviz !== 'EUR' && <span className="text-copper">TCMB</span>}
              </label>
              <input type="number" step="0.0001" value={odemeForm.kur} onChange={e => setOdemeForm(p => ({ ...p, kur: e.target.value }))} placeholder={odemeForm.doviz === 'EUR' ? '1' : 'Otomatik'} disabled={odemeForm.doviz === 'EUR'} className={`${inputCls} ${odemeForm.doviz === 'EUR' ? 'opacity-50' : ''}`} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">EUR Karşılığı</label>
              <div className="px-3 py-2 rounded-lg bg-[--color-steel]/50 border border-[--color-graphite] text-sm font-mono text-emerald-400">
                {computedEur > 0 ? maskedEur(computedEur, loggedIn) : (odemeForm.tutar_eur ? maskedEur(parseFloat(odemeForm.tutar_eur), loggedIn) : '—')}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Dönem</label>
              <input value={odemeForm.donem} onChange={e => setOdemeForm(p => ({ ...p, donem: e.target.value }))} placeholder="Mart 2026" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Durum</label>
              <select value={odemeForm.durum} onChange={e => setOdemeForm(p => ({ ...p, durum: e.target.value }))} className={inputCls}>
                {DURUM_OPTIONS.map(d => <option key={d} value={d}>{DURUM_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Notlar</label>
              <input value={odemeForm.notlar} onChange={e => setOdemeForm(p => ({ ...p, notlar: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-[--color-graphite]">
            <button onClick={handleOdemeSubmit} disabled={!currentUser} className="px-5 py-2 rounded-lg bg-copper text-white text-sm font-medium hover:bg-copper-dark disabled:opacity-50">{editOdemeId ? 'Güncelle' : 'Ekle'}</button>
            <button onClick={resetOdemeForm} className="px-5 py-2 rounded-lg border border-[--color-graphite] text-[--color-text-muted] text-sm hover:bg-[--color-steel]">İptal</button>
            {!currentUser && <span className="text-xs text-red-400 self-center">Önce kullanıcı seçin</span>}
          </div>
        </div>
      </Modal>

      <Modal open={showSiparisForm} onClose={resetSiparisForm} title={editSiparisId ? 'Sipariş Düzenle' : 'Yeni Sipariş Ekle'} color="info">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tarih</label>
              <input type="date" value={siparisForm.tarih} onChange={e => { setSiparisForm(p => ({ ...p, tarih: e.target.value })); fetchSiparisKur(e.target.value) }} className={inputCls} />
              {siparisForm.tarih && <div className="mt-1 text-[10px] font-medium text-info bg-info/10 px-2 py-0.5 rounded w-fit">Hafta {getWeekNumber(siparisForm.tarih)}</div>}
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Müşteri</label>
              <input value={siparisForm.musteri} onChange={e => setSiparisForm(p => ({ ...p, musteri: e.target.value }))} placeholder="Müşteri adı" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Fatura No</label>
              <input value={siparisForm.fatura_no} onChange={e => setSiparisForm(p => ({ ...p, fatura_no: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Sipariş No</label>
              <input value={siparisForm.siparis_no} onChange={e => setSiparisForm(p => ({ ...p, siparis_no: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Döviz</label>
              <select value={siparisForm.doviz} onChange={e => { setSiparisForm(p => ({ ...p, doviz: e.target.value })); fetchSiparisKur(siparisForm.tarih) }} className={inputCls}>
                <option value="EUR">EUR</option><option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tutar ({siparisForm.doviz})</label>
              <input type="number" step="0.01" value={siparisForm.tutar} onChange={e => setSiparisForm(p => ({ ...p, tutar: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Kur <span className="text-copper">TCMB</span></label>
              <input type="number" step="0.0001" value={siparisForm.kur} onChange={e => setSiparisForm(p => ({ ...p, kur: e.target.value }))} placeholder="Otomatik" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Vade (gün)</label>
              <input type="number" value={siparisForm.vade_gun} onChange={e => setSiparisForm(p => ({ ...p, vade_gun: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Durum</label>
              <select value={siparisForm.durum} onChange={e => setSiparisForm(p => ({ ...p, durum: e.target.value }))} className={inputCls}>
                {DURUM_OPTIONS.map(d => <option key={d} value={d}>{DURUM_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Notlar</label>
              <input value={siparisForm.notlar} onChange={e => setSiparisForm(p => ({ ...p, notlar: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-[--color-graphite]">
            <button onClick={handleSiparisSubmit} disabled={!currentUser} className="px-5 py-2 rounded-lg bg-info text-white text-sm font-medium hover:bg-info/80 disabled:opacity-50">{editSiparisId ? 'Güncelle' : 'Ekle'}</button>
            <button onClick={resetSiparisForm} className="px-5 py-2 rounded-lg border border-[--color-graphite] text-[--color-text-muted] text-sm hover:bg-[--color-steel]">İptal</button>
            {!currentUser && <span className="text-xs text-red-400 self-center">Önce kullanıcı seçin</span>}
          </div>
        </div>
      </Modal>

      {/* Unified aligned panels */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl overflow-hidden">
        {/* Panel headers */}
        <div className="grid grid-cols-2">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-graphite] border-r border-r-[--color-graphite]">
            <h3 className="text-sm font-semibold text-copper">ÖDEMELER (TL → EUR)</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
                <input
                  value={odemeSearch}
                  onChange={e => setOdemeSearch(e.target.value)}
                  placeholder="Ara..."
                  className="pl-7 pr-2 py-1 text-xs rounded-lg bg-[--color-midnight] border border-[--color-graphite] text-[--color-text-primary] placeholder:text-[--color-text-muted]/50 w-36 focus:outline-none focus:border-copper"
                />
                {odemeSearch && <button onClick={() => setOdemeSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]"><X size={10} /></button>}
              </div>
              <button onClick={() => { resetOdemeForm(); setShowOdemeForm(true); fetchOdemeKur(new Date().toISOString().slice(0, 10), 'TL') }}
                disabled={!currentUser}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-copper text-white text-xs font-medium hover:bg-copper-dark disabled:opacity-50">
                <Plus size={12} /> Ekle
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-graphite]">
            <h3 className="text-sm font-semibold text-info">SİPARİŞLER</h3>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
                <input
                  value={siparisSearch}
                  onChange={e => setSiparisSearch(e.target.value)}
                  placeholder="Ara..."
                  className="pl-7 pr-2 py-1 text-xs rounded-lg bg-[--color-midnight] border border-[--color-graphite] text-[--color-text-primary] placeholder:text-[--color-text-muted]/50 w-36 focus:outline-none focus:border-info"
                />
                {siparisSearch && <button onClick={() => setSiparisSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]"><X size={10} /></button>}
              </div>
              <button onClick={() => { resetSiparisForm(); setShowSiparisForm(true); fetchSiparisKur(new Date().toISOString().slice(0, 10)) }}
                disabled={!currentUser}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-info text-white text-xs font-medium hover:bg-info/80 disabled:opacity-50">
                <Plus size={12} /> Ekle
              </button>
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 border-b border-[--color-graphite]">
          <div className="grid grid-cols-[24px_85px_minmax(0,1fr)_120px_50px_120px_60px_50px_28px] border-r border-[--color-graphite] px-1">
            <div className="py-2 text-[9px] text-[--color-text-muted] text-center" title="Hesap Dışı">HD</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Tarih</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Ödeme Adı</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">TL</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Kur</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">EUR</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Durum</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Kişi</div>
            <div></div>
          </div>
          <div className="grid grid-cols-[24px_85px_minmax(0,1fr)_90px_90px_110px_40px_55px_45px_28px] px-1">
            <div className="py-2 text-[9px] text-[--color-text-muted] text-center" title="Hesap Dışı">HD</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Tarih</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Müşteri</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Fatura No</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Sipariş No</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Tutar</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Vade</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Durum</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Kişi</div>
            <div></div>
          </div>
        </div>

        {/* Unified data rows */}
        {unifiedWeeks.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[--color-text-muted]">Henüz kayıt yok</div>
        ) : (
          unifiedWeeks.map(uw => (
            <Fragment key={`uw-${uw.key}`}>
              {/* Week header row - perfectly aligned */}
              {(() => {
                const haftaOdeme = uw.odemeItems.filter(o => !o.hesap_disi).reduce((s, o) => s + o.tutar_eur, 0)
                const haftaSiparis = uw.siparisItems.filter(o => !o.hesap_disi).reduce((s, o) => s + (o.tutar_eur || o.tutar), 0)
                const denge = haftaSiparis - haftaOdeme
                return (
              <div className="grid grid-cols-2 border-b border-[--color-graphite]/50">
                <div className="px-3 py-1.5 bg-copper/5 border-r border-[--color-graphite]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-copper bg-copper/10 px-2 py-0.5 rounded">H{uw.week}</span>
                    <span className="text-[10px] text-[--color-text-muted]">{getWeekDateRange(uw.year, uw.week)}</span>
                    {uw.odemeItems.length > 0 && <span className="text-[10px] text-copper/60">{uw.odemeItems.length} ödeme · {maskedEur(haftaOdeme, loggedIn)}</span>}
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-info/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-info bg-info/10 px-2 py-0.5 rounded">H{uw.week}</span>
                      <span className="text-[10px] text-[--color-text-muted]">{getWeekDateRange(uw.year, uw.week)}</span>
                      {uw.siparisItems.length > 0 && <span className="text-[10px] text-info/60">{uw.siparisItems.length} sipariş · {maskedEur(haftaSiparis, loggedIn)}</span>}
                    </div>
                    {(uw.odemeItems.length > 0 || uw.siparisItems.length > 0) && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${denge >= 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                        Denge: {loggedIn ? `${denge >= 0 ? '+' : ''}${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(denge)} €` : '****'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
                )
              })()}

              {/* Data rows - each row is a single grid spanning both sides for perfect alignment */}
              {Array.from({ length: uw.maxRows }).map((_, i) => {
                const o = uw.odemeItems[i]
                const s = uw.siparisItems[i]
                return (
                  <div key={`row-${uw.key}-${i}`} className={`grid grid-cols-2 border-b border-[--color-graphite]/50 ${(o || s) ? 'hover:bg-[--color-steel]/30' : ''}`}>
                    {/* Ödeme side */}
                    <div className={`border-r border-[--color-graphite]/30 ${o ? `grid grid-cols-[24px_85px_minmax(0,1fr)_120px_50px_120px_60px_50px_28px] px-1 h-9 overflow-hidden ${o.hesap_disi ? 'opacity-40' : ''}` : ''}`}>
                      {o ? (
                        <>
                          <div className="flex items-center justify-center">
                            <button onClick={async () => {
                              if (!currentUser) return
                              await api.kenanUpdateOdeme(o.id, { ...o, hesap_disi: o.hesap_disi ? 0 : 1, user: currentUser })
                              loadAll()
                            }} className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer hover:opacity-80 transition-colors text-[10px] ${o.hesap_disi ? 'bg-red-500/30 border-red-400 text-red-300' : 'border-[--color-steel] text-transparent hover:border-[--color-text-muted]'}`} title={o.hesap_disi ? 'Hesaba dahil et' : 'Hesap dışı yap'}>
                              {o.hesap_disi ? '✗' : ''}
                            </button>
                          </div>
                          <div className="px-2 py-2 text-sm text-[--color-text-primary] whitespace-nowrap">{formatDate(o.tarih)}</div>
                          <div className={`px-2 py-2 text-sm min-w-0 truncate cursor-default ${o.hesap_disi ? 'line-through text-[--color-text-muted]' : 'text-[--color-text-primary]'}`} title={o.odeme_adi}>{o.odeme_adi}</div>
                          <div className="px-2 py-2 text-right text-sm font-mono text-[--color-text-secondary] whitespace-nowrap">{o.tl_tutar ? maskedCurrency(o.tl_tutar, loggedIn, o.doviz) : '-'}</div>
                          <div className="px-2 py-2 text-right text-xs font-mono text-[--color-text-muted] whitespace-nowrap">{loggedIn ? formatKur(o.kur) : '****'}</div>
                          <div className="px-2 py-2 text-right text-sm font-mono text-copper whitespace-nowrap">{maskedEur(o.tutar_eur, loggedIn)}</div>
                          <div className="px-2 py-2 text-center whitespace-nowrap">
                            {o.hesap_disi ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">H.Dışı</span>
                            ) : (
                              <button onClick={async () => {
                                if (!currentUser) return
                                const newDurum = o.durum === 'tamamlandi' ? 'beklemede' : 'tamamlandi'
                                await api.kenanUpdateOdeme(o.id, { ...o, durum: newDurum, user: currentUser })
                                loadAll()
                              }} className={`text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${o.durum === 'tamamlandi' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                                {DURUM_LABELS[o.durum] || o.durum}
                              </button>
                            )}
                          </div>
                          <div className="px-1 py-2 text-center text-[10px] text-[--color-text-muted] truncate">{o.updated_by || '-'}</div>
                          <div className="py-2 flex gap-0.5 justify-end">
                            <button onClick={() => { if (!currentUser) return; startEditOdeme(o) }} className="text-[--color-text-muted] hover:text-info"><Edit3 size={11} /></button>
                            <button onClick={async () => { if (!currentUser) return; if (confirm('Sil?')) { await api.kenanDeleteOdeme(o.id, currentUser); loadAll() } }} className="text-[--color-text-muted] hover:text-red-400"><Trash2 size={11} /></button>
                          </div>
                        </>
                      ) : (
                        <div className="py-[3px]" />
                      )}
                    </div>
                    {/* Sipariş side */}
                    <div className={s ? `grid grid-cols-[24px_85px_minmax(0,1fr)_90px_90px_110px_40px_55px_45px_28px] px-1 h-9 overflow-hidden ${s.hesap_disi ? 'opacity-40' : ''}` : ''}>
                      {s ? (
                        <>
                          <div className="flex items-center justify-center">
                            <button onClick={async () => {
                              if (!currentUser) return
                              await api.kenanUpdateSiparis(s.id, { ...s, hesap_disi: s.hesap_disi ? 0 : 1, user: currentUser })
                              loadAll()
                            }} className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer hover:opacity-80 transition-colors text-[10px] ${s.hesap_disi ? 'bg-red-500/30 border-red-400 text-red-300' : 'border-[--color-steel] text-transparent hover:border-[--color-text-muted]'}`} title={s.hesap_disi ? 'Hesaba dahil et' : 'Hesap dışı yap'}>
                              {s.hesap_disi ? '✗' : ''}
                            </button>
                          </div>
                          <div className="px-2 py-2 text-sm text-[--color-text-primary] whitespace-nowrap">{formatDate(s.tarih)}</div>
                          <div className={`px-2 py-2 text-sm min-w-0 truncate cursor-default ${s.hesap_disi ? 'line-through text-[--color-text-muted]' : 'text-[--color-text-primary]'}`} title={s.musteri}>{s.musteri}</div>
                          <div className="px-2 py-2 text-sm text-[--color-text-secondary] min-w-0 truncate" title={s.fatura_no || ''}>{s.fatura_no || '-'}</div>
                          <div className="px-2 py-2 text-sm text-[--color-text-secondary] min-w-0 truncate" title={s.siparis_no || ''}>{s.siparis_no || '-'}</div>
                          <div className="px-2 py-2 text-right text-sm font-mono text-info whitespace-nowrap">
                            {loggedIn ? `${new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(s.tutar)} ${s.doviz === 'USD' ? '$' : '€'}` : '****'}
                          </div>
                          <div className="px-2 py-2 text-center text-sm text-[--color-text-muted]">{s.vade_gun ? `${s.vade_gun}g` : '-'}</div>
                          <div className="px-2 py-2 text-center whitespace-nowrap">
                            {s.hesap_disi ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">H.Dışı</span>
                            ) : (
                              <button onClick={async () => {
                                if (!currentUser) return
                                const newDurum = s.durum === 'tamamlandi' ? 'beklemede' : 'tamamlandi'
                                await api.kenanUpdateSiparis(s.id, { ...s, durum: newDurum, user: currentUser })
                                loadAll()
                              }} className={`text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${s.durum === 'tamamlandi' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                                {DURUM_LABELS[s.durum] || s.durum}
                              </button>
                            )}
                          </div>
                          <div className="px-1 py-2 text-center text-[10px] text-[--color-text-muted] truncate">{s.updated_by || '-'}</div>
                          <div className="py-2 flex gap-0.5 justify-end">
                            <button onClick={() => { if (!currentUser) return; startEditSiparis(s) }} className="text-[--color-text-muted] hover:text-info"><Edit3 size={11} /></button>
                            <button onClick={async () => { if (!currentUser) return; if (confirm('Sil?')) { await api.kenanDeleteSiparis(s.id, currentUser); loadAll() } }} className="text-[--color-text-muted] hover:text-red-400"><Trash2 size={11} /></button>
                          </div>
                        </>
                      ) : (
                        <div className="py-[3px]" />
                      )}
                    </div>
                  </div>
                )
              })}
            </Fragment>
          ))
        )}

        {/* Footer */}
        <div className="grid grid-cols-2 border-t border-[--color-graphite]">
          <div className="px-3 py-2 border-r border-[--color-graphite] text-xs text-[--color-text-muted]">{odemeler.length} ödeme</div>
          <div className="px-3 py-2 text-xs text-[--color-text-muted]">{siparisler.length} sipariş</div>
        </div>
      </div>
    </div>
  )
}

// ==================== ANA SAYFA ====================

export function KenanOzsoyPage() {
  const [tab, setTab] = useState<'cari' | 'siparis'>('cari')
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('kenan_current_user') || '')
  const [currentRole, setCurrentRole] = useState(() => localStorage.getItem('kenan_current_role') || '')

  const handleUserChange = (user: string, role: string) => {
    setCurrentUser(user)
    setCurrentRole(role)
  }

  return (
    <div className="space-y-6">
      {/* Header with login panel */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary] font-display">Kayteks - Kenan Özsoy</h1>
          <p className="text-sm text-[--color-text-muted] mt-1">Cari hesap ve nakit akış takibi</p>
        </div>
        <div className="text-right text-[10px] text-[--color-text-muted] font-mono bg-[--color-slate] border border-[--color-graphite] rounded-lg px-3 py-2">
          <div>Deploy: {new Date((window as any).__BUILD_TIME__ || __BUILD_TIME__).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div className="text-copper">#{__COMMIT_HASH__}</div>
        </div>
      </div>

      {/* Login Panel - sol üst */}
      <LoginPanel currentUser={currentUser} currentRole={currentRole} onUserChange={handleUserChange} />

      {/* Tabs */}
      <div className="flex gap-1 bg-[--color-steel] rounded-lg p-1 w-fit">
        <button onClick={() => setTab('cari')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'cari' ? 'bg-copper text-white' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'}`}>
          Cari Hesap
        </button>
        <button onClick={() => setTab('siparis')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'siparis' ? 'bg-copper text-white' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'}`}>
          Sipariş & Ödeme Takip
        </button>
      </div>

      {tab === 'cari' ? <CariSection currentUser={currentUser} /> : <SiparisOdemeSection currentUser={currentUser} />}
    </div>
  )
}
