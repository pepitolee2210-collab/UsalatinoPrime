'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Scale, Loader2, CheckCircle, AlertTriangle, AlertCircle, Info,
  Sparkles, Clock, ShieldCheck, ShieldAlert, FileWarning, RefreshCw,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Finding {
  severity: 'critical' | 'moderate' | 'suggestion'
  category: string
  location: string
  description: string
  recommendation: string
}

interface Review {
  id: string
  case_id: string
  service_slug: string | null
  playbook_name: string
  reviewer_model: string
  score: number
  ready_to_file: boolean
  summary: string
  findings: Finding[]
  strengths: string[]
  documents_reviewed: Array<{ name: string; type: string }>
  created_at: string
}

const SEVERITY_CONFIG: Record<Finding['severity'], {
  label: string
  bg: string
  border: string
  text: string
  icon: typeof AlertCircle
}> = {
  critical: { label: 'Crítico', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', icon: AlertCircle },
  moderate: { label: 'Moderado', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
  suggestion: { label: 'Sugerencia', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: Info },
}

function scoreColor(score: number) {
  if (score >= 90) return { ring: 'ring-emerald-400/50', text: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  if (score >= 70) return { ring: 'ring-amber-400/50', text: 'text-amber-500', bg: 'bg-amber-500/10' }
  if (score >= 50) return { ring: 'ring-orange-400/50', text: 'text-orange-500', bg: 'bg-orange-500/10' }
  return { ring: 'ring-red-400/50', text: 'text-red-500', bg: 'bg-red-500/10' }
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Listo para presentar'
  if (score >= 70) return 'Base sólida — pulir'
  if (score >= 50) return 'Requiere correcciones'
  return 'NO presentar aún'
}

interface Props {
  caseId: string
}

export function LegalReviewer({ caseId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/legal-review?case_id=${caseId}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setReviews(data.reviews || [])
    } catch {
      toast.error('Error al cargar historial de revisiones')
    } finally {
      setLoading(false)
    }
  }, [caseId])

  useEffect(() => { load() }, [load])

  async function runReview() {
    setRunning(true)
    try {
      const res = await fetch('/api/admin/legal-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_id: caseId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Error al ejecutar revisión')
        return
      }
      toast.success(`Revisión completada — puntaje ${data.review.score}/100`)
      await load()
    } catch {
      toast.error('Error de red')
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  const latest = reviews[0]

  return (
    <div className="space-y-5">
      {/* Header + CTA */}
      <div className="rounded-2xl border border-[#002855]/10 bg-gradient-to-br from-[#002855] to-[#001d3d] p-5 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Scale className="w-6 h-6 text-[#F2A900]" />
            </div>
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                Super Revisor Legal
                <Badge className="bg-white/10 text-white/80 text-[10px] border-white/10">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Gemini 3.1 Pro
                </Badge>
              </h3>
              <p className="text-sm text-white/70 mt-0.5 max-w-xl">
                Última revisión antes de la corte. Un abogado senior virtual analiza tus documentos contra el playbook del tipo de caso y te dice exactamente qué falta.
              </p>
            </div>
          </div>
          <Button
            size="lg"
            onClick={runReview}
            disabled={running}
            className="bg-[#F2A900] hover:bg-[#D4940A] text-[#001020] font-bold shadow-lg shadow-[#F2A900]/20"
          >
            {running ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analizando (20-40s)...
              </>
            ) : (
              <>
                <Scale className="w-4 h-4 mr-2" />
                {latest ? 'Volver a revisar' : 'Revisar con IA Legal'}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Latest review */}
      {!latest ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center">
            <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-2">Aún no hay revisiones para este caso.</p>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              Primero genera las declaraciones del caso (pestaña Declaraciones). Luego vuelve aquí y ejecuta la revisión legal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Score + verdict */}
          <Card className={`border-2 ${scoreColor(latest.score).ring.replace('ring-', 'border-').replace('/50', '/30')}`}>
            <CardContent className="p-6">
              <div className="flex items-start gap-6 flex-wrap">
                <div className={`relative w-28 h-28 rounded-full ${scoreColor(latest.score).bg} ring-4 ${scoreColor(latest.score).ring} flex items-center justify-center flex-shrink-0`}>
                  <div className="text-center">
                    <div className={`text-4xl font-bold ${scoreColor(latest.score).text} tabular-nums leading-none`}>
                      {latest.score}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">de 100</div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {latest.ready_to_file ? (
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <ShieldAlert className="w-5 h-5 text-amber-500" />
                      )}
                      {scoreLabel(latest.score)}
                    </h4>
                    <Badge className="bg-gray-100 text-gray-700 text-[10px]">
                      {latest.playbook_name}
                    </Badge>
                    <Badge className="bg-gray-100 text-gray-500 text-[10px] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(latest.created_at), { locale: es, addSuffix: true })}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {latest.summary}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Findings grouped by severity */}
          {latest.findings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileWarning className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-bold text-gray-900">
                  Hallazgos ({latest.findings.length})
                </h4>
                <div className="flex items-center gap-2 ml-auto text-xs">
                  {(['critical', 'moderate', 'suggestion'] as const).map(sev => {
                    const count = latest.findings.filter(f => f.severity === sev).length
                    if (count === 0) return null
                    const cfg = SEVERITY_CONFIG[sev]
                    return (
                      <span key={sev} className={`${cfg.text} font-medium`}>
                        {count} {cfg.label.toLowerCase()}
                      </span>
                    )
                  })}
                </div>
              </div>

              {(['critical', 'moderate', 'suggestion'] as const).map(sev => {
                const group = latest.findings.filter(f => f.severity === sev)
                if (group.length === 0) return null
                const cfg = SEVERITY_CONFIG[sev]
                const Icon = cfg.icon

                return group.map((finding, i) => (
                  <Card key={`${sev}-${i}`} className={`${cfg.bg} ${cfg.border} border`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`w-4 h-4 ${cfg.text}`} />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`${cfg.bg} ${cfg.text} border ${cfg.border} text-[10px] uppercase tracking-wide font-bold`}>
                              {cfg.label}
                            </Badge>
                            <code className="text-[10px] bg-white/60 text-gray-600 px-1.5 py-0.5 rounded">
                              {finding.category}
                            </code>
                            <span className="text-[11px] text-gray-500 truncate">
                              📍 {finding.location}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 font-medium">
                            {finding.description}
                          </p>
                          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                            <span className="font-bold uppercase tracking-wider text-[10px] text-gray-500 mr-1">Recomendación:</span>
                            {finding.recommendation}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              })}
            </div>
          )}

          {/* Strengths */}
          {latest.strengths.length > 0 && (
            <Card className="bg-emerald-50/40 border-emerald-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-bold text-emerald-900">Fortalezas del caso</h4>
                </div>
                <ul className="space-y-1.5">
                  {latest.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-emerald-900/90 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Documents reviewed */}
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-2">
                Documentos revisados en esta ejecución:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {latest.documents_reviewed.map((d, i) => (
                  <Badge key={i} className="bg-white text-gray-700 border border-gray-200 font-normal text-[11px]">
                    {d.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* History */}
          {reviews.length > 1 && (
            <details className="rounded-xl border border-gray-200 bg-white">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5" />
                Historial ({reviews.length - 1} revisiones anteriores)
              </summary>
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {reviews.slice(1).map(r => (
                  <div key={r.id} className="px-4 py-2.5 text-xs flex items-center gap-3">
                    <span className={`font-bold tabular-nums ${scoreColor(r.score).text}`}>
                      {r.score}
                    </span>
                    <span className="text-gray-500">{r.playbook_name}</span>
                    <span className="text-gray-400 ml-auto">
                      {format(new Date(r.created_at), 'd MMM yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
