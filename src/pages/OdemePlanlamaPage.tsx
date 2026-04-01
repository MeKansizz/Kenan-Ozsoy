import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, GripVertical, Plus, CalendarX2 } from 'lucide-react'
import { api } from '../lib/api'

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  return `${parts[2]}.${parts[1]}`
}

function maskedEur(val: number, loggedIn: boolean): string {
  if (!loggedIn) return '****'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' €'
}

interface Odeme {
  id: string; tarih: string; odeme_adi: string; tl_tutar: number; tutar_eur: number; kur: number;
  doviz: string; durum: string; updated_by: string; hesap_disi: number; planlamada: number; plan_sira: number | null;
}

interface PlanItem {
  id: string; siparis_id: string; sira: number; created_by: string;
  tarih: string; musteri: string; siparis_no: string; fatura_no: string;
  tutar: number; kur: number; doviz: string; tutar_eur: number; vade_gun: number; durum: string;
}

interface Marker {
  id: string; sira: number; label: string;
}

type SolItem =
  | { type: 'odeme'; data: Odeme; sira: number }
  | { type: 'plan'; data: PlanItem; sira: number }
  | { type: 'marker'; data: Marker; sira: number }

interface DropData { plan_id?: string; odeme_id?: string; marker_id?: string }

function extractDropData(e: React.DragEvent): DropData | null {
  const planId = e.dataTransfer.getData('plan_id')
  const odemeId = e.dataTransfer.getData('odeme_id')
  const markerId = e.dataTransfer.getData('marker_id')
  if (!planId && !odemeId && !markerId) return null
  return { plan_id: planId || undefined, odeme_id: odemeId || undefined, marker_id: markerId || undefined }
}

