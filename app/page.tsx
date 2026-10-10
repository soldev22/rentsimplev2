import Link from "next/link"

const highlights = ["Tenant reporting with photos", "Competing builder bids", "Accreditation checks", "Deadline alerts"]

const repairSteps = [
  ["01", "Tenant reports it", "Your tenant logs the issue with photos, a category, and a priority, so you start with the facts instead of a phone call."],
  ["02", "Builders quote", "Invite builders to bid. Compare price, availability, and duration side by side, then pick the one that fits."],
  ["03", "Checked, done, signed off", "Accreditation is checked before work starts, and the job closes only once it has been signed off."],
]

const maintenanceFeatures = [
  ["Builder bids in one place", "Every quote shows the amount, earliest start date, and estimated duration, so choosing a builder takes minutes rather than days."],
  ["Accreditation before access", "Insurance, Gas Safe, electrical certification, DBS, and method statements are ticked off and dated before anyone starts work."],
  ["Photos, messages, and a paper trail", "Photos, attachments, and conversations stay with the job, so you always know what was reported, agreed, and done."],
]

const dampStages = [
  { label: "Investigate", allowance: "10 working days", progress: "100%", status: "Done" },
  { label: "Written summary to tenant", allowance: "3 working days", progress: "66%", status: "Day 2" },
  { label: "Begin repairs", allowance: "5 working days", progress: "0%", status: "Next" },
]

const repairStages = ["Reported", "Quoted", "In progress", "Signed off"]

const complianceExamples = [
  { label: "Gas safety certificate", due: "Due in 7 months", tone: "bg-emerald-100 text-emerald-800" },
  { label: "Electrical installation (EICR)", due: "Due in 64 days", tone: "bg-amber-100 text-amber-800" },
  { label: "Smoke and heat alarm testing", due: "Due in 12 days", tone: "bg-red-100 text-red-800" },
]

const metrics = [
  ["1", "record for every repair"],
  ["11", "compliance checks tracked per property"],
  ["3", "escalation alerts before a deadline slips"],
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

export default function HomePage() {
  return (
    <div className="bg-slate-100 text-slate-900">
      <section className="bg-white">
        <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Maintenance support for landlords</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              Repairs handled.
              <br />
              <span className="text-blue-700">Records kept.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              From a dripping tap to a damp report, RentSimple takes each maintenance task from your tenant&apos;s first message to a signed-off job, with the builders, checks, and deadlines all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login?mode=register" className="brand-button rounded-xl px-5 py-3 text-sm font-semibold">
                Create account
              </Link>
              <Link href="/login" className="brand-outline-button rounded-xl px-5 py-3 text-sm font-semibold">
                Sign in
              </Link>
              <Link href="/landlords" className="px-3 py-3 text-sm font-semibold text-cyan-700 hover:text-cyan-900">
                Why Landlords choose us →
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">Less chasing. Fewer missed deadlines.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50" aria-label="Maintenance features">
        <ul className="mx-auto grid max-w-6xl gap-3 px-6 py-5 text-sm font-medium text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-cyan-700" aria-hidden="true">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <SectionHeading
          kicker="How a repair moves"
          title="One job. One clear route."
          intro="Maintenance usually means texts, missed calls, and quotes in three different inboxes. RentSimple gives every repair a single record that you, your tenant, and your builder can all follow."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {repairSteps.map(([number, title, copy]) => (
            <article key={number} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="text-xs font-semibold tracking-[0.2em] text-cyan-700">{number}</span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {maintenanceFeatures.map(([title, copy]) => (
            <article key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center md:py-20">
          <SectionHeading
            kicker="Damp, mould, and flood cases"
            title="Deadlines you can see coming."
            intro="Serious cases follow timed stages: investigate within 10 working days, send your tenant a written summary within 3, and begin repairs within 5. If a stage runs late, you are alerted after 24 hours, 72 hours, and 5 days, before a slipped deadline becomes a bigger problem."
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm" aria-label="Example damp and mould case">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em]">
              <span className="text-slate-500">Damp &amp; mould case</span>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">On track</span>
            </div>
            <ul className="mt-6 space-y-5">
              {dampStages.map((stage) => (
                <li key={stage.label}>
                  <div className="flex justify-between gap-4 text-sm">
                    <span className="font-medium text-slate-900">{stage.label}</span>
                    <span className="text-slate-500">{stage.status}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-blue-700" style={{ width: stage.progress }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Allowed: {stage.allowance}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:py-20">
        <div>
          <SectionHeading
            kicker="No more “any update?”"
            title="Everyone knows where the job is."
            intro="Each repair moves through clear stages, and your tenant can see them too. That means fewer chasing messages for you, and a tenant who knows their report hasn't disappeared."
          />
          <ol className="mt-8 flex flex-wrap gap-2">
            {repairStages.map((stage, index) => (
              <li
                key={stage}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  index === 2 ? "bg-blue-700 text-white" : index < 2 ? "bg-cyan-100 text-cyan-900" : "border border-slate-300 text-slate-500"
                }`}
              >
                {stage}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <SectionHeading
            kicker="Planned maintenance"
            title="Certificates on a calendar, not in a drawer."
            intro="Gas safety, EICR, EPC, smoke and heat alarms, legionella, boiler servicing, PAT testing and more are tracked for each property. Each check turns amber 90 days before it's due and red at 30 days, so renewals get booked in good time."
          />
          <ul className="mt-8 space-y-2">
            {complianceExamples.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <span className="font-medium text-slate-800">{item.label}</span>
                <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${item.tone}`}>{item.due}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Built for landlords</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Technology for the routine. People for the human bits.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Most maintenance is routine and should run itself. When a job gets complicated, you have the whole history in front of you: who reported what, which builder quoted, and what was agreed.
            </p>
          </div>
          <dl className="grid gap-4 sm:grid-cols-3">
            {metrics.map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <dt className="text-4xl font-bold text-blue-700">{value}</dt>
                <dd className="mt-2 text-sm text-slate-600">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm md:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Maintenance, managed</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Fix it once. Prove it forever.</h2>
          <p className="mt-4 text-slate-600">Bring your properties, your tenants, and your builders into one place.</p>
          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link href="/login?mode=register" className="brand-button rounded-xl px-5 py-3 text-sm font-semibold">
              Create account
            </Link>
            <Link href="/login" className="brand-outline-button rounded-xl px-5 py-3 text-sm font-semibold">
              Sign in
            </Link>
            <Link href="/properties" className="px-3 py-3 text-sm font-semibold text-cyan-700 hover:text-cyan-900">
              Looking for a home? →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
