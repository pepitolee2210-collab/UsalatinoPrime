// Skeleton mostrado por Next mientras el server component de la siguiente
// página termina de cargar. Evita que el navegador parezca "congelado" al
// navegar entre secciones (sobre todo en mobile con red 4G).
export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton — coincide con la altura de PageHeader */}
      <div className="space-y-3">
        <div
          className="h-3 w-32 rounded"
          style={{ background: 'var(--admin-accent-soft)' }}
        />
        <div
          className="h-9 w-72 rounded"
          style={{ background: 'var(--admin-border)' }}
        />
        <div
          className="h-3 w-96 rounded"
          style={{ background: 'var(--admin-accent-soft)' }}
        />
      </div>

      {/* Grid de cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl"
            style={{
              background: 'var(--admin-accent-soft)',
              border: '1px solid var(--admin-accent-soft)',
            }}
          />
        ))}
      </div>
    </div>
  )
}
