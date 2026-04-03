import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Package } from 'lucide-react'
import { api } from '../lib/api'

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  return `${parts[2]}.${parts[1]}.${parts[0]}`
}

function maskedEur(val: number, loggedIn: boolean): string {
  if (!loggedIn) return '****'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' \u20AC'
}

function formatKg(val: number): string {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(val)
}

interface TedarikDetay {
  musteri: string; siparis_no: string; termin: string; cinsi: string;
  miktar: number; birim_fiyat: number; doviz: string; toplam_eur: number;
}

interface TedarikGrup {
  cinsi: string; toplam_kg: number; toplam_eur: number; adet: number; detay: TedarikDetay[];
}

export function TedarikPlanlamaSection({ currentUser }: { currentUser: string }) {
  const loggedIn = !!currentUser
  const [data, setData] = useState<TedarikGrup[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    try {
      const result = await api.kenanGetTedarikPlanlama()
      setData(result)
    } catch (e) {
      console.error('Tedarik veri yuklenemedi:', e)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggleExpand = (cinsi: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cinsi)) next.delete(cinsi); else next.add(cinsi)
      return next
    })
  }

  const genelToplamKg = data.reduce((s, g) => s + g.toplam_kg, 0)
  const genelToplamEur = data.reduce((s, g) => s + g.toplam_eur, 0)
  const genelToplamAdet = data.reduce((s, g) => s + g.adet, 0)

  return (
    <div className="space-y-4">
      {/* Ozet kartlari */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl px-4 py-3">
          <div className="text-xs text-[--color-text-muted] mb-1">Toplam Iplik Cinsi</div>
          <div className="text-lg font-bold text-purple-400 font-mono">{data.length}</div>
          <div className="text-[10px] text-[--color-text-muted]">{genelToplamAdet} kalem</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl px-4 py-3">
          <div className="text-xs text-[--color-text-muted] mb-1">Toplam Miktar</div>
          <div className="text-lg font-bold text-purple-400 font-mono">{formatKg(genelToplamKg)} kg</div>
        </div>
        <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl px-4 py-3">
          <div className="text-xs text-[--color-text-muted] mb-1">Toplam Maliyet</div>
          <div className="text-lg font-bold text-purple-400 font-mono">{maskedEur(genelToplamEur, loggedIn)}</div>
        </div>
      </div>

      {/* Ana tablo */}
      <div className="bg-[--color-slate] border border-[--color-graphite] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-graphite]">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-purple-400">TEDARiK PLANLAMA</h3>
            <span className="text-[10px] text-[--color-text-muted]">Iplik cinsi bazli toplam</span>
          </div>
        </div>

        {/* Header */}
        <div className="grid grid-cols-[24px_minmax(0,1fr)_100px_130px_60px] px-3 border-b border-[--color-graphite]">
          <div></div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted]">Iplik Cinsi</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Toplam KG</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-right">Toplam EUR</div>
          <div className="px-2 py-2 text-xs text-[--color-text-muted] text-center">Kalem</div>
        </div>

        {data.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[--color-text-muted]">
            Iplik maliyet verisi bulunamadi
          </div>
        ) : (
          <div>
            {data.map(grup => {
              const isOpen = expanded.has(grup.cinsi)
              return (
                <div key={grup.cinsi}>
                  {/* Grup satiri */}
                  <div
                    className="grid grid-cols-[24px_minmax(0,1fr)_100px_130px_60px] px-3 h-10 items-center border-b border-[--color-graphite]/30 hover:bg-purple-400/5 cursor-pointer transition-colors"
                    onClick={() => toggleExpand(grup.cinsi)}
                  >
                    <div className="flex items-center justify-center text-purple-400/60">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <div className="px-2 text-sm font-medium text-purple-300 truncate">{grup.cinsi}</div>
                    <div className="px-2 text-right text-sm font-mono font-semibold text-purple-400">{formatKg(grup.toplam_kg)} kg</div>
                    <div className="px-2 text-right text-sm font-mono text-purple-400 whitespace-nowrap">{maskedEur(grup.toplam_eur, loggedIn)}</div>
                    <div className="px-2 text-center text-[10px] text-[--color-text-muted]">{grup.adet}</div>
                  </div>

                  {/* Detay satirlari */}
                  {isOpen && (
                    <div className="bg-[--color-midnight]/30">
                      {/* Detay header */}
                      <div className="grid grid-cols-[32px_80px_minmax(0,1fr)_70px_80px_70px_90px] px-3 border-b border-purple-400/10">
                        <div></div>
                        <div className="px-2 py-1.5 text-[10px] text-purple-400/50">Termin</div>
                        <div className="px-2 py-1.5 text-[10px] text-purple-400/50">Musteri</div>
                        <div className="px-2 py-1.5 text-[10px] text-purple-400/50">Siparis</div>
                        <div className="px-2 py-1.5 text-[10px] text-purple-400/50 text-right">Miktar</div>
                        <div className="px-2 py-1.5 text-[10px] text-purple-400/50 text-right">Birim</div>
                        <div className="px-2 py-1.5 text-[10px] text-purple-400/50 text-right">Toplam</div>
                      </div>
                      {grup.detay.map((d, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[32px_80px_minmax(0,1fr)_70px_80px_70px_90px] px-3 h-8 items-center border-b border-purple-400/5 hover:bg-purple-400/5 transition-colors"
                        >
                          <div className="flex items-center justify-center text-purple-400/20">
                            {i === grup.detay.length - 1 ? '\u2514' : '\u251C'}
                          </div>
                          <div className="px-2 text-xs font-mono text-[--color-text-primary]">{formatDate(d.termin)}</div>
                          <div className="px-2 text-xs text-[--color-text-primary] truncate" title={d.musteri}>{d.musteri}</div>
                          <div className="px-2 text-xs text-[--color-text-muted] truncate">{d.siparis_no || '-'}</div>
                          <div className="px-2 text-right text-xs font-mono text-purple-400/80">{formatKg(d.miktar)} kg</div>
                          <div className="px-2 text-right text-[10px] font-mono text-[--color-text-muted]">{new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(d.birim_fiyat)} {d.doviz}</div>
                          <div className="px-2 text-right text-xs font-mono text-purple-400">{maskedEur(d.toplam_eur, loggedIn)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Genel toplam */}
            <div className="grid grid-cols-[24px_minmax(0,1fr)_100px_130px_60px] px-3 h-10 items-center bg-purple-400/10 border-t border-purple-400/20">
              <div></div>
              <div className="px-2 text-sm font-semibold text-purple-300">TOPLAM</div>
              <div className="px-2 text-right text-sm font-mono font-bold text-purple-400">{formatKg(genelToplamKg)} kg</div>
              <div className="px-2 text-right text-sm font-mono font-bold text-purple-400 whitespace-nowrap">{maskedEur(genelToplamEur, loggedIn)}</div>
              <div className="px-2 text-center text-[10px] text-[--color-text-muted]">{genelToplamAdet}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
