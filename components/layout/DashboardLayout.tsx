"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Properties", href: "/dashboard/properties" },
    { name: "Tenants", href: "/dashboard/tenants" },
    { name: "Bookings", href: "/dashboard/bookings" },
    { name: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="hidden w-72 border-r border-slate-200 bg-white p-6 md:block">
        <div className="brand-surface rounded-2xl px-5 py-5 shadow-sm">
          <div className="brand-accent-orb right-3 top-3 h-14 w-14" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
            RentSimple
          </p>
          <h1 className="mt-3 text-2xl font-bold text-white">Operations Hub</h1>
          <p className="mt-2 text-sm text-slate-200">
            Properties, tenants, bookings, and settings from one control surface.
          </p>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                pathname.startsWith(item.href)
                  ? "brand-button text-white"
                  : "text-gray-700 hover:bg-slate-100"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="brand-surface m-4 flex min-h-20 items-center justify-between rounded-2xl px-6 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Dashboard</p>
            <span className="mt-1 block text-lg font-semibold text-white">Portfolio overview</span>
          </div>
          <div className="text-sm text-slate-200">Logged in as: Admin</div>
        </header>

        {/* Page content */}
        <main className="px-6 pb-6">{children}</main>
      </div>
    </div>
  );
}
