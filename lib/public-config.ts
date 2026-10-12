export const CONTACT_PHONE = "07739 870670"
export const CONTACT_PHONE_HREF = `tel:+44${CONTACT_PHONE.replace(/\s/g, "").slice(1)}`
export const LANDLORD_VIDEO_URL = process.env.NEXT_PUBLIC_LANDLORD_VIDEO_URL?.trim() || ""
export const TRADING_ADDRESS = "The Crown Hub, Main Street, Thornton, KY1 4AF"
export const TRADING_ADDRESS_MAP_HREF = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(TRADING_ADDRESS)}`

export const PUBLIC_NAV_LINKS = [
  { label: "About us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "For Landlords", href: "/landlords" },
  { label: "Meet the team", href: "/team" },
  { label: "FAQs", href: "/faqs" },
  { label: "Contact", href: "/contact" },
] as const
