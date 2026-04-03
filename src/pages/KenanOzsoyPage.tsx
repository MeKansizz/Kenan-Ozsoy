import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { Filter, ArrowDownCircle, ArrowUpCircle, RefreshCw, Users, Clock, UserCheck, X, Trash2 } from 'lucide-react'
import { OdemePlanlamaSection } from './OdemePlanlamaPage'
import { OdemelerSection } from './OdemelerPage'
import { SiparislerSection } from './SiparislerPage'
import { TedarikPlanlamaSection } from './TedarikPlanlamaPage'
import { DURUM_LABELS, BASLANGIC_BAKIYE, formatKur, formatDate, maskedEur } from '@/lib/kenan-utils'

// ==================== LOGIN PANEL ====================
function LoginPanel({ currentUser, currentRole, onUserChange }: { currentUser: string; currentRole: string; onUserChange: (u: string, role: string) => void }) {
  const [users, setUsers] = useState<any[]>([])
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
    const u = await api.kenanGetUsers()
    setUsers(u)
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
    <>
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
    </>
  )
}

function LoginLogPanel() {
  const [loginLog, setLoginLog] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  useEffect(() => { api.kenanGetLoginLog().then(setLoginLog) }, [])
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] text-[--color-text-muted] font-mono bg-[--color-slate] border border-[--color-graphite] rounded-lg px-3 py-2 hover:border-[--color-text-muted] transition-colors">
        <Clock size={10} />
        <span>Son Girişler</span>
        {loginLog.length > 0 && <span className="text-emerald-400 font-medium">{loginLog[0]?.user_name}</span>}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[--color-slate] border border-[--color-graphite] rounded-xl p-3 min-w-[220px] shadow-xl">
          {loginLog.length === 0 ? (
            <div className="text-xs text-[--color-text-muted]">Henüz giriş yok</div>
          ) : (
            <div className="space-y-1">
              {loginLog.map((l: any, i: number) => (
                <div key={l.id} className="flex items-center justify-between text-xs gap-4">
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
      )}
    </div>
  )
}

// ==================== CARİ HESAP ====================

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

      <div className="flex items-center gap-3">
        <div className="text-xs text-[--color-text-muted] bg-[--color-steel] px-3 py-2 rounded-lg">Veriler Sipariş & Ödeme sekmelerinden otomatik gelir</div>
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
              {entries.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-[--color-text-muted]">Henüz kayıt yok. Sipariş & Ödeme sekmelerinden veri girin.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-[--color-graphite] text-xs text-[--color-text-muted]">Toplam {entries.length} kayıt</div>
      </div>
    </div>
  )
}

// ==================== ANA SAYFA ====================

export function KenanOzsoyPage() {
  const [tab, setTab] = useState<'cari' | 'odemeler' | 'siparisler' | 'planlama' | 'tedarik'>('cari')
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('kenan_current_user') || '')
  const [currentRole, setCurrentRole] = useState(() => localStorage.getItem('kenan_current_role') || '')

  const handleUserChange = (user: string, role: string) => {
    setCurrentUser(user)
    setCurrentRole(role)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[--color-text-primary] font-display">Kayteks - Kenan Özsoy</h1>
          <p className="text-sm text-[--color-text-muted] mt-1">Cari hesap ve nakit akış takibi</p>
        </div>
        <div className="flex items-center gap-2">
          <LoginPanel currentUser={currentUser} currentRole={currentRole} onUserChange={handleUserChange} />
          <LoginLogPanel />
          <div className="text-right text-[10px] text-[--color-text-muted] font-mono bg-[--color-slate] border border-[--color-graphite] rounded-lg px-3 py-2 shrink-0">
            <div>Deploy: {new Date((window as any).__BUILD_TIME__ || __BUILD_TIME__).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div className="text-copper">#{__COMMIT_HASH__}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-[--color-steel] rounded-lg p-1 w-fit">
        <button onClick={() => setTab('cari')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'cari' ? 'bg-copper text-white' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'}`}>
          Cari Hesap
        </button>
        <button onClick={() => setTab('odemeler')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'odemeler' ? 'bg-copper text-white' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'}`}>
          Ödemeler
        </button>
        <button onClick={() => setTab('siparisler')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'siparisler' ? 'bg-info text-white' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'}`}>
          Siparişler
        </button>
        <button onClick={() => setTab('planlama')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'planlama' ? 'bg-copper text-white' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'}`}>
          Ödeme Planlama
        </button>
        <button onClick={() => setTab('tedarik')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'tedarik' ? 'bg-purple-500 text-white' : 'text-[--color-text-secondary] hover:text-[--color-text-primary]'}`}>
          Tedarik Planlama
        </button>
      </div>

      {tab === 'cari' && <CariSection currentUser={currentUser} />}
      {tab === 'odemeler' && <OdemelerSection currentUser={currentUser} />}
      {tab === 'siparisler' && <SiparislerSection currentUser={currentUser} />}
      {tab === 'planlama' && <OdemePlanlamaSection currentUser={currentUser} />}
      {tab === 'tedarik' && <TedarikPlanlamaSection currentUser={currentUser} />}
    </div>
  )
}
