import { CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/public-config"

export default function EarlyBirdOffer() {
  return (
    <section className="bg-amber-400" aria-label="Early bird offer">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-900">Early bird offer</p>
          <p className="mt-2 text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">
            Call us now and get the early bird discount: up to 50% off for the lifetime of your tenancy.
          </p>
        </div>
        <a
          href={CONTACT_PHONE_HREF}
          className="shrink-0 rounded-full bg-slate-900 px-8 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-slate-700"
        >
          Call {CONTACT_PHONE}
        </a>
      </div>
    </section>
  )
}
