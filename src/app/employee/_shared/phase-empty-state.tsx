interface PhaseEmptyStateProps {
  icon?: string
  title: string
  description?: string
  cta?: React.ReactNode
}

export function PhaseEmptyState({ icon = 'folder_open', title, description, cta }: PhaseEmptyStateProps) {
  return (
    <div
      className="rounded-2xl p-8 text-center space-y-2"
      style={{
        background: 'var(--admin-panel-grad)',
        border: '0.5px dashed var(--admin-border-strong)',
      }}
    >
      <span
        className="material-symbols-outlined block mx-auto"
        style={{ fontSize: 40, color: 'var(--admin-fg-subtle)' }}
      >
        {icon}
      </span>
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--admin-fg)' }}>{title}</p>
      {description && (
        <p style={{ fontSize: 12, color: 'var(--admin-fg-muted)', maxWidth: '44ch', margin: '0 auto' }}>
          {description}
        </p>
      )}
      {cta && <div className="pt-2">{cta}</div>}
    </div>
  )
}
