import { useState, useCallback } from 'react'
import { api } from './api'

// ==================== CONSTANTS ====================
export const DURUM_OPTIONS = ['beklemede', 'tamamlandi']
export const DURUM_LABELS: Record<string, string> = { beklemede: 'Beklemede', tamamlandi: 'Tamamlandı' }
export const BASLANGIC_BAKIYE = -1565867.46
export const inputCls = "w-full px-3 py-2 rounded-lg bg-[--color-steel] border border-[--color-graphite] text-sm text-[--color-text-primary] focus:outline-none focus:border-copper"

// ==================== TYPES ====================
export interface Odeme {
  id: string; tarih: string; odeme_adi: string; tl_tutar: number; tutar_eur: number; kur: number;
  tl_karsiligi: number; doviz: string; durum: string; donem: string; notlar: string; updated_by: string;
  hesap_disi: number; planlamada: number;
}

export interface Siparis {
  id: string; tarih: string; fatura_no: string; musteri: string; siparis_no: string;
  tutar: number; kur: number; doviz: string; tutar_eur: number; vade_gun: number;
  durum: string; notlar: string; updated_by: string;
  hesap_disi: number;
}

// ==================== FORMAT FUNCTIONS ====================
export function formatEur(val: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' €'
}
export function formatTl(val: number): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val) + ' ₺'
}
export function formatCurrency(val: number, doviz?: string): string {
  const formatted = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
  const symbol = doviz === 'EUR' ? ' €' : doviz === 'USD' ? ' $' : ' ₺'
  return formatted + symbol
}
export function formatKur(val: number | null | undefined): string {
  if (!val) return '-'
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)
}
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ==================== WEEK FUNCTIONS ====================
export function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function getWeekDateRange(year: number, week: number): string {
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

export function groupByWeek<T extends { tarih: string }>(items: T[]): { week: number; year: number; items: T[] }[] {
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

// ==================== MASKING ====================
export function maskedEur(val: number, loggedIn: boolean): string {
  return loggedIn ? formatEur(val) : '****'
}
export function maskedTl(val: number, loggedIn: boolean): string {
  return loggedIn ? formatTl(val) : '****'
}
export function maskedCurrency(val: number, loggedIn: boolean, doviz?: string): string {
  return loggedIn ? formatCurrency(val, doviz) : '****'
}

// ==================== KUR HOOK ====================
export function useKur() {
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
