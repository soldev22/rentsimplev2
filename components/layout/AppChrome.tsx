"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

export default function AppChrome({
  children,
  isAuthenticated,
  initialUser,
}: {
  children: React.ReactNode
  isAuthenticated: boolean
  initialUser?: {
    displayName: string
    displayRole: string
  }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const isDashboardRoute = pathname.startsWith("/dashboard")
  const isHomeRoute = pathname === "/"
  const isPropertiesRoute = pathname === "/properties" || pathname.startsWith("/properties/")
  const isLoginRoute = pathname.startsWith("/login")

  function getDesignationLabel(role: string) {
    switch (role) {
      case "admin":
        return "Administrator"
      case "agent":
        return "Agent"
      case "landlord":
        return "Landlord"
      case "applicant":
        return "Applicant"
      case "tenant":
        return "Tenant"
      case "builder":
        return "Builder"
      default:
        return "User"
    }
  }

  async function handleLogout() {
    setIsSigningOut(true)

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      })
    } finally {
      router.replace("/")
      router.refresh()
      setIsSigningOut(false)
    }
  }

  if (isDashboardRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="brand-shell-surface border-b border-white/10 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="min-w-0">
            <span className="brand-lockup">
              <svg className="brand-lockup-logo" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 0H26A6 6 0 0 1 32 6V26A6 6 0 0 1 26 32H24V12H16V32H6A6 6 0 0 1 0 26V6A6 6 0 0 1 6 0ZM6 12H11V17H6Z" fill="currentColor" fillRule="evenodd" />
                <rect x={16} y={12} width={8} height={20} fill="currentColor" />
                <rect x={6} y={12} width={5} height={5} fill="currentColor" />
              </svg>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-200">
                RentSimple
              </p>
            </span>
            <h1 className="text-lg font-semibold text-white">
              Property management, refined.
            </h1>
          </Link>

          <div className="flex items-center gap-3">
            {!isHomeRoute && !isPropertiesRoute && !isLoginRoute ? (
              <Link href="/properties" className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
                Search properties
              </Link>
            ) : null}
            {!isAuthenticated && !isHomeRoute ? (
              <Link href="/login" className="brand-nav-button brand-nav-button-solid px-4 py-2 text-sm font-semibold">
                Login
              </Link>
            ) : null}
            {isAuthenticated ? (
              <>
                {initialUser ? (
                  <div className="whitespace-nowrap text-xs font-medium text-slate-200/80">
                    {initialUser.displayName} <span className="text-slate-300/60">·</span> {getDesignationLabel(initialUser.displayRole)}
                  </div>
                ) : null}
                <Link href="/dashboard" className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="brand-nav-button brand-nav-button-solid px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out..." : "Logout"}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

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
            {!isHomeRoute ? (
              <Link href="/login" className="hover:text-white">
                Access portal
              </Link>
            ) : null}
            <Link href="/waiting" className="hover:text-white">
              Approval status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}