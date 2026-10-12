"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { MeetingRequestButton, MeetingRequestProvider } from "@/components/forms/MeetingRequestPanel"
import { CONTACT_PHONE, CONTACT_PHONE_HREF, PUBLIC_NAV_LINKS, TRADING_ADDRESS } from "@/lib/public-config"

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
        return "Global admin"
      case "user":
        return "User"
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
    <MeetingRequestProvider key={pathname}>
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="brand-shell-surface border-b border-white/10 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="min-w-0">
            <span className="brand-lockup">
              <span className="brand-lockup-mark">
                <Image
                  src="/logo/Designer.png"
                  alt=""
                  width={72}
                  height={72}
                  className="brand-lockup-logo"
                />
              </span>
              <p className="text-xs font-semibold tracking-[0.3em] text-sky-200">
                RentSimple
              </p>
            </span>
            <p className="text-lg font-semibold text-white">
              Property management, redefined.
            </p>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <a href={CONTACT_PHONE_HREF} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Call {CONTACT_PHONE}
            </a>
            <MeetingRequestButton className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" />
            {!isHomeRoute && !isPropertiesRoute && !isLoginRoute ? (
              <Link href="/properties" className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20">
                Search properties
              </Link>
            ) : null}
            {!isAuthenticated ? (
              <Link href="/login" className="brand-nav-button brand-nav-button-solid px-4 py-2 text-sm font-semibold">
                Login / Register
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
          <nav aria-label="Main navigation" className="flex w-full flex-wrap gap-1 border-t border-white/20 pt-3">
            {PUBLIC_NAV_LINKS.map(({ label, href }) => <Link key={href} href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${pathname === href ? "bg-white text-blue-900" : "text-white hover:bg-white/10"}`}>
              {label}
            </Link>)}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="brand-shell-surface border-t border-white/10 shadow-sm">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 text-sm text-slate-200 md:grid-cols-[2fr_1fr]">
          <nav aria-label="Footer navigation" className="flex flex-wrap content-start items-center gap-4">
            {PUBLIC_NAV_LINKS.map(({ label, href }) => <Link key={href} href={href} className="hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{label}</Link>)}
            <Link href="/properties" className="hover:text-white">Search properties</Link>
            <Link href="/meet" className="hover:text-white">Request a meeting</Link>
            <Link href="/privacy" className="hover:text-white">Meeting request privacy</Link>
            {!isHomeRoute ? (
              <Link href="/login" className="hover:text-white">
                Access portal
              </Link>
            ) : null}
            <Link href="/waiting" className="hover:text-white">
              Approval status
            </Link>
          </nav>
          <div className="space-y-3">
            <p className="font-semibold text-white">Our trading location</p>
            <address className="not-italic leading-6">{TRADING_ADDRESS}</address>
            <a href={CONTACT_PHONE_HREF} className="inline-block whitespace-nowrap font-semibold text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Call {CONTACT_PHONE}
            </a>
          </div>
        </div>
      </footer>
    </div>
    </MeetingRequestProvider>
  )
}