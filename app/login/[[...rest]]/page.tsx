"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ChangeEvent, FormEvent } from "react"
import { useEffect, useState } from "react"

import { getDefaultDashboardPath, type AuthUser } from "@/lib/auth"

type AuthMode = "login" | "register"

type FormState = {
  firstName: string
  lastName: string
  mobile: string
  email: string
  password: string
}

const redirectUrl = "/dashboard"

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode: AuthMode = searchParams.get("mode") === "register" ? "register" : "login"
  const isRegistrationMode = mode === "register"
  const [formState, setFormState] = useState<FormState>({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    password: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
        })

        if (!response.ok || !isActive) {
          return
        }

        const data = (await response.json()) as {
          user?: Pick<AuthUser, "role" | "approval_status"> | null
        }

        if (data.user) {
          router.replace(getDefaultDashboardPath(data.user))
          router.refresh()
        }
      } catch {
        return
      }
    }

    checkSession()

    return () => {
      isActive = false
    }
  }, [router])

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target

    setFormState((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function getPostAuthRedirectPath() {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
      })

      if (!response.ok) {
        return redirectUrl
      }

      const data = (await response.json()) as {
        user?: Pick<AuthUser, "role" | "approval_status"> | null
      }

      return getDefaultDashboardPath(data.user ?? null)
    } catch {
      return redirectUrl
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const response = await fetch(isRegistrationMode ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          isRegistrationMode
            ? {
                firstName: formState.firstName,
                lastName: formState.lastName,
                mobile: formState.mobile,
                email: formState.email,
                password: formState.password,
              }
            : {
                email: formState.email,
                password: formState.password,
              },
        ),
      })

      const payload = (await response.json().catch(() => null)) as {
        error?: string
      } | null

      if (!response.ok) {
        setErrorMessage(payload?.error ?? "Something went wrong. Please try again.")
        return
      }

      router.push(await getPostAuthRedirectPath())
      router.refresh()
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl items-center px-6 py-12">
      <div className="grid w-full gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-700">
            RentSimple Access
          </p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {isRegistrationMode ? "Create your account" : "Sign in to your workspace"}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            {isRegistrationMode
              ? "Register for RentSimple access, then wait for an administrator to approve and assign your role."
              : "Use your email and password to manage properties, applicants, and tenant activity from one place."}
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Property operations</p>
              <p className="mt-2 text-sm text-slate-600">
                Track homes, applications, and occupancy in one focused dashboard.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Approval workflow</p>
              <p className="mt-2 text-sm text-slate-600">
                New accounts start in the approval queue until an administrator assigns an active role.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/60">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                {errorMessage}
              </div>
            ) : null}

            {isRegistrationMode ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  First name
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                    name="firstName"
                    value={formState.firstName}
                    onChange={handleInputChange}
                    autoComplete="given-name"
                    required
                  />
                </label>

                <label className="block text-sm font-medium text-slate-700">
                  Last name
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                    name="lastName"
                    value={formState.lastName}
                    onChange={handleInputChange}
                    autoComplete="family-name"
                    required
                  />
                </label>
              </div>
            ) : null}

            {isRegistrationMode ? (
              <label className="block text-sm font-medium text-slate-700">
                Mobile number
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                  type="tel"
                  name="mobile"
                  value={formState.mobile}
                  onChange={handleInputChange}
                  autoComplete="tel"
                />
              </label>
            ) : null}

            <label className="block text-sm font-medium text-slate-700">
              Email address
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                type="email"
                name="email"
                value={formState.email}
                onChange={handleInputChange}
                autoComplete="email"
                required
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Password
              {isRegistrationMode ? (
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                  type="password"
                  name="password"
                  value={formState.password}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                  required
                />
              ) : (
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                  type="password"
                  name="password"
                  value={formState.password}
                  onChange={handleInputChange}
                  autoComplete="current-password"
                  required
                />
              )}
            </label>

            <button
              type="submit"
              className="brand-button w-full rounded-md px-4 py-3 text-sm font-semibold"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Working..." : isRegistrationMode ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm">
            {isRegistrationMode ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-sky-700 hover:underline">
                  Login
                </Link>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <Link href="/login?mode=register" className="text-sky-700 hover:underline">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
