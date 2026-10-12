import type { Metadata } from "next"
import PublicInformationPage from "@/components/layout/PublicInformationPage"

export const metadata: Metadata = {
  title: "Services | RentSimple",
  description: "Explore RentSimple's rental property management, applications, maintenance coordination and compliance record support.",
}

const services = [
  ["Rental property management", "Keep property information, tenancy details and everyday management records together. Landlords can follow their portfolio without hunting through separate files and messages."],
  ["Applications and tenancy preparation", "Organise rental applications, supporting documents and the steps leading up to a tenancy. Applicants have a dedicated account to follow their own applications."],
  ["Maintenance and repairs", "Tenants can report issues with photos and updates. Repair records help Landlords compare Builder bids, coordinate work and keep a history of what was agreed and completed."],
  ["Compliance records", "Keep certificates, documents and due dates alongside each property. Clear records help you see what needs attention; they do not replace professional inspections or legal advice."],
  ["Communication and follow-up", "Keep property conversations and updates connected to the work they concern. Arrange a meeting with RentSimple to discuss your priorities and the support you need."],
]

export default function ServicesPage() {
  return (
    <PublicInformationPage title="Our services" intro="Practical support for rental properties, from the first application to the everyday work of keeping a tenancy running smoothly.">
      <section aria-label="Rental property services" className="grid gap-4 md:grid-cols-2">
        {services.map(([title, text]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-3 leading-7 text-slate-600">{text}</p>
        </article>)}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Support that fits your property</h2>
        <p className="mt-3 leading-7 text-slate-600">The right arrangement depends on your property and what you would like us to manage. Contact us to discuss the scope of support, availability and fees before making a decision.</p>
      </section>
    </PublicInformationPage>
  )
}
