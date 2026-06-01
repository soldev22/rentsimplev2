"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { type AuthUser, getDisplayName, getUserRole, isPendingApproval } from "@/lib/auth";
import { hasClerkPublishableKey } from "@/lib/clerk-env";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const isClerkAvailable = hasClerkPublishableKey();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [displayName, setDisplayName] = useState("User");
  const [displayRole, setDisplayRole] = useState("Pending");

  const navItems = [
    { name: "Properties", href: "/dashboard/properties" },
    { name: "Tenants", href: "/dashboard/tenants" },
    { name: "Bookings", href: "/dashboard/bookings" },
    { name: "Settings", href: "/dashboard/settings" },
  ];

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    if (isClerkAvailable && !isAuthLoaded) {
      return () => {
        isActive = false;
        controller.abort();
      };
    }

    if (isClerkAvailable && !isSignedIn) {
      router.replace("/login");

      return () => {
        isActive = false;
        controller.abort();
      };
    }

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!isActive) {
          return;
        }

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as { user?: AuthUser | null };
        const user = payload.user ?? null;

        if (!user) {
          router.replace("/login");
          return;
        }

        if (isPendingApproval(user)) {
          router.replace("/waiting");
          return;
        }

        setDisplayName(getDisplayName(user));
        setDisplayRole(getUserRole(user));
        setIsCheckingAccess(false);
      } catch {
        if (!isActive || controller.signal.aborted) {
          return;
        }

        router.replace("/login");
      }
    }

    loadSession();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isAuthLoaded, isClerkAvailable, isSignedIn, router]);

  if (isCheckingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">RentSimple</p>
          <p className="mt-3 text-sm text-slate-600">Checking your access…</p>
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
            {isClerkAvailable ? (
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: "h-10 w-10",
                  },
                }}
              />
            ) : null}
          </div>
        </header>

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
              <Link href="/dashboard/properties" className="hover:text-white">
                Properties
              </Link>
              <Link href="/dashboard/settings" className="hover:text-white">
                Settings
              </Link>
              <Link href="/dashboard/bookings" className="hover:text-white">
                Reports
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
