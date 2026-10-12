import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import AppChrome from "@/components/layout/AppChrome"
import AboutPage, { metadata as aboutMetadata } from "./about/page"
import ServicesPage, { metadata as servicesMetadata } from "./services/page"
import TeamPage, { metadata as teamMetadata } from "./team/page"
import ContactPage, { metadata as contactMetadata } from "./contact/page"
import FaqsPage, { metadata as faqsMetadata } from "./faqs/page"
import { CONTACT_PHONE_HREF, TRADING_ADDRESS, TRADING_ADDRESS_MAP_HREF } from "@/lib/public-config"

vi.mock("next/navigation", () => ({
  usePathname: () => "/about",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}))

const pages = [
  { Page: AboutPage, title: "About us", metadata: aboutMetadata },
  { Page: ServicesPage, title: "Our services", metadata: servicesMetadata },
  { Page: TeamPage, title: "Meet the team", metadata: teamMetadata },
  { Page: ContactPage, title: "Contact us", metadata: contactMetadata },
  { Page: FaqsPage, title: "Frequently asked questions", metadata: faqsMetadata },
]

describe("public information pages", () => {
  it.each(pages)("renders $title without account access and with one primary heading", ({ Page, title, metadata }) => {
    const html = renderToStaticMarkup(<AppChrome isAuthenticated={false}><Page /></AppChrome>)
    expect(html).toContain(title)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain("Request a meeting")
    expect(html).toContain(`href="${CONTACT_PHONE_HREF}"`)
    expect(metadata.title).toContain("RentSimple")
    expect(metadata.description).toBeTruthy()
    expect(html).not.toContain("Lorem ipsum")
  })
  it("shows the exact trading location, safe map link and visit guidance", () => {
    const html = renderToStaticMarkup(<AppChrome isAuthenticated={false}><ContactPage /></AppChrome>)
    expect(html).toContain(TRADING_ADDRESS)
    expect(html).toContain(TRADING_ADDRESS_MAP_HREF.replaceAll("&", "&amp;"))
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain("Please contact us before visiting")
    expect(html).not.toContain("<iframe")
    expect(html).toContain('href="/meet"')
    expect(html).toContain("does not confirm a booking")
  })
  it("introduces the team without invented biographies or profile photos", () => {
    const html = renderToStaticMarkup(<AppChrome isAuthenticated={false}><TeamPage /></AppChrome>)
    expect(html).toContain("People you can talk to")
    expect(html).toContain("Speak with the RentSimple team")
    expect(html).not.toContain("/team/")
    expect(html).not.toContain("Coming soon")
  })
  it("offers accessible FAQ disclosures and avoids invented fees", () => {
    const html = renderToStaticMarkup(<AppChrome isAuthenticated={false}><FaqsPage /></AppChrome>)
    expect(html.match(/<details\b/g)).toHaveLength(7)
    expect(html.match(/<summary\b/g)).toHaveLength(7)
    expect(html).toContain("What are your fees?")
    expect(html).toContain("this page does not quote a fixed price")
    expect(html).toContain('href="/properties"')
  })
})
