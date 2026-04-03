import { useEffect, useState, useMemo } from 'react'
import { api } from '@/lib/api'
import { Plus, Trash2, Edit3, X, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { Modal } from '@/components/Modal'
import {
  DURUM_OPTIONS, DURUM_LABELS, inputCls,
  formatDate, formatKur, maskedEur, maskedCurrency,
  getWeekNumber, useKur
} from '@/lib/kenan-utils'

interface Fatura {
  id: string; tarih: string; fatura_no: string; musteri: string;
  tutar: number; doviz: string; kur: number; tutar_eur: number;
  vade_gun: number; vade_tarih: string; durum: string; notlar: string;
  hesap_disi: number; banka: string; temlik: string; updated_by: string;
}

function calcVadeTarih(tarih: string, vadeGun: number): string {
  if (!tarih || !vadeGun) return ''
  const d = new Date(tarih)
  d.setDate(d.getDate() + vadeGun)
  return d.toISOString().slice(0, 10)
}

export function FaturalarSection({ currentUser }: { currentUser: string }) {
  const loggedIn = !!currentUser
  const [faturalar, setFaturalar] = useState<Fatura[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { fetchKur } = useKur()

  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10),
    fatura_no: '', musteri: '', tutar: '', doviz: 'EUR',
    kur: '', vade_gun: '', vade_tarih: '',
    durum: 'beklemede', notlar: '', banka: '', temlik: 'verilmedi'
  })

  const load = async () => {
    const f = await api.kenanGetFaturalar()
    setFaturalar(f)
  }

  useEffect(() => { load() }, [])

  const fetchFaturaKur = async (date: string, doviz?: string) => {
    const d = doviz || form.doviz || 'EUR'
    if (d === 'EUR') {
      setForm(p => ({ ...p, kur: '1' }))
      return
    }
    const rates = await fetchKur(date)
    if (rates) {
      if (d === 'USD') {
        const eurUsd = Math.round((rates.eur / rates.usd) * 10000) / 10000
        setForm(p => ({ ...p, kur: String(eurUsd) }))
      } else {
        setForm(p => ({ ...p, kur: String(rates.eur) }))
      }
    }
  }

  const computedEur = useMemo(() => {
    const tutar = parseFloat(form.tutar) || 0
    const kur = parseFloat(form.kur) || 0
    if (tutar <= 0) return 0
    const d = form.doviz || 'EUR'
    if (d === 'EUR') return tutar
    if (kur <= 0) return 0
    return Math.round((tutar / kur) * 100) / 100
  }, [form.tutar, form.kur, form.doviz])

  const [showAylik, setShowAylik] = useState(false)

  const summary = useMemo(() => {
    const aktif = faturalar.filter(f => !f.hesap_disi)
    const toplam = aktif.reduce((s, f) => s + f.tutar_eur, 0)
    const tamamlanan = aktif.filter(f => f.durum === 'tamamlandi').reduce((s, f) => s + f.tutar_eur, 0)
    return { toplam, tamamlanan, kalan: toplam - tamamlanan }
  }, [faturalar])

  const aylikVadeler = useMemo(() => {
    const aktif = faturalar.filter(f => !f.hesap_disi && f.vade_tarih)
    const gruplar: Record<string, { toplam: number; tamamlanan: number }> = {}
    for (const f of aktif) {
      const key = f.vade_tarih.slice(0, 7) // YYYY-MM
      if (!gruplar[key]) gruplar[key] = { toplam: 0, tamamlanan: 0 }
      gruplar[key].toplam += f.tutar_eur
      if (f.durum === 'tamamlandi') gruplar[key].tamamlanan += f.tutar_eur
    }
    const AY_ISIMLERI: Record<string, string> = {
      '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
      '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
      '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
    }
    return Object.entries(gruplar)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        const [yil, ay] = key.split('-')
        return { ay: `${AY_ISIMLERI[ay]} ${yil}`, ...val, kalan: val.toplam - val.tamamlanan }
      })
  }, [faturalar])

  const sorted = useMemo(() => {
    const list = [...faturalar].sort((a, b) => {
      const va = a.vade_tarih || '9999-12-31'
      const vb = b.vade_tarih || '9999-12-31'
      return va.localeCompare(vb)
    })
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(f =>
      f.musteri?.toLowerCase().includes(q) ||
      f.fatura_no?.toLowerCase().includes(q) ||
      f.tarih?.includes(q) ||
      String(f.tutar).includes(q) ||
      f.notlar?.toLowerCase().includes(q)
    )
  }, [faturalar, search])

  const resetForm = () => {
    setForm({
      tarih: new Date().toISOString().slice(0, 10),
      fatura_no: '', musteri: '', tutar: '', doviz: 'EUR',
      kur: '', vade_gun: '', vade_tarih: '',
      durum: 'beklemede', notlar: '', banka: '', temlik: 'verilmedi'
    })
    setEditId(null)
    setShowForm(false)
  }

  const handleSubmit = async () => {
    const data = {
      ...form,
      tutar: parseFloat(form.tutar) || 0,
      kur: form.doviz === 'EUR' ? 1 : (parseFloat(form.kur) || null),
      vade_gun: parseInt(form.vade_gun) || null,
      vade_tarih: form.vade_tarih || null,
      user: currentUser,
    }
    if (editId) await api.kenanUpdateFatura(editId, data)
    else await api.kenanCreateFatura(data)
    resetForm()
    load()
  }

  const startEdit = (f: Fatura) => {
    setForm({
      tarih: f.tarih,
      fatura_no: f.fatura_no || '',
      musteri: f.musteri,
      tutar: f.tutar ? String(f.tutar) : '',
      doviz: f.doviz || 'EUR',
      kur: f.kur ? String(f.kur) : '',
      vade_gun: f.vade_gun ? String(f.vade_gun) : '',
      vade_tarih: f.vade_tarih || '',
      durum: f.durum,
      notlar: f.notlar || '',
      banka: f.banka || '',
      temlik: f.temlik || 'verilmedi'
    })
    setEditId(f.id)
    setShowForm(true)
    fetchFaturaKur(f.tarih, f.doviz || 'EUR')
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Fatura Toplamı</div>
          <div className="text-lg font-bold text-info font-mono">{maskedEur(summary.toplam, loggedIn)}</div>
          {aylikVadeler.length > 0 && (
            <div className="mt-2">
              <button onClick={() => setShowAylik(!showAylik)}
                className="flex items-center gap-1 text-[10px] text-[--color-text-muted] hover:text-[--color-text-primary] transition-colors">
                {showAylik ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Aylık Vade Detayları
              </button>
              {showAylik && (
                <div className="mt-2 space-y-1.5">
                  {aylikVadeler.map(m => (
                    <div key={m.ay} className="bg-[--color-steel]/50 border border-[--color-graphite]/50 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium text-info">{m.ay}</span>
                        <span className="text-xs font-bold text-info font-mono">{maskedEur(m.toplam, loggedIn)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-emerald-400">Tamamlanan</span>
                        <span className="text-[10px] font-mono text-emerald-400">{maskedEur(m.tamamlanan, loggedIn)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-400">Kalan</span>
                        <span className="text-[10px] font-mono text-amber-400">{maskedEur(m.kalan, loggedIn)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Tamamlanan</div>
          <div className="text-lg font-bold text-emerald-400 font-mono">{maskedEur(summary.tamamlanan, loggedIn)}</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Kalan</div>
          <div className="text-lg font-bold text-amber-400 font-mono">{maskedEur(summary.kalan, loggedIn)}</div>
        </div>
      </div>

      {/* Modal */}
      <Modal open={showForm} onClose={resetForm} title={editId ? 'Fatura Düzenle' : 'Yeni Fatura Ekle'} color="info" wide>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Fatura Tarihi</label>
              <input type="date" value={form.tarih} onChange={e => { setForm(p => ({ ...p, tarih: e.target.value })); fetchFaturaKur(e.target.value, form.doviz) }} className={inputCls} />
              {form.tarih && <div className="mt-1 text-[10px] font-medium text-info bg-info/10 px-2 py-0.5 rounded w-fit">Hafta {getWeekNumber(form.tarih)}</div>}
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Fatura No</label>
              <input value={form.fatura_no} onChange={e => setForm(p => ({ ...p, fatura_no: e.target.value }))} placeholder="Fatura numarası" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Müşteri</label>
              <input value={form.musteri} onChange={e => setForm(p => ({ ...p, musteri: e.target.value }))} placeholder="Müşteri adı" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tutar ({form.doviz === 'EUR' ? '€' : form.doviz === 'USD' ? '$' : '₺'})</label>
              <input type="number" step="0.01" value={form.tutar} onChange={e => setForm(p => ({ ...p, tutar: e.target.value }))} placeholder="Tutar girin" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Para Birimi</label>
              <select value={form.doviz} onChange={e => { const d = e.target.value; setForm(p => ({ ...p, doviz: d })); fetchFaturaKur(form.tarih, d) }} className={inputCls}>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
                <option value="TL">₺ TL</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">
                {form.doviz === 'EUR' ? 'Kur' : form.doviz === 'USD' ? 'Kur (1€ = ?$)' : 'Kur (1€ = ?₺)'} {form.doviz !== 'EUR' && <span className="text-info">TCMB</span>}
              </label>
              <input type="number" step="0.0001" value={form.kur} onChange={e => setForm(p => ({ ...p, kur: e.target.value }))} placeholder={form.doviz === 'EUR' ? '1' : 'Otomatik'} disabled={form.doviz === 'EUR'} className={`${inputCls} ${form.doviz === 'EUR' ? 'opacity-50' : ''}`} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">EUR Karşılığı</label>
              <div className="px-3 py-2 rounded-lg bg-[--color-steel]/50 border border-[--color-graphite] text-sm font-mono text-emerald-400">
                {computedEur > 0 ? maskedEur(computedEur, loggedIn) : '—'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Vade (Gün)</label>
              <input type="number" value={form.vade_gun} onChange={e => {
                const vg = e.target.value
                const vt = vg && form.tarih ? calcVadeTarih(form.tarih, parseInt(vg)) : ''
                setForm(p => ({ ...p, vade_gun: vg, vade_tarih: vt }))
              }} placeholder="Gün sayısı" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Vade Tarihi</label>
              <input type="date" value={form.vade_tarih} onChange={e => setForm(p => ({ ...p, vade_tarih: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Durum</label>
              <select value={form.durum} onChange={e => setForm(p => ({ ...p, durum: e.target.value }))} className={inputCls}>
                {DURUM_OPTIONS.map(d => <option key={d} value={d}>{DURUM_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Banka</label>
              <select value={form.banka} onChange={e => setForm(p => ({ ...p, banka: e.target.value }))} className={inputCls}>
                <option value="">Seçiniz</option>
                <option value="HALKBANK">HALKBANK</option>
                <option value="İŞ BANKASI">İŞ BANKASI</option>
                <option value="YAPIKREDİ">YAPIKREDİ</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-4">
              <label className="text-xs text-[--color-text-muted] mb-1 block">Notlar</label>
              <input value={form.notlar} onChange={e => setForm(p => ({ ...p, notlar: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-[--color-graphite]">
            <button onClick={handleSubmit} disabled={!currentUser} className="px-5 py-2 rounded-lg bg-info text-white text-sm font-medium hover:opacity-90 disabled:opacity-50">{editId ? 'Güncelle' : 'Ekle'}</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-lg border border-[--color-graphite] text-[--color-text-muted] text-sm hover:bg-[--color-steel]">İptal</button>
            {!currentUser && <span className="text-xs text-red-400 self-center">Önce giriş yapın</span>}
          </div>
        </div>
      </Modal>

      {/* Table */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-graphite]">
          <h3 className="text-sm font-semibold text-info">FATURALAR</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara..."
                className="pl-7 pr-2 py-1 text-xs rounded-lg bg-[--color-midnight] border border-[--color-graphite] text-[--color-text-primary] placeholder:text-[--color-text-muted]/50 w-36 focus:outline-none focus:border-info"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]"><X size={10} /></button>}
            </div>
            <button onClick={() => { resetForm(); setShowForm(true); fetchFaturaKur(new Date().toISOString().slice(0, 10), 'EUR') }}
              disabled={!currentUser}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-info text-white text-xs font-medium hover:opacity-90 disabled:opacity-50">
              <Plus size={12} /> Ekle
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[24px_85px_100px_minmax(0,1fr)_120px_50px_120px_60px_85px_80px_60px_60px_50px_48px] border-b border-[--color-graphite] px-1">
          <div className="py-2 text-[9px] text-[--color-text-muted] text-center" title="Hesap Dışı">HD</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Tarih</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Fatura No</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Müşteri</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Tutar</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Kur</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">EUR</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Vade</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Vade Tarihi</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Banka</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Temlik</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Durum</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Kişi</div>
          <div></div>
        </div>

        {/* Rows - vade tarihine göre sıralı, kullanıcı / system ayrımı */}
        {sorted.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[--color-text-muted]">Henüz fatura kaydı yok</div>
        ) : (() => {
          const userRows = sorted.filter(f => f.updated_by && f.updated_by !== 'system')
          const systemRows = sorted.filter(f => !f.updated_by || f.updated_by === 'system')
          const allRows: (Fatura | 'separator')[] = [
            ...userRows,
            ...(userRows.length > 0 && systemRows.length > 0 ? ['separator' as const] : []),
            ...systemRows,
          ]
          return allRows.map(item => {
            if (item === 'separator') {
              return (
                <div key="__sep__" className="h-7 bg-red-600/80 flex items-center px-4">
                  <span className="text-[10px] font-bold text-white tracking-wider">TOPLU GİRİŞ (SYSTEM)</span>
                </div>
              )
            }
            const f = item
            return (
            <div key={f.id} className={`grid grid-cols-[24px_85px_100px_minmax(0,1fr)_120px_50px_120px_60px_85px_80px_60px_60px_50px_48px] px-1 h-9 overflow-hidden border-b border-[--color-graphite]/50 hover:bg-[--color-steel]/30 ${f.hesap_disi ? 'opacity-40' : ''}`}>
              <div className="flex items-center justify-center">
                <button onClick={async () => {
                  if (!currentUser) return
                  await api.kenanUpdateFatura(f.id, { ...f, hesap_disi: f.hesap_disi ? 0 : 1, user: currentUser })
                  load()
                }} className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer hover:opacity-80 transition-colors text-[10px] ${f.hesap_disi ? 'bg-red-500/30 border-red-400 text-red-300' : 'border-[--color-steel] text-transparent hover:border-[--color-text-muted]'}`} title={f.hesap_disi ? 'Hesaba dahil et' : 'Hesap dışı yap'}>
                  {f.hesap_disi ? '✗' : ''}
                </button>
              </div>
              <div className="px-2 py-2 text-sm text-[--color-text-primary] whitespace-nowrap">{formatDate(f.tarih)}</div>
              <div className="px-2 py-2 text-xs text-[--color-text-muted] truncate">{f.fatura_no || '-'}</div>
              <div className={`px-2 py-2 text-sm min-w-0 truncate cursor-default ${f.hesap_disi ? 'line-through text-[--color-text-muted]' : 'text-[--color-text-primary]'}`} title={f.musteri}>{f.musteri}</div>
              <div className="px-2 py-2 text-right text-sm font-mono text-[--color-text-secondary] whitespace-nowrap">{f.tutar ? maskedCurrency(f.tutar, loggedIn, f.doviz) : '-'}</div>
              <div className="px-2 py-2 text-right text-xs font-mono text-[--color-text-muted] whitespace-nowrap">{loggedIn ? formatKur(f.kur) : '****'}</div>
              <div className="px-2 py-2 text-right text-sm font-mono text-info whitespace-nowrap">{maskedEur(f.tutar_eur, loggedIn)}</div>
              <div className="px-2 py-2 text-right text-xs text-[--color-text-muted]">{f.vade_gun ? `${f.vade_gun}g` : '-'}</div>
              <div className="px-2 py-2 text-xs text-[--color-text-muted] whitespace-nowrap">{f.vade_tarih ? formatDate(f.vade_tarih) : '-'}</div>
              <div className="px-2 py-2 text-[10px] text-[--color-text-muted] truncate">{f.banka || '-'}</div>
              <div className="px-2 py-2 text-center whitespace-nowrap">
                <button onClick={async () => {
                  if (!currentUser) return
                  const newTemlik = (f.temlik === 'verildi') ? 'verilmedi' : 'verildi'
                  await api.kenanUpdateFatura(f.id, { ...f, temlik: newTemlik, user: currentUser })
                  load()
                }} className={`text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${f.temlik === 'verildi' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>
                  {f.temlik === 'verildi' ? 'VERİLDİ' : 'VERİLMEDİ'}
                </button>
              </div>
              <div className="px-2 py-2 text-center whitespace-nowrap">
                {f.hesap_disi ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400">H.Dışı</span>
                ) : (
                  <button onClick={async () => {
                    if (!currentUser) return
                    const newDurum = f.durum === 'tamamlandi' ? 'beklemede' : 'tamamlandi'
                    await api.kenanUpdateFatura(f.id, { ...f, durum: newDurum, user: currentUser })
                    load()
                  }} className={`text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${f.durum === 'tamamlandi' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                    {DURUM_LABELS[f.durum] || f.durum}
                  </button>
                )}
              </div>
              <div className="px-1 py-2 text-center text-[10px] text-[--color-text-muted] truncate">{f.updated_by || '-'}</div>
              <div className="py-2 flex gap-0.5 justify-end">
                <button onClick={() => { if (!currentUser) return; startEdit(f) }} className="text-[--color-text-muted] hover:text-info"><Edit3 size={11} /></button>
                <button onClick={async () => { if (!currentUser) return; if (confirm('Sil?')) { await api.kenanDeleteFatura(f.id, currentUser); load() } }} className="text-[--color-text-muted] hover:text-red-400"><Trash2 size={11} /></button>
              </div>
            </div>
            )
          })
        })()}

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[--color-graphite] text-xs text-[--color-text-muted]">{faturalar.length} fatura</div>
      </div>
    </div>
  )
}
