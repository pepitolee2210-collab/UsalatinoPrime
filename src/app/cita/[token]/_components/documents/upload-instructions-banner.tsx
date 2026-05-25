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
      className="rounded-2xl overflow-hidden relative"
      style={{
        background:
          'linear-gradient(135deg, var(--color-ulp-surface-container-lowest) 0%, color-mix(in oklab, var(--color-ulp-primary-fixed) 35%, white) 100%)',
        border: '1px solid var(--color-ulp-outline-variant)',
        borderLeft: '4px solid var(--color-ulp-primary)',
        boxShadow: '0 2px 8px -2px rgba(144, 63, 0, 0.08)',
      }}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="material-symbols-outlined flex-shrink-0 inline-flex items-center justify-center"
            style={{
              background: 'var(--color-ulp-primary)',
              color: 'var(--color-ulp-on-primary)',
              fontSize: 22,
              width: 40,
              height: 40,
              borderRadius: 12,
              boxShadow: '0 4px 10px -2px rgba(144, 63, 0, 0.35)',
            }}
          >
            description
          </span>
          <div className="flex-1 min-w-0">
            <p
              className="ulp-label font-semibold"
              style={{
                color: 'var(--color-ulp-primary)',
                letterSpacing: '0.14em',
              }}
            >
              {instructions.eyebrow}
            </p>
            <h2
              id="upload-instructions-title"
              className="ulp-h3 italic mt-0.5"
              style={{ color: 'var(--color-ulp-on-secondary-fixed)' }}
            >
              {instructions.title}
            </h2>
          </div>
        </div>

        <p
          className="ulp-body-sm mt-3"
          style={{ color: 'var(--color-ulp-on-surface-variant)' }}
        >
          {instructions.subtitle}
        </p>

        <ul className="mt-4 space-y-2.5">
          {instructions.rules.map((rule, idx) => (
            <li
              key={`${rule.kind}-${idx}`}
              className="flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-500"
              style={{
                animationDelay: `${100 + idx * 60}ms`,
                animationFillMode: 'both',
              }}
            >
              <span
                aria-label={rule.kind === 'do' ? 'Hacer' : 'Evitar'}
                className="flex-shrink-0 inline-flex items-center justify-center rounded-full"
                style={{
                  width: 22,
                  height: 22,
                  marginTop: 1,
                  background:
                    rule.kind === 'do'
                      ? 'color-mix(in oklab, var(--color-ulp-status-approved) 18%, transparent)'
                      : 'color-mix(in oklab, var(--color-ulp-status-rejected) 18%, transparent)',
                  color:
                    rule.kind === 'do'
                      ? 'var(--color-ulp-status-approved)'
                      : 'var(--color-ulp-status-rejected)',
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
                style={{ color: 'var(--color-ulp-on-surface)' }}
              >
                {rule.text}
              </span>
            </li>
          ))}
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
