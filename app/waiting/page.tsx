import Link from "next/link"

import { getUserRole, isPendingVerification } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

type WaitingStageState = "complete" | "active" | "next"
type WaitingStageItem = {
  title: string
  description: string
  state: WaitingStageState
}

export default async function WaitingPage() {
  const user = await getSessionUser()
  const role = getUserRole(user)
  const awaitingVerification = isPendingVerification(user)
  const stageItems: WaitingStageItem[] = awaitingVerification
    ? [
        {
          title: "Account created",
          description: "Your account record has been created.",
          state: "complete",
        },
        {
          title: "Verify email",
          description: "Check your inbox and click the verification link.",
          state: "active",
        },
        {
          title: "Await role allocation",
          description: "An administrator will assign your active role after verification.",
          state: "next",
        },
      ]
    : [
        {
          title: "Account created",
          description: "Your account record has been created.",
          state: "complete",
        },
        {
          title: "In approval queue",
          description: "An administrator will assign your active role shortly.",
          state: "active",
        },
        {
          title: "Start dashboard workflow",
          description: "You will be redirected to your role-specific dashboard when approved.",
          state: "next",
        },
      ]

  function getStateTone(state: WaitingStageState) {
    if (state === "complete") {
      return "border-emerald-200 bg-emerald-50 text-emerald-900"
    }

    if (state === "active") {
      return "border-sky-200 bg-sky-50 text-sky-900"
    }

    return "border-slate-200 bg-slate-50 text-slate-700"
  }

  function getStateLabel(state: WaitingStageState) {
    if (state === "complete") {
      return "Complete"
    }

    if (state === "active") {
      return "In progress"
    }

    return "Next"
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
          {awaitingVerification ? "Email Verification" : "Approval Queue"}
        </p>
        <h1 className="mb-4 mt-3 text-center text-3xl font-semibold text-slate-900">
          {awaitingVerification ? "Verify Your Email" : "Account Pending Approval"}
        </h1>

        <p className="text-center text-slate-600">
          {awaitingVerification
            ? "Your account has been created, but you must verify your email before you can sign in. Return to the login screen if you need to request another verification email."
            : "Your account has been created. An administrator will assign your role shortly."}
        </p>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            Current role: <span className="ml-2 font-semibold text-slate-900">{role}</span>
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          {stageItems.map((item) => (
            <article key={item.title} className={`rounded-xl border p-4 ${getStateTone(item.state)}`}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.16em]">{item.title}</h2>
                <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]">
                  {getStateLabel(item.state)}
                </span>
              </div>
              <p className="mt-2 text-sm">{item.description}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Back to login
          </Link>
          <Link
            href="/"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go to homepage
          </Link>
        </div>
      </div>
    </div>
  )
}

