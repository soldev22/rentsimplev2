import type { Metadata } from "next"
import Link from "next/link"
import PublicInformationPage from "@/components/layout/PublicInformationPage"
import { TRADING_ADDRESS } from "@/lib/public-config"

export const metadata: Metadata = {
  title: "About us | RentSimple",
  description: "Get to know RentSimple: rental property management, maintenance and clear records, based at The Crown Hub in Thornton.",
}

const values = [
  ["Rental properties come first", "We focus on rental property management, not house sales. Our work brings Landlords, Tenants and the people looking after their properties together."],
  ["Clear communication", "Property details, applications, repair updates and documents belong in one place, so everyone involved can follow what is happening."],
  ["Practical support", "From everyday repairs to keeping track of compliance documents, we help Landlords stay organised and take the next step with confidence."],
]

export default function AboutPage() {
  return (
    <PublicInformationPage title="About us" intro="RentSimple is built around a straightforward idea: looking after a rental property should be clearer, more organised and less stressful.">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold">Rental property management, made simpler</h2>
        <p className="mt-4 leading-7 text-slate-600">We bring property management and its day-to-day records together, helping Landlords manage their properties and Tenants keep in touch about the homes they rent. Maintenance, applications and compliance information are part of the same picture, rather than separate conversations to chase.</p>
        <p className="mt-4 leading-7 text-slate-600">Our trading location is {TRADING_ADDRESS}. <Link href="/contact" className="font-semibold text-blue-800 underline">Get in touch to arrange a conversation.</Link></p>
      </section>
      <section aria-label="What matters to us" className="grid gap-4 md:grid-cols-3">
        {values.map(([title, text]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-3 leading-7 text-slate-600">{text}</p>
        </article>)}
      </section>
      <Link href="/services" className="inline-block font-semibold text-blue-800 underline">Explore our services</Link>
    </PublicInformationPage>
  )
}
