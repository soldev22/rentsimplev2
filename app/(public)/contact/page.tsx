import type { Metadata } from "next"
import Link from "next/link"
import PublicInformationPage from "@/components/layout/PublicInformationPage"
import { CONTACT_PHONE, CONTACT_PHONE_HREF, TRADING_ADDRESS, TRADING_ADDRESS_MAP_HREF } from "@/lib/public-config"

export const metadata: Metadata = {
  title: "Contact and location | RentSimple",
  description: "Contact RentSimple on 07739 870670 or arrange a meeting. Our trading location is The Crown Hub, Main Street, Thornton, KY1 4AF.",
}

export default function ContactPage() {
  return (
    <PublicInformationPage title="Contact us" intro="Have a question about a rental property or want to explore how RentSimple can help? Call us or request a meeting.">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Speak with us</h2>
          <p className="mt-4 leading-7 text-slate-600">For property management enquiries, questions about our services or help getting started, call:</p>
          <a href={CONTACT_PHONE_HREF} className="mt-4 inline-block text-2xl font-semibold text-blue-800 underline">{CONTACT_PHONE}</a>
          <p className="mt-4 leading-7 text-slate-600">Prefer to arrange a conversation? <Link href="/meet" className="font-semibold text-blue-800 underline">Request a meeting</Link> and tell us your preferred days, time and meeting type. We will get in touch to agree the details; submitting a request does not confirm a booking.</p>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Our trading location</h2>
          <address className="mt-4 text-lg not-italic leading-8">{TRADING_ADDRESS}</address>
          <p className="mt-4 leading-7 text-slate-600">Please contact us before visiting so we can arrange a suitable time to meet.</p>
          <a href={TRADING_ADDRESS_MAP_HREF} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block font-semibold text-blue-800 underline">View location on Google Maps (opens in a new tab)</a>
        </section>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Already have an account?</h2>
        <p className="mt-3 leading-7 text-slate-600"><Link href="/login" className="font-semibold text-blue-800 underline">Sign in</Link> to access your account and the property, application or maintenance tools available to your role.</p>
        <p className="mt-3 text-sm leading-6 text-slate-600">For an immediate danger or emergency, contact the appropriate emergency service rather than waiting for a meeting or a dashboard response.</p>
      </section>
    </PublicInformationPage>
  )
}
