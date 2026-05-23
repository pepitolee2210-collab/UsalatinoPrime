// Layout legacy. La Vista CEO se movió a /admin/ceo bajo el shell admin.
// Mantenemos un pass-through para que el redirect de page.tsx funcione sin
// cargar dependencias innecesarias.
export default function LegacyCeoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
