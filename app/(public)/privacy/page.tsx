import type { Metadata } from "next"
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/public-config"

export const metadata: Metadata = { title: "Meeting request privacy notice | RentSimple" }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-12 text-slate-700">
      <h1 className="text-3xl font-bold text-slate-900">Meeting request privacy notice</h1>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4">Draft for review. This notice covers meeting requests only. The legal controller details, lawful basis and retention policy need to be confirmed before launch.</p>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">What we collect and why</h2>
        <p className="mt-2">RentSimple collects your first name, last name, phone number, email, number of properties, town, meeting preferences and any notes you provide. We use these details to respond to your enquiry and arrange a meeting. Please do not include sensitive personal information in your notes.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Storage and notifications</h2>
        <p className="mt-2">Requests are stored in Azure Cosmos DB and are accessible to approved Global admins. We use Postmark for email and Twilio for SMS notifications when configured. Our notification emails include your request details; admin SMS alerts link to the protected dashboard rather than including those details. Hashed network and email identifiers are used to limit spam submissions.</p>
        <p className="mt-2">When you reply to a meeting email, Postmark processes the reply and we store its text, subject, sender address and received time with your meeting request. Approved Global admins can read and reply to this conversation. Attachments are not imported into the dashboard. Please avoid sending sensitive personal information by email.</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold text-slate-900">Your choices and rights</h2>
        <p className="mt-2">Submitting a meeting request does not sign you up for marketing or confirm a booking. To discuss your request, ask about retention, or exercise your data protection rights, call <a href={CONTACT_PHONE_HREF} className="text-cyan-800 underline">{CONTACT_PHONE}</a>. You can also raise a concern with the UK Information Commissioner&apos;s Office.</p>
      </section>
    </div>
  )
}
