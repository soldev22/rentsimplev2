"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function AppChrome({
  children,
  authControls,
}: {
  children: React.ReactNode
  authControls?: React.ReactNode
}) {
  const pathname = usePathname()
  const isDashboardRoute = pathname.startsWith("/dashboard")
  const isHomeRoute = pathname === "/"
  const isPropertiesRoute = pathname === "/properties" || pathname.startsWith("/properties/")

  if (isDashboardRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {isHomeRoute ? (
        <header className="brand-surface overflow-hidden rounded-[2rem] shadow-lg">
          <div className="brand-accent-orb right-10 top-10 h-24 w-24" />
          <div className="mx-auto max-w-6xl px-6 pb-14 pt-4">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="min-w-0">
                <p className="text-2xl font-semibold tracking-[0.06em] text-sky-200">
                  rentsimple
                </p>
                <h1 className="text-lg font-semibold text-white">
                  we manage the property you build your home.
                </h1>
              </Link>

              <div className="flex items-center gap-3">
                {authControls ?? (
                  <Link href="/login" className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900">
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>
      ) : (
        <header className="brand-shell-surface border-b border-white/10 shadow-sm">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <Link href="/" className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
                RentSimple
              </p>
              <h1 className="text-lg font-semibold text-white">
                Property management, refined.
              </h1>
            </Link>

            <div className="flex items-center gap-3">
              {!isPropertiesRoute ? (
                <Link href="/properties" className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                  Search properties
                </Link>
              ) : null}
              {authControls ?? (
                <Link href="/login" className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900">
                  Login
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      <main className="flex-1">{children}</main>

      <footer className="brand-shell-surface border-t border-white/10 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-5 text-sm text-slate-200 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="hover:text-white">
              About
            </Link>
            <Link href="/" className="hover:text-white">
              Features
            </Link>
            <Link href="/" className="hover:text-white">
              Pricing
            </Link>
            <Link href="/" className="hover:text-white">
              Support
            </Link>
            <Link href="/login" className="hover:text-white">
              Access portal
            </Link>
            <Link href="/waiting" className="hover:text-white">
              Approval status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}