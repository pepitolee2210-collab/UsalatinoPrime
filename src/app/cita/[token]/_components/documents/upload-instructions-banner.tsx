import {
  DOCUMENT_UPLOAD_INSTRUCTIONS,
  type UploadInstructions,
} from '@/lib/cita/document-upload-instructions'

interface UploadInstructionsBannerProps {
  instructions?: UploadInstructions
}

export function UploadInstructionsBanner({
  instructions = DOCUMENT_UPLOAD_INSTRUCTIONS,
}: UploadInstructionsBannerProps) {
  return (
    <section
      aria-labelledby="upload-instructions-title"
      role="alert"
      className="rounded-2xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-500"
      style={{
        background: 'var(--color-ulp-surface-container-lowest)',
        border: '1.5px solid var(--color-ulp-error)',
        borderLeft: '6px solid var(--color-ulp-error)',
        boxShadow: '0 8px 28px -8px rgba(186, 26, 26, 0.35)',
      }}
    >
      {/* Franja superior de alerta */}
      <div
        className="flex items-center gap-3 px-5 py-3"
        style={{
          background:
            'linear-gradient(135deg, var(--color-ulp-error) 0%, #d32f2f 100%)',
          color: 'var(--color-ulp-on-error)',
        }}
      >
        <span
          aria-hidden="true"
          className="material-symbols-outlined flex-shrink-0 inline-flex items-center justify-center rounded-full animate-pulse"
          style={{
            background: 'rgba(255,255,255,0.22)',
            fontSize: 22,
            width: 36,
            height: 36,
            fontVariationSettings: "'FILL' 1, 'wght' 700",
          }}
        >
          priority_high
        </span>
        <p
          className="font-extrabold uppercase"
          style={{ letterSpacing: '0.12em', fontSize: 13 }}
        >
          {instructions.eyebrow}
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <h2
          id="upload-instructions-title"
          className="ulp-h3 italic"
          style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}
        >
          {instructions.title}
        </h2>

        <p
          className="ulp-body-sm mt-2"
          style={{ color: 'var(--color-ulp-on-surface-variant)' }}
        >
          {instructions.subtitle}
        </p>

        {/* Bloque de máxima urgencia: escanear + PDF, no fotos */}
        <div
          className="mt-4 flex items-start gap-3 rounded-xl px-4 py-3.5"
          style={{
            background: 'var(--color-ulp-error-container)',
            border: '1px solid var(--color-ulp-error)',
          }}
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined flex-shrink-0"
            style={{
              fontSize: 24,
              color: 'var(--color-ulp-error)',
              fontVariationSettings: "'FILL' 1, 'wght' 700",
              marginTop: 1,
            }}
          >
            document_scanner
          </span>
          <p
            className="ulp-body-sm font-bold leading-snug"
            style={{ color: '#7f1010' }}
          >
            {instructions.criticalWarning}
          </p>
        </div>

        <ul className="mt-5 space-y-2.5">
          {instructions.rules.map((rule, idx) => {
            const accent =
              rule.kind === 'do'
                ? 'var(--color-ulp-status-approved)'
                : 'var(--color-ulp-status-rejected)'
            return (
              <li
                key={`${rule.kind}-${idx}`}
                className="flex items-start gap-3 rounded-lg animate-in fade-in slide-in-from-left-2 duration-500"
                style={{
                  animationDelay: `${120 + idx * 60}ms`,
                  animationFillMode: 'both',
                  padding: rule.emphasis ? '8px 10px' : '0',
                  background: rule.emphasis
                    ? `color-mix(in oklab, ${accent} 9%, transparent)`
                    : 'transparent',
                  border: rule.emphasis
                    ? `1px solid color-mix(in oklab, ${accent} 30%, transparent)`
                    : 'none',
                }}
              >
                <span
                  aria-label={rule.kind === 'do' ? 'Hacer' : 'Evitar'}
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 22,
                    height: 22,
                    marginTop: 1,
                    background: `color-mix(in oklab, ${accent} 18%, transparent)`,
                    color: accent,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, fontVariationSettings: "'wght' 700" }}
                  >
                    {rule.kind === 'do' ? 'check' : 'close'}
                  </span>
                </span>
                <span
                  className="ulp-body-sm flex-1 leading-relaxed"
                  style={{
                    color: 'var(--color-ulp-on-surface)',
                    fontWeight: rule.emphasis ? 600 : 400,
                  }}
                >
                  {rule.text}
                </span>
              </li>
            )
          })}
        </ul>

        <div
          className="mt-5 rounded-xl border overflow-hidden"
          style={{
            background: 'var(--color-ulp-surface-container-low)',
            borderColor: 'var(--color-ulp-outline-variant)',
          }}
        >
          <div
            className="px-4 py-2.5 flex items-center gap-2 border-b"
            style={{ borderColor: 'var(--color-ulp-outline-variant)' }}
          >
            <span
              aria-hidden="true"
              className="material-symbols-outlined"
              style={{ fontSize: 16, color: 'var(--color-ulp-primary)' }}
            >
              draft
            </span>
            <p
              className="ulp-label font-semibold uppercase"
              style={{
                color: 'var(--color-ulp-on-surface-variant)',
                letterSpacing: '0.1em',
              }}
            >
              {instructions.examplesTitle}
            </p>
          </div>
          <ul className="px-4 py-3 space-y-1.5">
            {instructions.examples.map((example, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 font-mono"
                style={{
                  color: 'var(--color-ulp-on-surface)',
                  fontSize: 13,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: 'var(--color-ulp-primary)',
                    fontWeight: 700,
                  }}
                >
                  ›
                </span>
                <span className="truncate">{example}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2"
          style={{
            background:
              'color-mix(in oklab, var(--color-ulp-primary-fixed) 55%, transparent)',
          }}
        >
          <span
            aria-hidden="true"
            className="material-symbols-outlined flex-shrink-0"
            style={{
              fontSize: 18,
              color: 'var(--color-ulp-primary)',
              marginTop: 1,
            }}
          >
            push_pin
          </span>
          <p
            className="ulp-body-sm font-medium leading-snug"
            style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}
          >
            {instructions.footnote}
          </p>
        </div>
      </div>
    </section>
  )
}
