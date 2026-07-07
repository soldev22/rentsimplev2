import "./globals.css";

import Link from "next/link";
//new comment
import AppChrome from "@/components/layout/AppChrome";
import { getSessionUser } from "@/lib/server/session";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";

export const metadata = {
  title: "RentSimple",
  description: "Property management made simple",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RentSimple",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://rentsimple.app",
    title: "RentSimple",
    description: "Property management made simple",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const authControls = user ? (
    <div className="flex items-center gap-3">
      <Link href="/dashboard" className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900">
        Dashboard
      </Link>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <Link href="/login?mode=register" className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white">
        Register
      </Link>
      <Link href="/login" className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900">
        Login
      </Link>
    </div>
  )

  const appContent = <AppChrome authControls={authControls}>{children}</AppChrome>

  return (
    <html lang="en">
      <head>
        {/* PWA Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="RentSimple" />
        <meta name="theme-color" content="#003366" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Disable phone number detection */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>
        {appContent}
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}


