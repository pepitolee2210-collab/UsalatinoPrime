import type { ReactNode } from 'react'
import { Cormorant_Garamond, Manrope } from 'next/font/google'
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
  return (
    <>
      {/* Material Symbols Outlined — variable font de Google. next/font no
          la soporta directamente, así que se carga vía <link>. */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0..1&display=swap"
      />
      <div className={`${cormorant.variable} ${manrope.variable}`}>
        {children}
      </div>
    </>
  )
}
