'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Context para que cualquier componente descendiente del portal del cliente
 * (/cita/[token]) tenga acceso al token de la cita sin propagarlo prop por
 * prop. Lo necesita VoiceTextarea para llamar al endpoint de transcripción
 * con auth válida.
 */
const VoiceTokenContext = createContext<string | null>(null)

export function VoiceProvider({ token, children }: { token: string; children: ReactNode }) {
  return <VoiceTokenContext.Provider value={token}>{children}</VoiceTokenContext.Provider>
}

/**
 * Hook que retorna el token de la cita. Si el componente NO está dentro de
 * un VoiceProvider, retorna null (en cuyo caso VoiceTextarea cae a textarea
 * normal sin el botón de voz).
 */
export function useVoiceToken(): string | null {
  return useContext(VoiceTokenContext)
}
