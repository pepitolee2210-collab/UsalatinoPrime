import type { ReactNode } from 'react'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
import 'material-symbols/outlined.css'
import './_components/tokens.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})

export default function CitaTokenLayout({ children }: { children: ReactNode }) {
  // Material Symbols Outlined se importa como CSS module desde el paquete npm
  // material-symbols. Esto auto-hospeda el WOFF2 desde nuestro propio dominio,
  // evitando depender de fonts.googleapis.com (que era bloqueado por SW PWA en
  // primera carga sin internet) y eliminando el ERR_FAILED en producción.
  return (
    <div className={`${cormorant.variable} ${manrope.variable}`}>
      {children}
    </div>
  )
}
