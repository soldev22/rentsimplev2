"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Properties", href: "/dashboard/properties" },
    { name: "Tenants", href: "/dashboard/tenants" },
    { name: "Bookings", href: "/dashboard/bookings" },
    { name: "Settings", href: "/dashboard/settings" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r p-6 hidden md:block">
        <h1 className="text-2xl font-bold mb-8">RentSimple</h1>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium ${
                pathname.startsWith(item.href)
                  ? "bg-blue-600 text-white"
                  : "text-gray-700 hover:bg-gray-200"
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
        <header className="h-16 bg-white border-b flex items-center px-6 justify-between">
          <span className="font-medium">Dashboard</span>
          <div className="text-sm text-gray-600">Logged in as: Admin</div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
