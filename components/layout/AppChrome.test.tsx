import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ pathname: "/" }))
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))

import AppChrome from "./AppChrome"
import HomePage from "@/app/page"

describe("public header account access", () => {
  beforeEach(() => { mocks.pathname = "/" })

  it.each(["/", "/landlords", "/properties", "/login", "/meet"])("shows Login / Register on %s when signed out", (pathname) => {
    mocks.pathname = pathname
    const html = renderToStaticMarkup(<AppChrome isAuthenticated={false}>Page content</AppChrome>)
    const header = html.split("</header>")[0]
    expect(header).toContain('href="/login"')
    expect(header).toContain("Login / Register")
  })

  it("keeps Dashboard and Logout instead for signed-in users", () => {
    const html = renderToStaticMarkup(<AppChrome isAuthenticated>Page content</AppChrome>)
    const header = html.split("</header>")[0]
    expect(header).not.toContain("Login / Register")
    expect(header).toContain('href="/dashboard"')
    expect(header).toContain("Logout")
  })
  it.each([false, true])("shows the home page early-bird offer when authenticated=%s", (isAuthenticated) => {
    const html = renderToStaticMarkup(<AppChrome isAuthenticated={isAuthenticated}><HomePage /></AppChrome>)
    expect(html.match(/aria-label="Early bird offer"/g)).toHaveLength(1)
    expect(html).toContain("up to 50% off for the lifetime of your tenancy")
    expect(html).toContain('href="tel:+447739870670"')
  })
})
