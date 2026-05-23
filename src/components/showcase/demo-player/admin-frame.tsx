'use client'

import 'material-symbols/outlined.css'

interface AdminFrameProps {
  /** Etiqueta del módulo activo (ej. "Casos", "Revisión Interna") */
  module: string
  /** Nombre del caso o cliente visible en el header */
  caseLabel: string
  /** Contenido principal del módulo */
  children: React.ReactNode
}

/**
 * Simula el shell del panel admin (/admin) con sidebar reducido y top bar
 * institucional azul. Replica jerarquía y paleta de `admin/layout.tsx`.
 */
export function AdminFrame({ module, caseLabel, children }: AdminFrameProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="flex" style={{ height: 540 }}>
        {/* Sidebar compacto */}
        <aside className="shrink-0 flex flex-col p-3 gap-2 border-r border-gray-200" style={{ width: 56, background: '#FAFBFC' }}>
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#002855]">
            <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>shield</span>
          </div>
          <span className="block w-full h-px bg-gray-200 my-1" />
          {[
            { icon: 'auto_awesome', accent: false },
            { icon: 'folder', accent: true },
            { icon: 'group', accent: false },
            { icon: 'credit_card', accent: false },
            { icon: 'description', accent: false },
          ].map((it, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-center w-10 h-10 rounded-lg ${it.accent ? 'bg-[#002855]/10' : 'hover:bg-gray-100'}`}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 20, color: it.accent ? '#002855' : '#6b7280' }}
              >
                {it.icon}
              </span>
            </div>
          ))}
        </aside>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">{module}</span>
              <span className="material-symbols-outlined text-gray-300" style={{ fontSize: 14 }}>chevron_right</span>
              <span className="font-semibold text-[#002855]">{caseLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 font-mono">admin · henry</span>
              <div className="w-7 h-7 rounded-full bg-[#002855] flex items-center justify-center text-white text-[10px] font-bold">HO</div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      </div>
    </div>
  )
}
