"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type DashboardShellProps = {
  children: React.ReactNode
  initialUser: {
    displayName: string
    displayRole: string
  }
}

export default function DashboardShell({ children, initialUser }: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [displayName] = useState(initialUser.displayName);
  const [displayRole] = useState(initialUser.displayRole);
  const isApplicantRole = displayRole === "applicant";

  const navItems =
    displayRole === "applicant"
      ? [
          { name: "My Applications", href: "/dashboard/applicant" },
          { name: "Settings", href: "/dashboard/settings" },
        ]
      : displayRole === "tenant" || displayRole === "builder"
        ? [
            { name: "Onboarding", href: "/dashboard/onboarding" },
            { name: "Maintenance", href: "/dashboard/maintenance" },
            { name: "Settings", href: "/dashboard/settings" },
          ]
      : [
          { name: "Onboarding", href: "/dashboard/onboarding" },
          { name: "Properties", href: "/dashboard/properties" },
          { name: "Cases", href: "/dashboard/cases" },
          ...(displayRole === "admin" || displayRole === "agent" || displayRole === "landlord"
            ? [{ name: "Applications", href: "/dashboard/bookings" }]
            : []),
          { name: "Tenants", href: "/dashboard/tenants" },
          { name: "Maintenance", href: "/dashboard/maintenance" },
          { name: "Settings", href: "/dashboard/settings" },
          ...(displayRole === "admin"
            ? [
                { name: "Users", href: "/dashboard/users" },
                { name: "Audit Log", href: "/dashboard/audit" },
              ]
            : []),
        ];

  async function handleLogout() {
    setIsSigningOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  if (isApplicantRole) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="brand-shell-surface border-b border-white/10 px-4 py-4 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Dashboard</p>
                <h1 className="mt-1 text-lg font-semibold text-white">Applicant workspace</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      pathname.startsWith(item.href)
                        ? "bg-white text-slate-900"
                        : "border border-white/30 bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 md:justify-end">
                <div className="text-right text-sm text-slate-200">
                  <div>{displayName}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">{displayRole}</div>
                </div>
                <Link
                  href="/"
                  className="rounded border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  Home
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isSigningOut}
                  className="rounded border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningOut ? "Signing out..." : "Logout"}
                </button>
              </div>
            </div>
          </header>

          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="hidden w-72 border-r border-slate-200 bg-white p-6 md:block">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
            RentSimple
          </p>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Operations Hub</h1>
          <p className="mt-2 text-sm text-slate-600">
            Properties, tenants, bookings, and settings in one focused workspace.
          </p>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="brand-shell-surface mx-4 mt-4 flex min-h-20 items-center justify-between rounded-2xl border border-white/10 px-6 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Dashboard</p>
            <span className="mt-1 block text-lg font-semibold text-white">Portfolio overview</span>
          </div>
          <div className="flex items-center gap-4 text-right text-sm text-slate-200">
            <div>
              <div>Logged in as: {displayName}</div>
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-200">{displayRole}</div>
            </div>
            <Link
              href="/"
              className="rounded border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="rounded border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </header>

        <nav className="mx-4 mt-4 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                pathname.startsWith(item.href)
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Page content */}
        <main className="flex-1 px-6 pb-6 pt-4">{children}</main>

        <footer className="brand-shell-surface mx-4 mb-4 mt-auto rounded-2xl border border-white/10 px-6 py-4 text-sm text-slate-200 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="font-semibold text-white">RentSimple Dashboard</span> for properties, tenants, bookings, and account operations.
            </div>
            <div className="flex flex-wrap items-center gap-4 text-slate-300">
              <Link href="/dashboard" className="hover:text-white">
                Overview
              </Link>
              {displayRole !== "applicant" ? (
                <Link href="/dashboard/onboarding" className="hover:text-white">
                  Onboarding
                </Link>
              ) : null}
              <Link href="/dashboard/properties" className="hover:text-white">
                Properties
              </Link>
              <Link href="/dashboard/settings" className="hover:text-white">
                Settings
              </Link>
              {(displayRole === "tenant" || displayRole === "builder" || displayRole === "admin" || displayRole === "agent" || displayRole === "landlord") ? (
                <Link href="/dashboard/maintenance" className="hover:text-white">
                  Maintenance
                </Link>
              ) : null}
              {displayRole === "admin" ? (
                <>
                  <Link href="/dashboard/users" className="hover:text-white">
                    Users
                  </Link>
                  <Link href="/dashboard/audit" className="hover:text-white">
                    Audit Log
                  </Link>
                </>
              ) : null}
              {displayRole === "applicant" ? (
                <Link href="/dashboard/applicant" className="hover:text-white">
                  Applications
                </Link>
              ) : (
                <Link href="/dashboard/bookings" className="hover:text-white">
                  Applications
                </Link>
              )}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
