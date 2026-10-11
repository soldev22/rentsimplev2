import type { Metadata } from "next"
import MeetingRequestForm from "@/components/forms/MeetingRequestForm"

export const metadata: Metadata = { title: "Request a meeting | RentSimple" }

export default function MeetPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-bold text-slate-900">Request a meeting</h1>
      <p className="mb-8 mt-3 text-slate-600">Tell us about your properties and when you&apos;re available. We&apos;ll contact you to agree the details.</p>
      <MeetingRequestForm />
    </div>
  )
}
