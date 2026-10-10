import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "For Landlords | RentSimple",
  description:
    "RentSimple only manages rental properties. Our own maintenance team keeps small jobs simple and prices low, and our compliance records give your insurance claims the best possible chance of success.",
}

const pillars = [
  {
    kicker: "01 · Rentals only",
    title: "We don't sell houses. Ever.",
    copy: "Lettings isn't a side line for us. Every person, process and system at RentSimple is focused on rental properties and the Landlords who own them.",
  },
  {
    kicker: "02 · Our own maintenance team",
    title: "Small jobs, no headache.",
    copy: "A dripping tap or a sticking door goes straight to our dedicated maintenance team. You don't chase tradespeople, and prices are kept low.",
  },
  {
    kicker: "03 · Insurance-ready compliance",
    title: "Built to support a claim.",
    copy: "Every property we manage is kept compliant and fully documented, so if you ever need to claim, you have the best possible chance of success.",
  },
]

const complianceItems = [
  { label: "Gas safety certificate", status: "In date" },
  { label: "Electrical installation (EICR)", status: "In date" },
  { label: "Smoke and CO alarms tested", status: "Logged" },
  { label: "Repair history with photos", status: "Complete" },
  { label: "Damp and mould response times", status: "On record" },
]

const comparison = [
  ["Focus", "Sales first, lettings second", "Rental properties only"],
  ["Small repairs", "Passed to whichever contractor is free", "Handled by our own maintenance team"],
  ["Maintenance costs", "Third-party contractor rates", "Kept low"],
  ["Compliance records", "Scattered across emails and folders", "One record per property, always up to date"],
  ["If you need to claim", "Hunting for paperwork", "The evidence is already there"],
]

const faqs = [
  [
    "Do you really not do sales?",
    "Correct. RentSimple only manages rental properties. That focus is the whole point, so your property never competes for attention with a sale.",
  ],
  [
    "What counts as a small job?",
    "The everyday repairs that make up most maintenance, like leaks, sticking doors, faulty fittings and minor fixes. Our maintenance team handles these directly.",
  ],
  [
    "How does compliance help with insurance?",
    "Insurers look for proof that a property was properly maintained and safe. We keep certificates in date, log every repair with photos, and record response times, so that proof is ready when you need it.",
  ],
  [
    "How do I get started?",
    "Create your account, and once you're approved you can add your properties to your Landlord dashboard.",
  ],
]

function SectionHeading({ kicker, title, intro }: { kicker: string; title: string; intro?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">{kicker}</p>
      <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h2>
      {intro ? <p className="mt-4 leading-7 text-slate-600">{intro}</p> : null}
    </div>
  )
}

export default function LandlordsPage() {
  return (
    <div className="bg-slate-100 text-slate-900">
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">For Landlords</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              Rentals are all we do.
              <br />
              <span className="text-blue-700">So we do them properly.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              RentSimple manages rental properties and nothing else. Our own maintenance team takes care of the small jobs at low prices, and we keep every property compliant and documented, so you&apos;re covered when it matters.
            </p>
            <p className="mt-6 text-sm text-slate-500">No sales. No contractor chasing. No missing paperwork.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <SectionHeading kicker="Why Landlords choose RentSimple" title="Three promises. No small print." />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.kicker} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold tracking-[0.2em] text-cyan-700">{pillar.kicker}</span>
              <h3 className="mt-4 text-xl font-semibold text-slate-900">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 md:grid-cols-2 md:items-center md:pb-20">
          <SectionHeading
            kicker="Rentals only"
            title="Your property never waits behind a sale."
            intro="Many agents earn most of their money from sales, so lettings gets whatever time is left. At RentSimple nothing else competes for our attention. Your Tenants, your repairs and your compliance are the job."
          />
          <div className="rounded-2xl bg-blue-700 p-8 text-white shadow-sm">
            <p className="text-5xl font-bold">100%</p>
            <p className="mt-2 text-lg font-semibold">of our work is rental property management.</p>
            <p className="mt-4 text-sm leading-6 text-blue-100">No sales targets, no valuations to chase, no distractions. Just Landlords and Tenants.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center md:py-20">
          <SectionHeading
            kicker="Insurance compliance"
            title="When you need to claim, the evidence is already there."
            intro="An insurance claim can depend on proving the property was safe and well maintained. We keep every RentSimple property compliant and fully documented, so your claim has the best possible chance of success."
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm" aria-label="Example insurance evidence checklist">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
              <span className="text-slate-500">Claim evidence</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Ready</span>
            </div>
            <ul className="mt-6 space-y-2">
              {complianceItems.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    <span className="text-emerald-600" aria-hidden="true">✓</span>
                    {item.label}
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">{item.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <SectionHeading kicker="The difference" title="A typical agent vs RentSimple." />
        <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th scope="col" className="px-6 py-4 font-semibold">
                  <span className="sr-only">Topic</span>
                </th>
                <th scope="col" className="px-6 py-4 font-semibold">Typical agent</th>
                <th scope="col" className="px-6 py-4 font-semibold text-blue-700">RentSimple</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {comparison.map(([topic, typical, rentSimple]) => (
                <tr key={topic}>
                  <th scope="row" className="px-6 py-4 font-semibold text-slate-900">{topic}</th>
                  <td className="px-6 py-4 text-slate-500">{typical}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <span className="mr-2 text-emerald-600" aria-hidden="true">✓</span>
                    {rentSimple}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <SectionHeading kicker="Questions" title="What Landlords ask us." />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map(([question, answer]) => (
              <article key={question} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="text-base font-semibold text-slate-900">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
