import { useEffect, useState, useMemo, Fragment } from 'react'
import { api } from '@/lib/api'
import { Plus, Trash2, Edit3, X, Search, CalendarCheck } from 'lucide-react'
import { Modal } from '@/components/Modal'
import {
  DURUM_OPTIONS, DURUM_LABELS, inputCls,
  type Odeme, formatDate, formatKur, maskedEur, maskedCurrency,
  getWeekNumber, getWeekDateRange, groupByWeek, useKur
} from '@/lib/kenan-utils'

export function OdemelerSection({ currentUser }: { currentUser: string }) {
  const loggedIn = !!currentUser
  const [odemeler, setOdemeler] = useState<Odeme[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { fetchKur } = useKur()

  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), odeme_adi: '', tl_tutar: '', tutar_eur: '', kur: '', doviz: 'TL', durum: 'beklemede', donem: '', notlar: '', kategori: ''
  })

  const load = async () => {
    const o = await api.kenanGetOdemeler()
    setOdemeler(o)
  }

  useEffect(() => { load() }, [])

  const fetchOdemeKur = async (date: string, doviz?: string) => {
    const d = doviz || form.doviz || 'TL'
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
    const tutar = parseFloat(form.tl_tutar) || 0
    const kur = parseFloat(form.kur) || 0
    if (tutar <= 0) return 0
    const d = form.doviz || 'TL'
    if (d === 'EUR') return tutar
    if (kur <= 0) return 0
    return Math.round((tutar / kur) * 100) / 100
  }, [form.tl_tutar, form.kur, form.doviz])

  const summary = useMemo(() => {
    const aktif = odemeler.filter(o => !o.hesap_disi)
    const toplam = aktif.reduce((s, o) => s + o.tutar_eur, 0)
    const tamamlanan = aktif.filter(o => o.durum === 'tamamlandi').reduce((s, o) => s + o.tutar_eur, 0)
    return { toplam, tamamlanan, kalan: toplam - tamamlanan }
  }, [odemeler])

  const filtered = useMemo(() => {
    if (!search.trim()) return odemeler
    const q = search.toLowerCase()
    return odemeler.filter(o =>
      o.odeme_adi?.toLowerCase().includes(q) ||
      o.tarih?.includes(q) ||
      String(o.tl_tutar).includes(q) ||
      String(o.tutar_eur).includes(q) ||
      o.notlar?.toLowerCase().includes(q)
    )
  }, [odemeler, search])

  const weeks = useMemo(() => groupByWeek(filtered), [filtered])

  const resetForm = () => {
    setForm({ tarih: new Date().toISOString().slice(0, 10), odeme_adi: '', tl_tutar: '', tutar_eur: '', kur: '', doviz: 'TL', durum: 'beklemede', donem: '', notlar: '', kategori: '' })
    setEditId(null)
    setShowForm(false)
  }

  const handleSubmit = async () => {
    const data = {
      ...form,
      tl_tutar: parseFloat(form.tl_tutar) || 0,
      tutar_eur: computedEur || parseFloat(form.tutar_eur) || 0,
      kur: form.doviz === 'EUR' ? 1 : (parseFloat(form.kur) || null),
      user: currentUser,
    }
    if (editId) await api.kenanUpdateOdeme(editId, data)
    else await api.kenanCreateOdeme(data)
    resetForm()
    load()
  }

  const startEdit = (o: Odeme) => {
    const doviz = (o as any).doviz || 'TL'
    setForm({
      tarih: o.tarih, odeme_adi: o.odeme_adi,
      tl_tutar: o.tl_tutar ? String(o.tl_tutar) : '',
      tutar_eur: o.tutar_eur ? String(o.tutar_eur) : '',
      kur: o.kur ? String(o.kur) : '',
      doviz,
      durum: o.durum, donem: o.donem || '', notlar: o.notlar || '', kategori: (o as any).kategori || ''
    })
    setEditId(o.id)
    setShowForm(true)
    fetchOdemeKur(o.tarih, doviz)
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Ödeme Toplamı</div>
          <div className="text-lg font-bold text-copper font-mono">{maskedEur(summary.toplam, loggedIn)}</div>
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
      <Modal open={showForm} onClose={resetForm} title={editId ? 'Ödeme Düzenle' : 'Yeni Ödeme Ekle'} color="copper">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tarih</label>
              <input type="date" value={form.tarih} onChange={e => { setForm(p => ({ ...p, tarih: e.target.value })); fetchOdemeKur(e.target.value, form.doviz) }} className={inputCls} />
              {form.tarih && <div className="mt-1 text-[10px] font-medium text-copper bg-copper/10 px-2 py-0.5 rounded w-fit">Hafta {getWeekNumber(form.tarih)}</div>}
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Ödeme Adı</label>
              <input value={form.odeme_adi} onChange={e => setForm(p => ({ ...p, odeme_adi: e.target.value }))} placeholder="Firma/Kişi" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tutar ({form.doviz === 'EUR' ? '€' : form.doviz === 'USD' ? '$' : '₺'})</label>
              <input type="number" step="0.01" value={form.tl_tutar} onChange={e => setForm(p => ({ ...p, tl_tutar: e.target.value, tutar_eur: '' }))} placeholder="Tutar girin" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Para Birimi</label>
              <select value={form.doviz} onChange={e => { const d = e.target.value; setForm(p => ({ ...p, doviz: d })); fetchOdemeKur(form.tarih, d) }} className={inputCls}>
                <option value="TL">₺ TL</option>
                <option value="EUR">€ EUR</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">
                {form.doviz === 'EUR' ? 'Kur' : form.doviz === 'USD' ? 'Kur (1€ = ?$)' : 'Kur (1€ = ?₺)'} {form.doviz !== 'EUR' && <span className="text-copper">TCMB</span>}
              </label>
              <input type="number" step="0.0001" value={form.kur} onChange={e => setForm(p => ({ ...p, kur: e.target.value }))} placeholder={form.doviz === 'EUR' ? '1' : 'Otomatik'} disabled={form.doviz === 'EUR'} className={`${inputCls} ${form.doviz === 'EUR' ? 'opacity-50' : ''}`} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">EUR Karşılığı</label>
              <div className="px-3 py-2 rounded-lg bg-[--color-steel]/50 border border-[--color-graphite] text-sm font-mono text-emerald-400">
                {computedEur > 0 ? maskedEur(computedEur, loggedIn) : (form.tutar_eur ? maskedEur(parseFloat(form.tutar_eur), loggedIn) : '—')}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Kategori</label>
              <select value={form.kategori} onChange={e => setForm(p => ({ ...p, kategori: e.target.value }))} className={inputCls}>
                <option value="">Seçiniz</option>
                <option value="Çek">Çek</option>
                <option value="Banka">Banka</option>
                <option value="Muhtelif">Muhtelif</option>
                <option value="Maaş / SGK">Maaş / SGK</option>
                <option value="İplik Cari">İplik Cari</option>
                <option value="Boyahane">Boyahane</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Dönem</label>
              <input value={form.donem} onChange={e => setForm(p => ({ ...p, donem: e.target.value }))} placeholder="Mart 2026" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Durum</label>
              <select value={form.durum} onChange={e => setForm(p => ({ ...p, durum: e.target.value }))} className={inputCls}>
                {DURUM_OPTIONS.map(d => <option key={d} value={d}>{DURUM_LABELS[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Notlar</label>
              <input value={form.notlar} onChange={e => setForm(p => ({ ...p, notlar: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t border-[--color-graphite]">
            <button onClick={handleSubmit} disabled={!currentUser} className="px-5 py-2 rounded-lg bg-copper text-white text-sm font-medium hover:bg-copper-dark disabled:opacity-50">{editId ? 'Güncelle' : 'Ekle'}</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-lg border border-[--color-graphite] text-[--color-text-muted] text-sm hover:bg-[--color-steel]">İptal</button>
            {!currentUser && <span className="text-xs text-red-400 self-center">Önce kullanıcı seçin</span>}
          </div>
        </div>
      </Modal>

      {/* Table */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-graphite]">
          <h3 className="text-sm font-semibold text-copper">ÖDEMELER (TL → EUR)</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[--color-text-muted]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ara..."
                className="pl-7 pr-2 py-1 text-xs rounded-lg bg-[--color-midnight] border border-[--color-graphite] text-[--color-text-primary] placeholder:text-[--color-text-muted]/50 w-36 focus:outline-none focus:border-copper"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] hover:text-[--color-text-primary]"><X size={10} /></button>}
            </div>
            <button onClick={() => { resetForm(); setShowForm(true); fetchOdemeKur(new Date().toISOString().slice(0, 10), 'TL') }}
              disabled={!currentUser}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-copper text-white text-xs font-medium hover:bg-copper-dark disabled:opacity-50">
              <Plus size={12} /> Ekle
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[24px_85px_minmax(0,1fr)_100px_120px_50px_120px_60px_50px_48px] border-b border-[--color-graphite] px-1">
          <div className="py-2 text-[9px] text-[--color-text-muted] text-center" title="Hesap Dışı">HD</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Tarih</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Ödeme Adı</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Kategori</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">TL</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Kur</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">EUR</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Durum</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Kişi</div>
          <div></div>
        </div>

        {/* Week groups */}
        {weeks.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[--color-text-muted]">Henüz ödeme kaydı yok</div>
        ) : (
          weeks.map(wg => (
            <Fragment key={`ow-${wg.year}-${wg.week}`}>
              {/* Week header */}
              <div className="px-3 py-1.5 bg-copper/5 border-b border-[--color-graphite]/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-copper bg-copper/10 px-2 py-0.5 rounded">H{wg.week}</span>
                  <span className="text-[10px] text-[--color-text-muted]">{getWeekDateRange(wg.year, wg.week)}</span>
                  <span className="text-[10px] text-copper/60">{wg.items.length} ödeme · {maskedEur(wg.items.filter(o => !o.hesap_disi).reduce((s, o) => s + o.tutar_eur, 0), loggedIn)}</span>
                </div>
              </div>
              {/* Rows */}
              {wg.items.map(o => (
                <div key={o.id} className={`grid grid-cols-[24px_85px_minmax(0,1fr)_100px_120px_50px_120px_60px_50px_48px] px-1 h-9 overflow-hidden border-b border-[--color-graphite]/50 hover:bg-[--color-steel]/30 ${o.hesap_disi ? 'opacity-40' : ''}`}>
                  <div className="flex items-center justify-center">
                    <button onClick={async () => {
                      if (!currentUser) return
                      await api.kenanUpdateOdeme(o.id, { ...o, hesap_disi: o.hesap_disi ? 0 : 1, user: currentUser })
                      load()
                    }} className={`w-4 h-4 rounded border-2 flex items-center justify-center cursor-pointer hover:opacity-80 transition-colors text-[10px] ${o.hesap_disi ? 'bg-red-500/30 border-red-400 text-red-300' : 'border-[--color-steel] text-transparent hover:border-[--color-text-muted]'}`} title={o.hesap_disi ? 'Hesaba dahil et' : 'Hesap dışı yap'}>
                      {o.hesap_disi ? '✗' : ''}
                    </button>
                  </div>
                  <div className="px-2 py-2 text-sm text-[--color-text-primary] whitespace-nowrap">{formatDate(o.tarih)}</div>
                  <div className={`px-2 py-2 text-sm min-w-0 truncate cursor-default ${o.hesap_disi ? 'line-through text-[--color-text-muted]' : 'text-[--color-text-primary]'}`} title={o.odeme_adi}>{o.odeme_adi}</div>
                  <div className="px-2 py-2 text-xs text-[--color-text-muted] truncate">{(o as any).kategori || '-'}</div>
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
                        load()
                      }} className={`text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${o.durum === 'tamamlandi' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                        {DURUM_LABELS[o.durum] || o.durum}
                      </button>
                    )}
                  </div>
                  <div className="px-1 py-2 text-center text-[10px] text-[--color-text-muted] truncate">{o.updated_by || '-'}</div>
                  <div className="py-2 flex gap-0.5 justify-end">
                    <button onClick={async () => { if (!currentUser) return; await api.kenanToggleOdemePlanlamada(o.id, !o.planlamada); load() }} className={o.planlamada ? 'text-amber-400' : 'text-[--color-text-muted] hover:text-amber-400'} title={o.planlamada ? 'Planlamadan çıkar' : 'Planlamaya ekle'}><CalendarCheck size={11} /></button>
                    <button onClick={() => { if (!currentUser) return; startEdit(o) }} className="text-[--color-text-muted] hover:text-info"><Edit3 size={11} /></button>
                    <button onClick={async () => { if (!currentUser) return; if (confirm('Sil?')) { await api.kenanDeleteOdeme(o.id, currentUser); load() } }} className="text-[--color-text-muted] hover:text-red-400"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </Fragment>
          ))
        )}

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[--color-graphite] text-xs text-[--color-text-muted]">{odemeler.length} ödeme</div>
      </div>
    </div>
  )
}
