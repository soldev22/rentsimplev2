"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type WaitingStageState = "complete" | "active" | "next";
type WaitingStageItem = {
  title: string;
  description: string;
  state: WaitingStageState;
};

type WaitingClientProps = {
  displayName: string;
  role: string;
  awaitingVerification: boolean;
  stageItems: WaitingStageItem[];
};

export default function WaitingClient({
  displayName,
  role,
  awaitingVerification,
  stageItems,
}: WaitingClientProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  function getStateTone(state: WaitingStageState) {
    if (state === "complete") {
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    }

    if (state === "active") {
      return "border-sky-200 bg-sky-50 text-sky-900";
    }

    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  function getStateLabel(state: WaitingStageState) {
    if (state === "complete") {
      return "Complete";
    }

    if (state === "active") {
      return "In progress";
    }

    return "Next";
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-12">
      {/* Top logout bar */}
      <div className="absolute right-6 top-6 flex items-center gap-4">
        <div className="text-right text-sm">
          <div className="font-medium text-slate-900">{displayName}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-600">{role}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isSigningOut}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningOut ? "Signing out..." : "Logout"}
        </button>
      </div>

      {/* Main waiting card */}
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
  );
}
