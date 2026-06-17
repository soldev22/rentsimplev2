import "./globals.css";

import Link from "next/link";

import AppChrome from "@/components/layout/AppChrome";
import { getSessionUser } from "@/lib/server/session";

export const metadata = {
  title: "RentSimple",
  description: "Property management made simple",
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
      <body>{appContent}</body>
    </html>
  );
}


