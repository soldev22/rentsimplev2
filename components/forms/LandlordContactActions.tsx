import Link from "next/link"
import { MeetingRequestButton } from "@/components/forms/MeetingRequestPanel"
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/public-config"

export default function LandlordContactActions() {
  const actionClass = "rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-blue-900 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
  return (
    <div className="flex flex-wrap gap-3">
      <a href={CONTACT_PHONE_HREF} className={actionClass}>Call {CONTACT_PHONE}</a>
      <MeetingRequestButton className={actionClass} />
      <Link href="/login?mode=register&role=landlord" className="rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Create an account</Link>
    </div>
  )
}
