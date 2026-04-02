import { useEffect, useState, useMemo, Fragment } from 'react'
import { api } from '@/lib/api'
import { Plus, Trash2, Edit3, X, Search, CalendarCheck } from 'lucide-react'
import { Modal } from '@/components/Modal'
import {
  DURUM_OPTIONS, DURUM_LABELS, inputCls,
  type Siparis, formatDate, maskedEur,
  getWeekNumber, getWeekDateRange, groupByWeek, useKur
} from '@/lib/kenan-utils'

export function SiparislerSection({ currentUser }: { currentUser: string }) {
  const loggedIn = !!currentUser
  const [siparisler, setSiparisler] = useState<Siparis[]>([])
  const [plannedIds, setPlannedIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const { fetchKur } = useKur()

  const [form, setForm] = useState({
    tarih: new Date().toISOString().slice(0, 10), fatura_no: '', musteri: '', siparis_no: '', tutar: '', kur: '', doviz: 'EUR', vade_gun: '', durum: 'beklemede', notlar: '',
    maliyet_iplik: '', maliyet_boya: '', maliyet_navlun: '',
    iplik_cinsi: '', iplik_miktar: '', iplik_birim_fiyat: '',
    boyahane: ''
  })

  const load = async () => {
    const [s, p] = await Promise.all([api.kenanGetSiparisler(), api.kenanGetPlanlama()])
    setSiparisler(s)
    setPlannedIds(new Set(p.map((x: any) => x.siparis_id)))
  }

  useEffect(() => { load() }, [])

  const fetchSiparisKur = async (date: string) => {
    const rates = await fetchKur(date)
    if (rates) {
      setForm(p => ({ ...p, kur: String(p.doviz === 'USD' ? rates.usd : rates.eur) }))
    }
  }

  const summary = useMemo(() => {
    const aktif = siparisler.filter(o => !o.hesap_disi)
    const toplam = aktif.reduce((s, o) => s + (o.tutar_eur || o.tutar), 0)
    const tamamlanan = aktif.filter(o => o.durum === 'tamamlandi').reduce((s, o) => s + (o.tutar_eur || o.tutar), 0)
    return { toplam, tamamlanan, kalan: toplam - tamamlanan }
  }, [siparisler])

  const filtered = useMemo(() => {
    if (!search.trim()) return siparisler
    const q = search.toLowerCase()
    return siparisler.filter(s =>
      s.musteri?.toLowerCase().includes(q) ||
      s.tarih?.includes(q) ||
      s.siparis_no?.toLowerCase().includes(q) ||
      s.fatura_no?.toLowerCase().includes(q) ||
      String(s.tutar).includes(q) ||
      s.notlar?.toLowerCase().includes(q)
    )
  }, [siparisler, search])

  const weeks = useMemo(() => groupByWeek(filtered), [filtered])

  const resetForm = () => {
    setForm({ tarih: new Date().toISOString().slice(0, 10), fatura_no: '', musteri: '', siparis_no: '', tutar: '', kur: '', doviz: 'EUR', vade_gun: '', durum: 'beklemede', notlar: '', maliyet_iplik: '', maliyet_boya: '', maliyet_navlun: '', iplik_cinsi: '', iplik_miktar: '', iplik_birim_fiyat: '', boyahane: '' })
    setEditId(null)
    setShowForm(false)
  }

  const handleSubmit = async () => {
    const data = {
      ...form,
      tutar: parseFloat(form.tutar) || 0,
      kur: parseFloat(form.kur) || null,
      vade_gun: parseInt(form.vade_gun) || null,
      maliyet_iplik: parseFloat(form.maliyet_iplik) || 0,
      maliyet_boya: parseFloat(form.maliyet_boya) || 0,
      maliyet_navlun: parseFloat(form.maliyet_navlun) || 0,
      iplik_cinsi: form.iplik_cinsi || '',
      iplik_miktar: parseFloat(form.iplik_miktar) || 0,
      iplik_birim_fiyat: parseFloat(form.iplik_birim_fiyat) || 0,
      boyahane: form.boyahane || '',
      user: currentUser,
    }
    if (editId) await api.kenanUpdateSiparis(editId, data)
    else await api.kenanCreateSiparis(data)
    resetForm()
    load()
  }

  const startEdit = (s: Siparis) => {
    setForm({
      tarih: s.tarih, fatura_no: s.fatura_no || '', musteri: s.musteri, siparis_no: s.siparis_no || '',
      tutar: String(s.tutar), kur: s.kur ? String(s.kur) : '', doviz: s.doviz || 'EUR',
      vade_gun: s.vade_gun ? String(s.vade_gun) : '', durum: s.durum, notlar: s.notlar || '',
      maliyet_iplik: (s as any).maliyet_iplik ? String((s as any).maliyet_iplik) : (s.tutar > 0 ? String(Math.round(s.tutar * 0.4 * 100) / 100) : ''),
      maliyet_boya: (s as any).maliyet_boya ? String((s as any).maliyet_boya) : (s.tutar > 0 ? String(Math.round(s.tutar * 0.2 * 100) / 100) : ''),
      maliyet_navlun: (s as any).maliyet_navlun ? String((s as any).maliyet_navlun) : '',
      iplik_cinsi: (s as any).iplik_cinsi || '',
      iplik_miktar: (s as any).iplik_miktar ? String((s as any).iplik_miktar) : '',
      iplik_birim_fiyat: (s as any).iplik_birim_fiyat ? String((s as any).iplik_birim_fiyat) : '',
      boyahane: (s as any).boyahane || '',
    })
    setEditId(s.id)
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl p-4">
          <div className="text-xs text-[--color-text-muted] mb-1">Sipariş Toplamı</div>
          <div className="text-lg font-bold text-info font-mono">{maskedEur(summary.toplam, loggedIn)}</div>
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
      <Modal open={showForm} onClose={resetForm} title={editId ? 'Sipariş Düzenle' : 'Yeni Sipariş Ekle'} color="info">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tarih</label>
              <input type="date" value={form.tarih} onChange={e => { setForm(p => ({ ...p, tarih: e.target.value })); fetchSiparisKur(e.target.value) }} className={inputCls} />
              {form.tarih && <div className="mt-1 text-[10px] font-medium text-info bg-info/10 px-2 py-0.5 rounded w-fit">Hafta {getWeekNumber(form.tarih)}</div>}
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Müşteri</label>
              <input value={form.musteri} onChange={e => setForm(p => ({ ...p, musteri: e.target.value }))} placeholder="Müşteri adı" className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Fatura No</label>
              <input value={form.fatura_no} onChange={e => setForm(p => ({ ...p, fatura_no: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Sipariş No</label>
              <input value={form.siparis_no} onChange={e => setForm(p => ({ ...p, siparis_no: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Döviz</label>
              <select value={form.doviz} onChange={e => { setForm(p => ({ ...p, doviz: e.target.value })); fetchSiparisKur(form.tarih) }} className={inputCls}>
                <option value="EUR">EUR</option><option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Tutar ({form.doviz})</label>
              <input type="number" step="0.01" value={form.tutar} onChange={e => {
                const val = e.target.value
                const t = parseFloat(val) || 0
                setForm(p => ({ ...p, tutar: val, maliyet_iplik: t > 0 ? String(Math.round(t * 0.4 * 100) / 100) : '', maliyet_boya: t > 0 ? String(Math.round(t * 0.2 * 100) / 100) : '' }))
              }} className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Kur <span className="text-copper">TCMB</span></label>
              <input type="number" step="0.0001" value={form.kur} onChange={e => setForm(p => ({ ...p, kur: e.target.value }))} placeholder="Otomatik" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Vade (gün)</label>
              <input type="number" value={form.vade_gun} onChange={e => setForm(p => ({ ...p, vade_gun: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          {/* Maliyet */}
          <div className="pt-3 border-t border-[--color-graphite]">
            <div className="text-xs text-info font-semibold mb-2">MALİYET</div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-[--color-text-muted] mb-1 block">İplik <span className="text-info text-[10px]">(Tutar %40)</span></label>
                <input type="number" step="0.01" value={form.maliyet_iplik} onChange={e => setForm(p => ({ ...p, maliyet_iplik: e.target.value }))} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[--color-text-muted] mb-1 block">Boya <span className="text-info text-[10px]">(Tutar %20)</span></label>
                <input type="number" step="0.01" value={form.maliyet_boya} onChange={e => setForm(p => ({ ...p, maliyet_boya: e.target.value }))} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[--color-text-muted] mb-1 block">Navlun <span className="text-info text-[10px]">(Manuel)</span></label>
                <input type="number" step="0.01" value={form.maliyet_navlun} onChange={e => setForm(p => ({ ...p, maliyet_navlun: e.target.value }))} placeholder="0" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-[--color-text-muted] mb-1 block">Toplam Maliyet</label>
                <div className="px-3 py-2 rounded-lg bg-[--color-steel]/50 border border-[--color-graphite] text-sm font-mono text-info">
                  {maskedEur((parseFloat(form.maliyet_iplik) || 0) + (parseFloat(form.maliyet_boya) || 0) + (parseFloat(form.maliyet_navlun) || 0), loggedIn)}
                </div>
              </div>
            </div>
          </div>
          {/* İplik Cinsi */}
          <div className="grid grid-cols-[minmax(0,1fr)_90px_16px_90px_16px_100px] gap-2 items-end">
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">İplik Cinsi</label>
              <select value={form.iplik_cinsi} onChange={e => setForm(p => ({ ...p, iplik_cinsi: e.target.value }))} className={inputCls}>
                <option value="">Seçiniz</option>
                <option value="Pamuk">Pamuk</option>
                <option value="Polyester">Polyester</option>
                <option value="Viskon">Viskon</option>
                <option value="Akrilik">Akrilik</option>
                <option value="Modal">Modal</option>
                <option value="Tencel">Tencel</option>
                <option value="Yün">Yün</option>
                <option value="Elastan">Elastan</option>
                <option value="Naylon">Naylon</option>
                <option value="Karışım">Karışım</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Miktar</label>
              <input type="number" step="0.01" value={form.iplik_miktar} onChange={e => setForm(p => ({ ...p, iplik_miktar: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
            <div className="flex items-center justify-center pb-2 text-[--color-text-muted] font-bold">×</div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Birim Fiyat</label>
              <input type="number" step="0.01" value={form.iplik_birim_fiyat} onChange={e => setForm(p => ({ ...p, iplik_birim_fiyat: e.target.value }))} placeholder="0" className={inputCls} />
            </div>
            <div className="flex items-center justify-center pb-2 text-[--color-text-muted] font-bold">=</div>
            <div>
              <label className="text-xs text-[--color-text-muted] mb-1 block">Sonuç</label>
              <div className="px-3 py-2 rounded-lg bg-[--color-steel]/50 border border-[--color-graphite] text-sm font-mono text-info">
                {maskedEur((parseFloat(form.iplik_miktar) || 0) * (parseFloat(form.iplik_birim_fiyat) || 0), loggedIn)}
              </div>
            </div>
          </div>
          {/* Boyahane */}
          <div>
            <label className="text-xs text-[--color-text-muted] mb-1 block">Boyahane</label>
            <select value={form.boyahane} onChange={e => setForm(p => ({ ...p, boyahane: e.target.value }))} className={inputCls}>
              <option value="">Seçiniz</option>
              <option value="Aslı">Aslı</option>
              <option value="Nesa">Nesa</option>
              <option value="Altınbaşak">Altınbaşak</option>
              <option value="Yağmur">Yağmur</option>
            </select>
          </div>
          <div className="flex gap-2 pt-3 border-t border-[--color-graphite]">
            <button onClick={handleSubmit} disabled={!currentUser} className="px-5 py-2 rounded-lg bg-info text-white text-sm font-medium hover:bg-info/80 disabled:opacity-50">{editId ? 'Güncelle' : 'Ekle'}</button>
            <button onClick={resetForm} className="px-5 py-2 rounded-lg border border-[--color-graphite] text-[--color-text-muted] text-sm hover:bg-[--color-steel]">İptal</button>
            {!currentUser && <span className="text-xs text-red-400 self-center">Önce kullanıcı seçin</span>}
          </div>
        </div>
      </Modal>

      {/* Table */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-graphite]">
          <h3 className="text-sm font-semibold text-info">SİPARİŞLER</h3>
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
            <button onClick={() => { resetForm(); setShowForm(true); fetchSiparisKur(new Date().toISOString().slice(0, 10)) }}
              disabled={!currentUser}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-info text-white text-xs font-medium hover:bg-info/80 disabled:opacity-50">
              <Plus size={12} /> Ekle
            </button>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[24px_85px_minmax(0,1fr)_90px_90px_110px_40px_55px_45px_48px] border-b border-[--color-graphite] px-1">
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

        {/* Week groups */}
        {weeks.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[--color-text-muted]">Henüz sipariş kaydı yok</div>
        ) : (
          weeks.map(wg => (
            <Fragment key={`sw-${wg.year}-${wg.week}`}>
              {/* Week header */}
              <div className="px-3 py-1.5 bg-info/5 border-b border-[--color-graphite]/50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-info bg-info/10 px-2 py-0.5 rounded">H{wg.week}</span>
                  <span className="text-[10px] text-[--color-text-muted]">{getWeekDateRange(wg.year, wg.week)}</span>
                  <span className="text-[10px] text-info/60">{wg.items.length} sipariş · {maskedEur(wg.items.filter(s => !s.hesap_disi).reduce((sum, s) => sum + (s.tutar_eur || s.tutar), 0), loggedIn)}</span>
                </div>
              </div>
              {/* Rows */}
              {wg.items.map(s => (
                <div key={s.id} className={`grid grid-cols-[24px_85px_minmax(0,1fr)_90px_90px_110px_40px_55px_45px_48px] px-1 h-9 overflow-hidden border-b border-[--color-graphite]/50 hover:bg-[--color-steel]/30 ${s.hesap_disi ? 'opacity-40' : ''}`}>
                  <div className="flex items-center justify-center">
                    <button onClick={async () => {
                      if (!currentUser) return
                      await api.kenanUpdateSiparis(s.id, { ...s, hesap_disi: s.hesap_disi ? 0 : 1, user: currentUser })
                      load()
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
                        load()
                      }} className={`text-[10px] px-1.5 py-0.5 rounded-full cursor-pointer hover:opacity-80 ${s.durum === 'tamamlandi' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                        {DURUM_LABELS[s.durum] || s.durum}
                      </button>
                    )}
                  </div>
                  <div className="px-1 py-2 text-center text-[10px] text-[--color-text-muted] truncate">{s.updated_by || '-'}</div>
                  <div className="py-2 flex gap-0.5 justify-end">
                    <button onClick={async () => {
                      if (!currentUser) return
                      if (plannedIds.has(s.id)) {
                        const planData = await api.kenanGetPlanlama()
                        const planItem = planData.find((p: any) => p.siparis_id === s.id)
                        if (planItem) await api.kenanRemovePlanlama(planItem.id)
                      } else {
                        await api.kenanAddPlanlama(s.id, currentUser)
                      }
                      load()
                    }} className={plannedIds.has(s.id) ? 'text-amber-400' : 'text-[--color-text-muted] hover:text-amber-400'} title={plannedIds.has(s.id) ? 'Planlamadan çıkar' : 'Planlamaya ekle'}><CalendarCheck size={11} /></button>
                    <button onClick={() => { if (!currentUser) return; startEdit(s) }} className="text-[--color-text-muted] hover:text-info"><Edit3 size={11} /></button>
                    <button onClick={async () => { if (!currentUser) return; if (confirm('Sil?')) { await api.kenanDeleteSiparis(s.id, currentUser); load() } }} className="text-[--color-text-muted] hover:text-red-400"><Trash2 size={11} /></button>
                  </div>
                </div>
              ))}
            </Fragment>
          ))
        )}

        {/* Footer */}
        <div className="px-3 py-2 border-t border-[--color-graphite] text-xs text-[--color-text-muted]">{siparisler.length} sipariş</div>
      </div>
    </div>
  )
}
