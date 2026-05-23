import type { CasePhase } from '@/types/database'

export type DemoScene =
  | { kind: 'intro'; title: string; subtitle?: string }
  | { kind: 'client-register'; clientName: string; phone: string; service: string }
  | { kind: 'client-portal'; clientName: string; serviceName: string; tabHighlight?: string }
  | { kind: 'form-fill'; title: string; section: string; fields: { label: string; value: string }[] }
  | { kind: 'document-upload'; docs: { label: string; type: string }[] }
  | { kind: 'ai-generate'; title: string; engine: 'gemini' | 'claude' | 'openai'; output: string; previewLines?: string[] }
  | { kind: 'admin-review'; title: string; items: { label: string; status: 'pendiente' | 'aprobado' | 'rechazado' }[] }
  | { kind: 'phase-advance'; from: string; to: string; toDescription: string }
  | { kind: 'success'; title: string; subtitle: string; deliverables: string[] }

export interface DemoStep {
  id: string
  /** Fase del servicio a la que pertenece este paso (para resaltar timeline) */
  phase: CasePhase | string
  /** Duración base en ms (afectada por la velocidad del player) */
  duration: number
  /** Texto narrativo en pantalla durante el paso */
  narration: string
  /** Escena a renderizar */
  scene: DemoScene
}

export interface DemoScript {
  serviceSlug: string
  serviceName: string
  totalDurationMs: number
  steps: DemoStep[]
}
