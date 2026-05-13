import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
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

// Bricolage Grotesque: variable sans con optical sizing automático. Usada
// en el dashboard CEO para los números KPI (look "ops console" tipo Linear
// / Vercel, sin caer en serif editorial). Awwwards-favorite.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-bricolage",
  display: "swap",
});

// Mono para timestamps, IDs, códigos en el CEO dashboard (look terminal).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-ceo",
  display: "swap",
});

export const metadata: Metadata = {
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
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
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
    <html lang="es" className={`${fraunces.variable} ${bricolage.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
