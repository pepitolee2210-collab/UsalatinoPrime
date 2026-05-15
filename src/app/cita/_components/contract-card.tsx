'use client'

import { ChevronRight, Users, FileText, Sparkles } from 'lucide-react'

export interface ContractMinor {
  fullName: string
  dob: string | null
  passport: string | null
}

export interface ContractCardData {
  contract_id: string
  case_id: string
  case_number: string
  service_slug: string
  service_name: string
  subservice_slug: string | null
  intake_status: string | null
  current_phase: string | null
  signed_at: string | null
  minors: ContractMinor[]
  token: string
}

const PHASE_LABELS: Record<string, string> = {
  custodia: 'En custodia',
  i360: 'I-360',
  i485: 'I-485 (ajuste de estatus)',
  asilo_sustentos: 'Sustentos',
  asilo_reforzar: 'Reforzar Asilo',
  asilo_completado: 'Completado',
}

const SUBSERVICE_BADGES: Record<string, string> = {
  completa: 'Proceso completo',
  i360: 'I-360',
  i485: 'I-485',
  'i360-i485': 'I-360 + I-485',
  // Asilo Político
  completo: 'Proceso completo',
  'solo-reforzar': 'Solo Reforzar',
}

function formatMinors(minors: ContractMinor[]): string {
  if (minors.length === 0) return 'Sin menores asociados'
  const firstNames = minors.map((m) => m.fullName.split(/\s+/)[0]).filter(Boolean)
  if (firstNames.length <= 3) return firstNames.join(', ')
  return `${firstNames.slice(0, 2).join(', ')} y ${firstNames.length - 2} más`
}

function formatSignedAt(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('es-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export function ContractCard({ data, href }: { data: ContractCardData; href: string }) {
  const phaseLabel = data.current_phase ? PHASE_LABELS[data.current_phase] : null
  const subserviceBadge = data.subservice_slug
    ? SUBSERVICE_BADGES[data.subservice_slug] ?? null
    : null
  const isPromo = data.service_name.toLowerCase().includes('promo')
  const minorsLine = formatMinors(data.minors)
  const signed = formatSignedAt(data.signed_at)

  return (
    <a
      href={href}
      className="group block p-4 rounded-2xl border border-gray-200 bg-white hover:border-[#002855]/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#002855]/10 text-[#002855]">
              <FileText className="w-3.5 h-3.5" />
              {data.service_name || 'Caso'}
            </span>
            {subserviceBadge && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {subserviceBadge}
              </span>
            )}
            {isPromo && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                <Sparkles className="w-3 h-3" /> Promo
              </span>
            )}
          </div>

          <p className="font-semibold text-gray-900 text-base leading-tight mb-1">
            Caso {data.case_number}
          </p>

          <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-1">
            <Users className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="truncate">
              {data.minors.length > 0
                ? `${data.minors.length} ${data.minors.length === 1 ? 'menor' : 'menores'}: ${minorsLine}`
                : minorsLine}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
            {phaseLabel && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                {phaseLabel}
              </span>
            )}
            {signed && <span>Firmado {signed}</span>}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#002855] group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-1" />
      </div>
    </a>
  )
}
