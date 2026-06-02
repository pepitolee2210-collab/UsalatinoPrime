import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });
// Distinctive editorial serif used for the voice agent's live captions and
// for the appointment confirmation card. Loaded lazily by next/font so it
// doesn't block the first paint of other routes.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

// Plus Jakarta Sans: la fuente más cercana a SF Pro Display de Apple
// disponible en Google Fonts. Geometría limpia, curvas perfectas, peso
// variable. Usada en el dashboard CEO (look Apple/minimalista).
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Mono para timestamps, IDs, códigos en el CEO dashboard (look terminal).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-ceo",
  display: "swap",
});

// Detecta automáticamente la URL del deploy (Vercel) — necesario para que
// la imagen de preview (opengraph-image.jpg) resuelva a URL absoluta al
// compartir el link. Fallback a localhost en dev.
const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "UsaLatinoPrime - Portal de Servicios Migratorios",
  description: "Portal automatizado de servicios migratorios",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UsaLatinoPrime",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  // Favicon (icono de pestaña) y apple-icon se toman de src/app/icon.png y
  // src/app/apple-icon.png (convención de Next.js). Sin `icons` explícito
  // aquí para no pisar esos archivos.
};

export const viewport: Viewport = {
  themeColor: "#002855",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${fraunces.variable} ${jakartaSans.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
