import "./globals.css";

import type { Metadata, Viewport } from "next";

import AppChrome from "@/components/layout/AppChrome";
import { getUserRole } from "@/lib/auth";
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

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const initialUser = user
    ? {
        displayName: `${user.first_name} ${user.last_name}`.trim() || "User",
        displayRole: getUserRole(user),
      }
    : undefined;

  return (
    <html lang="en">
      <head>
        {/* Apple Home Screen Icon */}
        <link
          rel="apple-touch-icon"
          href="/icons/apple-touch-icon.png"
        />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Disable phone number detection */}
        <meta name="format-detection" content="telephone=no" />
      </head>

      <body>
        <AppChrome isAuthenticated={Boolean(user)} initialUser={initialUser}>
          {children}
        </AppChrome>

        <ServiceWorkerRegister />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}