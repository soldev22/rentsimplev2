import "./globals.css";

import Link from "next/link";
import type { Metadata, Viewport } from "next";

import AppChrome from "@/components/layout/AppChrome";
import { getSessionUser } from "@/lib/server/session";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PWAInstallPrompt } from "@/components/pwa/PWAInstallPrompt";

export const metadata: Metadata = {
  title: "RentSimple",
  description: "Property management made simple",

  manifest: "/manifest.json",

  icons: {
    icon: [
      {
        url: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
  },

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

export const viewport: Viewport = {
  themeColor: "#003366",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  const authControls = user ? (
    <div className="flex items-center gap-3">
      <Link
        href="/dashboard"
        className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900"
      >
        Dashboard
      </Link>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <Link
        href="/login?mode=register"
        className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white"
      >
        Register
      </Link>

      <Link
        href="/login"
        className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900"
      >
        Login
      </Link>
    </div>
  );

  return (
    <html lang="en">
      <head>
        {/* Apple Home Screen Icon */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/icons/apple-touch-icon.png"
        />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Disable phone number detection */}
        <meta name="format-detection" content="telephone=no" />
      </head>

      <body>
        <AppChrome authControls={authControls}>
          {children}
        </AppChrome>

        <ServiceWorkerRegister />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}