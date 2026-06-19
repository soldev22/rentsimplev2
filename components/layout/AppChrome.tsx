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

  if (isDashboardRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {isHomeRoute ? (
        <header className="brand-surface overflow-hidden rounded-b-[2rem] shadow-lg">
          <div className="brand-accent-orb right-10 top-10 h-24 w-24" />
          <div className="mx-auto max-w-6xl px-6 pb-14 pt-4">
            <div className="flex items-center justify-between gap-4">
              <Link href="/" className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
                  RentSimple
                </p>
                <h1 className="text-lg font-semibold text-white">
                  Property management, refined.
                </h1>
              </Link>

              <div className="flex items-center gap-3">
                <Link href="/properties" className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                  Explore
                </Link>
                {authControls ?? (
                  <Link href="/login" className="rounded bg-white px-4 py-2 text-sm font-medium text-slate-900">
                    Login
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-16 max-w-4xl pb-2">
                <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-200">
                Property Ops, Refined
              </p>
              <h2 className="mt-6 text-4xl font-bold leading-tight text-white md:text-5xl">
                Property management made simple, without looking basic.
              </h2>

              <p className="mt-5 max-w-3xl text-lg text-slate-200">
                Manage xxxxx properties, tenants, applications, and maintenance from a single workspace that feels fast, focused, and built for real operations.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                {authControls ?? (
                  <Link href="/login" className="rounded bg-white px-6 py-3 font-semibold text-slate-900">
                    Get Started
                  </Link>
                )}

                <Link href="/properties" className="rounded border border-white/30 bg-white/10 px-6 py-3 text-white">
                  View Properties
                </Link>
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
              <Link href="/properties" className="rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white">
                Explore
              </Link>
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