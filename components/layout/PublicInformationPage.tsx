import Link from "next/link"
import type { ReactNode } from "react"
import { MeetingRequestButton } from "@/components/forms/MeetingRequestPanel"
import { CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/public-config"

export default function PublicInformationPage({
  title, intro, children,
}: {
  title: string
  intro: string
  children: ReactNode
}) {
  return (
    <div className="bg-slate-100 text-slate-900">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">RentSimple</p>
          <h1 className="mt-4 text-4xl font-bold sm:text-5xl">{title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{intro}</p>
        </div>
      </section>
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-12">
        {children}
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6 sm:p-8">
          <h2 className="text-2xl font-bold">Let&apos;s talk about your property</h2>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">Tell us what you need help with. We can discuss your rental property, answer your questions and agree the next steps together.</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <MeetingRequestButton className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" />
            <a href={CONTACT_PHONE_HREF} className="font-semibold text-blue-800 underline">Call {CONTACT_PHONE}</a>
            <Link href="/contact" className="font-semibold text-blue-800 underline">Contact and location</Link>
          </div>
        </section>
      </div>
    </div>
  )
}
