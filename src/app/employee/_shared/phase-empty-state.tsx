interface PhaseEmptyStateProps {
  icon?: string
  title: string
  description?: string
  cta?: React.ReactNode
}

export function PhaseEmptyState({ icon = 'folder_open', title, description, cta }: PhaseEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 p-8 text-center space-y-2">
      <span
        className="material-symbols-outlined block mx-auto text-gray-300"
        style={{ fontSize: 40 }}
      >
        {icon}
      </span>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {description && <p className="text-xs text-gray-500 max-w-md mx-auto">{description}</p>}
      {cta && <div className="pt-2">{cta}</div>}
    </div>
  )
}
