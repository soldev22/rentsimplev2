import type { Metadata } from "next"
import Link from "next/link"
import PublicInformationPage from "@/components/layout/PublicInformationPage"

export const metadata: Metadata = {
  title: "Meet the team | RentSimple",
  description: "Meet the people behind RentSimple's approach to rental property management. Arrange a conversation with our team.",
}

export default function TeamPage() {
  return (
    <PublicInformationPage title="Meet the team" intro="Behind every property record is a real conversation. Get to know RentSimple and the way we work by speaking with our team.">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">People you can talk to</h2>
        <p className="mt-4 leading-7 text-slate-600">Looking after a rental property means listening, keeping track of the details and making the next steps clear. Our focus is on practical communication with Landlords, Tenants and the people carrying out work on their properties.</p>
        <p className="mt-4 leading-7 text-slate-600">Whether you are considering RentSimple for the first time or want to discuss a particular property, a conversation is a good place to start. Tell us about your needs and we can explain how we can help.</p>
        <Link href="/contact" className="mt-5 inline-block font-semibold text-blue-800 underline">Speak with the RentSimple team</Link>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">How we approach your enquiry</h2>
        <ul className="mt-4 list-disc space-y-3 pl-5 leading-7 text-slate-600">
          <li>Start with your property, your priorities and your questions.</li>
          <li>Explain the support available and what it involves.</li>
          <li>Agree the next steps with you, rather than assuming what you need.</li>
        </ul>
      </section>
    </PublicInformationPage>
  )
}