export function OdemePlanlamaSection({ currentUser }: { currentUser: string }) {
  const loggedIn = !!currentUser
  const [odemeler, setOdemeler] = useState<Odeme[]>([])
  const [planItems, setPlanItems] = useState<PlanItem[]>([])
  const [markers, setMarkers] = useState<Marker[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [dropTarget, setDropTarget] = useState<{ idx: number; pos: 'before' | 'after' } | null>(null)

  const loadAll = useCallback(async () => {
    try {
      const [o, p, m] = await Promise.all([
        api.kenanGetOdemeler(),
        api.kenanGetPlanlama(),
        api.kenanGetPlanMarkers(),
      ])
      setOdemeler(o)
      setPlanItems(p)
      setMarkers(m)
    } catch (e) {
      console.error('Veri yüklenemedi:', e)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Sadece planlamada=1 olan ödemeler + plan items + markers
  const solItems = useMemo((): SolItem[] => {
    const items: SolItem[] = []
    odemeler.filter(o => o.planlamada && !o.hesap_disi).forEach(o => {
      items.push({ type: 'odeme', data: o, sira: o.plan_sira ?? 0 })
    })
    planItems.forEach(p => items.push({ type: 'plan', data: p, sira: p.sira }))
    markers.forEach(m => items.push({ type: 'marker', data: m, sira: m.sira }))
    items.sort((a, b) => a.sira - b.sira)
    return items
  }, [odemeler, planItems, markers])

  // Toplamlar
  const odemeTotal = useMemo(() => odemeler.filter(o => o.planlamada && !o.hesap_disi).reduce((s, o) => s + o.tutar_eur, 0), [odemeler])
  const planTotal = useMemo(() => planItems.reduce((s, p) => s + (p.tutar_eur || p.tutar), 0), [planItems])

  // Drag handlers
  const handleDragStartPlan = (e: React.DragEvent, planId: string) => {
    e.dataTransfer.setData('plan_id', planId); e.dataTransfer.effectAllowed = 'move'; setIsDragging(true)
  }
  const handleDragStartOdeme = (e: React.DragEvent, odemeId: string) => {
    e.dataTransfer.setData('odeme_id', odemeId); e.dataTransfer.effectAllowed = 'move'; setIsDragging(true)
  }
  const handleDragStartMarker = (e: React.DragEvent, markerId: string) => {
    e.dataTransfer.setData('marker_id', markerId); e.dataTransfer.effectAllowed = 'move'; setIsDragging(true)
  }
  const handleDragEnd = () => { setIsDragging(false); setDropTarget(null) }

  const handleRowDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    setDropTarget(prev => (prev?.idx === idx && prev?.pos === pos) ? prev : { idx, pos })
  }

  const handleRowDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    const data = extractDropData(e)
    if (!data) return
    const rect = e.currentTarget.getBoundingClientRect()
    const positionIndex = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1
    handleDropAtPosition(data, positionIndex)
    setDropTarget(null)
  }

  const calcSira = (positionIndex: number) => {
    const prevSira = positionIndex > 0 ? solItems[positionIndex - 1].sira : 0
    const nextSira = positionIndex < solItems.length ? solItems[positionIndex].sira : prevSira + 1
    return (prevSira + nextSira) / 2
  }

  const handleDropAtPosition = async (data: DropData, positionIndex: number) => {
    if (!currentUser) return
    const newSira = calcSira(positionIndex)
    try {
      if (data.plan_id) await api.kenanUpdatePlanlamaSira(data.plan_id, newSira)
      else if (data.odeme_id) await api.kenanUpdateOdemePlanSira(data.odeme_id, newSira)
      else if (data.marker_id) await api.kenanUpdatePlanMarkerSira(data.marker_id, newSira)
      setIsDragging(false)
      loadAll()
    } catch (err) {
      console.error('İşlem başarısız:', err)
    }
  }

  const handleAddMarker = async () => {
    if (!currentUser) return
    const lastSira = solItems.length > 0 ? solItems[solItems.length - 1].sira + 1 : 1
    try { await api.kenanCreatePlanMarker(lastSira); loadAll() } catch {}
  }

  const handleRemoveMarker = async (markerId: string) => {
    try { await api.kenanDeletePlanMarker(markerId); loadAll() } catch {}
  }

  const handleRemoveOdeme = async (odemeId: string) => {
    if (!currentUser) return
    try { await api.kenanToggleOdemePlanlamada(odemeId, false); loadAll() } catch {}
  }

  const handleRemovePlan = async (planId: string) => {
    if (!currentUser) return
    try { await api.kenanRemovePlanlama(planId); loadAll() } catch {}
  }

  // Running balance
  const runningBalances = useMemo(() => {
    let bal = 0
    return solItems.map(item => {
      if (item.type === 'odeme') bal -= (item.data as Odeme).tutar_eur
      else if (item.type === 'plan') {
        const p = item.data as PlanItem
        bal += (p.tutar_eur || p.tutar)
      }
      return bal
    })
  }, [solItems])

  const odemeCount = odemeler.filter(o => o.planlamada && !o.hesap_disi).length
  const planCount = planItems.length

  return (
    <div className="space-y-4">
      {/* Özet kartları */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl px-4 py-3">
          <div className="text-xs text-[--color-text-muted]">Planlanan Ödemeler</div>
          <div className="text-lg font-bold text-copper font-mono">{maskedEur(odemeTotal, loggedIn)}</div>
          <div className="text-[10px] text-[--color-text-muted]">{odemeCount} ödeme</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl px-4 py-3">
          <div className="text-xs text-[--color-text-muted]">Planlanan Siparişler</div>
          <div className="text-lg font-bold text-emerald-400 font-mono">+{maskedEur(planTotal, loggedIn)}</div>
          <div className="text-[10px] text-[--color-text-muted]">{planCount} sipariş</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl px-4 py-3">
          <div className="text-xs text-[--color-text-muted]">Denge (Sipariş - Ödeme)</div>
          <div className={`text-lg font-bold font-mono ${planTotal - odemeTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {maskedEur(planTotal - odemeTotal, loggedIn)}
          </div>
        </div>
      </div>

      {/* Ana panel */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl overflow-hidden">
        <div className="grid grid-cols-2">
          {/* Sol başlık */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-graphite] border-r border-r-[--color-graphite]">
            <h3 className="text-sm font-semibold text-copper">PLANLAMA</h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[--color-text-muted]">Sipariş & Ödeme sayfasından işaretle</span>
              <button
                onClick={handleAddMarker}
                disabled={!currentUser}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Boş bakiye satırı ekle"
              >
                <Plus size={10} />Satır Ekle
              </button>
            </div>
          </div>
          {/* Sağ başlık */}
          <div className="flex items-center px-4 py-3 border-b border-[--color-graphite]">
            <h3 className="text-sm font-semibold text-[--color-text-muted]">&nbsp;</h3>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-2 border-b border-[--color-graphite]">
          <div className="grid grid-cols-[16px_70px_minmax(0,1fr)_100px_100px_70px_24px] border-r border-[--color-graphite] px-1">
            <div></div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Tarih</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted]">Açıklama</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">EUR</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Bakiye</div>
            <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Tip</div>
            <div></div>
          </div>
          <div className="px-4 py-2"></div>
        </div>

        {/* Data area */}
        <div className="grid grid-cols-2" style={{ minHeight: '300px' }}>
          {/* Sol: Planlamaya eklenen ödemeler + siparişler */}
          <div className="border-r border-[--color-graphite]" onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTarget(null) }}>
            {solItems.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm">
                <div className="text-[--color-text-muted]">
                  Henüz kayıt yok — Sipariş & Ödeme sayfasındaki <span className="text-amber-400">takvim ikonuna</span> tıklayarak ekle
                </div>
              </div>
            ) : (
              solItems.map((item, idx) => {
                const showTopLine = dropTarget?.idx === idx && dropTarget.pos === 'before'
                const showBottomLine = dropTarget?.idx === idx && dropTarget.pos === 'after'

                if (item.type === 'marker') {
                  const m = item.data as Marker
                  return (
                    <div
                      key={`m-${m.id}`}
                      draggable
                      onDragStart={e => handleDragStartMarker(e, m.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => handleRowDragOver(e, idx)}
                      onDrop={e => handleRowDrop(e, idx)}
                      className={`grid grid-cols-[16px_1fr_100px_24px] px-1 h-9 overflow-hidden border-b-2 border-dashed border-amber-400/40 bg-amber-400/5 cursor-grab active:cursor-grabbing ${showTopLine ? 'border-t-2 border-t-emerald-400' : ''} ${showBottomLine ? '!border-b-2 !border-b-emerald-400 !border-solid' : ''}`}
                    >
                      <div className="flex items-center justify-center text-amber-400/60"><GripVertical size={10} /></div>
                      <div className="px-2 py-2 text-[11px] text-amber-400/70 flex items-center gap-2">
                        <span className="border-t border-dashed border-amber-400/30 flex-1" />
                        <span>BAKİYE NOKTASI</span>
                        <span className="border-t border-dashed border-amber-400/30 flex-1" />
                      </div>
                      <div className={`px-2 py-2 text-right text-sm font-bold font-mono whitespace-nowrap ${runningBalances[idx] >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {maskedEur(runningBalances[idx], loggedIn)}
                      </div>
                      <div className="flex items-center justify-center">
                        <button onClick={() => handleRemoveMarker(m.id)} className="text-amber-400/40 hover:text-red-400" title="Satırı sil"><X size={10} /></button>
                      </div>
                    </div>
                  )
                }

                return item.type === 'odeme' ? (
                  <div
                    key={`o-${(item.data as Odeme).id}`}
                    draggable
                    onDragStart={e => handleDragStartOdeme(e, (item.data as Odeme).id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => handleRowDragOver(e, idx)}
                    onDrop={e => handleRowDrop(e, idx)}
                    className={`grid grid-cols-[16px_70px_minmax(0,1fr)_100px_100px_70px_24px] px-1 h-9 overflow-hidden border-b border-[--color-graphite]/30 cursor-grab active:cursor-grabbing ${showTopLine ? 'border-t-2 border-t-emerald-400' : ''} ${showBottomLine ? 'border-b-2 border-b-emerald-400' : ''}`}
                  >
                    <div className="flex items-center justify-center text-[--color-text-muted]"><GripVertical size={10} /></div>
                    <div className="px-2 py-2 text-sm text-[--color-text-primary] whitespace-nowrap">{formatDate((item.data as Odeme).tarih)}</div>
                    <div className="px-2 py-2 text-sm text-[--color-text-primary] min-w-0 truncate" title={(item.data as Odeme).odeme_adi}>{(item.data as Odeme).odeme_adi}</div>
                    <div className="px-2 py-2 text-right text-sm font-mono text-copper whitespace-nowrap">-{maskedEur((item.data as Odeme).tutar_eur, loggedIn)}</div>
                    <div className={`px-2 py-2 text-right text-[11px] font-mono whitespace-nowrap ${runningBalances[idx] >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {maskedEur(runningBalances[idx], loggedIn)}
                    </div>
                    <div className="px-2 py-2 text-center">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-copper/10 text-copper">Ödeme</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <button onClick={() => handleRemoveOdeme((item.data as Odeme).id)} disabled={!currentUser} className="text-[--color-text-muted]/40 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed" title="Planlamadan çıkar"><CalendarX2 size={11} /></button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`p-${(item.data as PlanItem).id}`}
                    draggable
                    onDragStart={e => handleDragStartPlan(e, (item.data as PlanItem).id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => handleRowDragOver(e, idx)}
                    onDrop={e => handleRowDrop(e, idx)}
                    className={`grid grid-cols-[16px_70px_minmax(0,1fr)_100px_100px_70px_24px] px-1 h-9 overflow-hidden border-b border-[--color-graphite]/30 bg-emerald-400/5 cursor-grab active:cursor-grabbing ${showTopLine ? 'border-t-2 border-t-emerald-400' : ''} ${showBottomLine ? 'border-b-2 border-b-emerald-400' : ''}`}
                  >
                    <div className="flex items-center justify-center text-[--color-text-muted]"><GripVertical size={10} /></div>
                    <div className="px-2 py-2 text-sm text-[--color-text-primary] whitespace-nowrap">{formatDate((item.data as PlanItem).tarih)}</div>
                    <div className="px-2 py-2 text-sm text-emerald-300 min-w-0 truncate" title={(item.data as PlanItem).musteri}>{(item.data as PlanItem).musteri}</div>
                    <div className="px-2 py-2 text-right text-sm font-mono text-emerald-400 whitespace-nowrap">+{maskedEur((item.data as PlanItem).tutar_eur || (item.data as PlanItem).tutar, loggedIn)}</div>
                    <div className={`px-2 py-2 text-right text-[11px] font-mono whitespace-nowrap ${runningBalances[idx] >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {maskedEur(runningBalances[idx], loggedIn)}
                    </div>
                    <div className="px-2 py-2 flex items-center justify-center gap-1">
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">Sipariş</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <button onClick={() => handleRemovePlan((item.data as PlanItem).id)} disabled={!currentUser} className="text-[--color-text-muted]/40 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed" title="Planlamadan çıkar"><CalendarX2 size={11} /></button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Sağ: Şimdilik boş */}
          <div className="flex items-center justify-center">
            <div className="text-sm text-[--color-text-muted]/30">—</div>
          </div>
        </div>
      </div>
    </div>
  )
}
