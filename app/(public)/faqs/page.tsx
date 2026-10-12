import type { Metadata } from "next"
import Link from "next/link"
import PublicInformationPage from "@/components/layout/PublicInformationPage"

export const metadata: Metadata = {
  title: "Frequently asked questions | RentSimple",
  description: "Answers to common questions about RentSimple, rental property management, accounts, meeting requests and fees.",
}

const questions = [
  ["Does RentSimple sell houses?", "No. RentSimple focuses on rental property management rather than property sales."],
  ["How do I get started as a Landlord?", "Request a meeting or call us to discuss your properties and the support you need. You can also register as a Landlord; email verification and approval are required before Landlord dashboard access is granted."],
  ["Can I browse properties before creating an account?", "Yes. You can browse the public property listings without signing in. An account is needed for the application workflow."],
  ["Does requesting a meeting confirm a booking?", "No. Your preferred days, time and meeting type help us arrange a conversation. We will contact you to agree the date and details."],
  ["How are maintenance issues recorded?", "Tenants with access to the maintenance dashboard can report an issue and add photos. Updates and records stay with the issue so the people involved can follow progress. Urgent emergencies should be reported to the appropriate emergency service."],
  ["What are your fees?", "Contact us to discuss your property and the services you need. We can explain the proposed scope and fees before you decide; this page does not quote a fixed price."],
  ["Can I visit your trading location?", "Yes, by arrangement. Please call or request a meeting before visiting The Crown Hub so we can agree a suitable time."],
]

export default function FaqsPage() {
  return (
    <PublicInformationPage title="Frequently asked questions" intro="A few useful answers before you get started. If your question is not covered here, we would be happy to talk it through.">
      <section aria-label="Common questions" className="space-y-3">
        {questions.map(([question, answer]) => <details key={question} className="rounded-2xl border border-slate-200 bg-white p-6">
          <summary className="cursor-pointer text-lg font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">{question}</summary>
          <p className="mt-4 leading-7 text-slate-600">{answer}</p>
        </details>)}
      </section>
      <p className="leading-7 text-slate-600">Ready to look for a home? <Link href="/properties" className="font-semibold text-blue-800 underline">Browse rental properties.</Link> For information about the details collected when you request a meeting, read our <Link href="/privacy" className="font-semibold text-blue-800 underline">meeting request privacy notice</Link>.</p>
    </PublicInformationPage>
  )
}
