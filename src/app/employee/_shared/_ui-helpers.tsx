'use client'

// Helpers compartidos entre NotesTab y BitacoraTab.
// Centraliza avatar con iniciales, grouping por fecha relativa.

import {
  isToday,
  isYesterday,
  isThisWeek,
  isThisYear,
  format,
} from 'date-fns'
import { es } from 'date-fns/locale'

// ────────────── Avatar con iniciales ──────────────

const AVATAR_PALETTE = [
  { bg: 'bg-indigo-500', text: 'text-white' },
  { bg: 'bg-emerald-500', text: 'text-white' },
  { bg: 'bg-amber-500', text: 'text-white' },
  { bg: 'bg-rose-500', text: 'text-white' },
  { bg: 'bg-sky-500', text: 'text-white' },
  { bg: 'bg-violet-500', text: 'text-white' },
  { bg: 'bg-teal-500', text: 'text-white' },
  { bg: 'bg-orange-500', text: 'text-white' },
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0
  return Math.abs(h)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function authorColors(name: string | null | undefined, role?: string | null) {
  // Sistema y null = gris neutro
  if (!name || role === 'system') return { bg: 'bg-slate-300', text: 'text-slate-700' }
  return AVATAR_PALETTE[hashString(name) % AVATAR_PALETTE.length]
}

export function Avatar({
  name,
  role,
  size = 'md',
}: {
  name: string | null | undefined
  role?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const colors = authorColors(name, role)
  const dims =
    size === 'sm' ? 'w-7 h-7 text-[10px]' :
    size === 'lg' ? 'w-10 h-10 text-sm' :
    'w-8 h-8 text-xs'
  return (
    <div
      className={`flex-shrink-0 rounded-full flex items-center justify-center font-semibold ${colors.bg} ${colors.text} ${dims}`}
      aria-hidden="true"
      title={name ?? 'Sin autor'}
    >
      {getInitials(name ?? '?')}
    </div>
  )
}

// ────────────── Date grouping (Hoy / Ayer / Esta semana / Antes) ──────────────

export type DateGroupKey = 'today' | 'yesterday' | 'this_week' | 'older'

export const DATE_GROUP_LABELS: Record<DateGroupKey, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  this_week: 'Esta semana',
  older: 'Anteriores',
}

export function getDateGroup(d: Date): DateGroupKey {
  if (isToday(d)) return 'today'
  if (isYesterday(d)) return 'yesterday'
  if (isThisWeek(d, { weekStartsOn: 1 })) return 'this_week'
  return 'older'
}

export function formatDateGroupHeader(group: DateGroupKey, sample: Date): string {
  if (group === 'older') {
    return isThisYear(sample)
      ? format(sample, 'MMMM', { locale: es }).replace(/^./, c => c.toUpperCase())
      : format(sample, 'MMMM yyyy', { locale: es }).replace(/^./, c => c.toUpperCase())
  }
  return DATE_GROUP_LABELS[group]
}

// Generic grouper: agrupa lista cronológica DESC por bucket de fecha.
// Para 'older' subdivide por mes (sin mezclar meses).
export function groupByDate<T>(
  items: T[],
  getDate: (item: T) => Date,
): Array<{ key: string; label: string; items: T[] }> {
  const groups: Array<{ key: string; label: string; items: T[]; firstDate: Date }> = []
  for (const it of items) {
    const d = getDate(it)
    const grp = getDateGroup(d)
    if (grp === 'older') {
      // Subdivide por mes-año para no mezclar
      const monthKey = `older-${d.getFullYear()}-${d.getMonth()}`
      const existing = groups.find((g) => g.key === monthKey)
      if (existing) existing.items.push(it)
      else
        groups.push({
          key: monthKey,
          label: formatDateGroupHeader('older', d),
          items: [it],
          firstDate: d,
        })
    } else {
      const existing = groups.find((g) => g.key === grp)
      if (existing) existing.items.push(it)
      else
        groups.push({
          key: grp,
          label: DATE_GROUP_LABELS[grp],
          items: [it],
          firstDate: d,
        })
    }
  }
  return groups.map(({ key, label, items }) => ({ key, label, items }))
}
