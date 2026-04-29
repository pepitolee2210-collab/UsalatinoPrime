import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

// Content-Security-Policy tuned for the current integrations:
//  - Supabase (REST + Realtime WSS + Storage)
//  - Gemini (REST + Live API WSS)
//  - Stripe (checkout + API)
// 'unsafe-inline' / 'unsafe-eval' are required by Next.js' runtime and
// Tailwind's inline styles. Tighten once we migrate to CSP nonces.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com wss://generativelanguage.googleapis.com https://api.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=(), payment=(self)' },
  { key: 'Content-Security-Policy', value: CSP },
]

// Endpoints que sirven PDFs para previsualización dentro de nuestros
// propios modales con <iframe>. Necesitan permitir same-origin framing,
// lo que entra en conflicto con el X-Frame-Options: DENY global.
const embedCSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "object-src 'self' data:",
  "frame-ancestors 'self'",
].join('; ')

const embedHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy', value: embedCSP },
]

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  async headers() {
    return [
      // Preview de documentos del cliente (iframe dentro de /cita/[token])
      { source: '/api/client/preview-doc', headers: embedHeaders },
      // Contrato firmado embebido en modal del portal del cliente
      { source: '/api/cita/:token/signed-contract', headers: embedHeaders },
      // Default para todo lo demás. Usamos un negative lookahead en el
      // path para EXCLUIR las rutas de embed arriba — si el source global
      // matcheara también esas rutas, Next.js aplicaría AMBOS sets de
      // headers y el último gana, lo que sobreescribiría los permisivos
      // del embed con DENY (rompe el iframe).
      {
        source: '/:path((?!api/client/preview-doc|api/cita/[^/]+/signed-contract).*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default withPWA({
  dest: "public",
  register: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
})(nextConfig);
