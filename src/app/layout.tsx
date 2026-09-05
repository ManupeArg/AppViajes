import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "MApp",
  description: "Los lugares de nuestro grupo, en un mapa",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MApp" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#18181b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        {/* Abrir las conexiones antes de que el mapa las necesite: ahorra unos cientos de ms */}
        <link rel="preconnect" href="https://api.maptiler.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://api.maptiler.com" />
        <link rel="preconnect" href="https://places.googleapis.com" crossOrigin="" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""} crossOrigin="" />
        <link rel="modulepreload" href="/maplibre/maplibre-gl-worker.mjs" />
        <link rel="modulepreload" href="/maplibre/maplibre-gl-shared.mjs" />
      </head>
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
