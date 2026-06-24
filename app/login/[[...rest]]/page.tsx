"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import type { ChangeEvent, FormEvent } from "react"
import { useEffect, useState } from "react"

import { getDefaultDashboardPath, type AuthUser } from "@/lib/auth"

type AuthMode = "login" | "register" | "forgot" | "reset" | "verify" | "verify-request"

type FormState = {
  firstName: string
  lastName: string
  mobile: string
  email: string
  password: string
  accountType: "applicant" | "general"
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
  const rawMode = searchParams.get("mode")
  const mode: AuthMode =
    rawMode === "register" ||
    rawMode === "forgot" ||
    rawMode === "reset" ||
    rawMode === "verify" ||
    rawMode === "verify-request"
      ? rawMode
      : "login"
  const token = searchParams.get("token") ?? ""
  const isRegistrationMode = mode === "register"
  const isForgotPasswordMode = mode === "forgot"
  const isResetPasswordMode = mode === "reset"
  const isVerifyMode = mode === "verify"
  const isVerifyRequestMode = mode === "verify-request"
  const [formState, setFormState] = useState<FormState>({
    firstName: "",
    lastName: "",
    mobile: "",
    email: "",
    password: "",
    accountType: "applicant",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [developmentActionUrl, setDevelopmentActionUrl] = useState<string | null>(null)

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

  useEffect(() => {
    if (!isVerifyMode || !token) {
      return
    }

    let isActive = true

    async function verifyEmail() {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        })

        const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null

        if (!response.ok) {
          if (isActive) {
            setErrorMessage(payload?.error ?? "Unable to verify your email.")
          }
          return
        }

        if (isActive) {
          setSuccessMessage(payload?.message ?? "Your email has been verified. You can now sign in.")
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(getErrorMessage(error))
        }
      } finally {
        if (isActive) {
          setIsSubmitting(false)
        }
      }
    }

    verifyEmail()

    return () => {
      isActive = false
    }
  }, [isVerifyMode, token])

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
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
    setSuccessMessage(null)
    setDevelopmentActionUrl(null)

    try {
      const endpoint = isRegistrationMode
        ? "/api/auth/register"
        : isForgotPasswordMode
          ? "/api/auth/forgot-password"
          : isResetPasswordMode
            ? "/api/auth/reset-password"
            : isVerifyRequestMode
              ? "/api/auth/resend-verification"
              : "/api/auth/login"
      const response = await fetch(endpoint, {
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
                accountType: formState.accountType === "applicant" ? "applicant" : undefined,
              }
            : isForgotPasswordMode || isVerifyRequestMode
              ? {
                  email: formState.email,
                }
              : isResetPasswordMode
                ? {
                    token,
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
        message?: string
        requiresVerification?: boolean
        developmentVerificationUrl?: string
        developmentResetUrl?: string
      } | null

      if (!response.ok) {
        setErrorMessage(payload?.error ?? "Something went wrong. Please try again.")
        return
      }

      if (isRegistrationMode) {
        setSuccessMessage("Check your email for a verification link before signing in.")
        setDevelopmentActionUrl(payload?.developmentVerificationUrl ?? null)
        return
      }

      if (isForgotPasswordMode) {
        setSuccessMessage(payload?.message ?? "If the account exists, a reset link has been sent.")
        setDevelopmentActionUrl(payload?.developmentResetUrl ?? null)
        return
      }

      if (isVerifyRequestMode) {
        setSuccessMessage(payload?.message ?? "If the account is awaiting verification, a new link has been sent.")
        setDevelopmentActionUrl(payload?.developmentVerificationUrl ?? null)
        return
      }

      if (isResetPasswordMode) {
        setSuccessMessage(payload?.message ?? "Your password has been updated. You can now sign in.")
        router.replace("/login")
        router.refresh()
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
            {isRegistrationMode
              ? "Create your account"
              : isForgotPasswordMode
                ? "Reset your password"
                : isResetPasswordMode
                  ? "Choose a new password"
                  : isVerifyMode
                    ? "Verify your email"
                    : isVerifyRequestMode
                      ? "Resend verification"
                      : "Sign in to your workspace"}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            {isRegistrationMode
              ? "Register directly as an applicant to start the tenancy process, or create a general account that waits for administrator allocation."
              : isForgotPasswordMode
                ? "Enter your email address and we will send you a password reset link if the account exists."
                : isResetPasswordMode
                  ? "Set a new password for your RentSimple account."
                  : isVerifyMode
                    ? "We are confirming your email address so your account can be activated."
                    : isVerifyRequestMode
                      ? "Request a fresh verification email if your original link expired or never arrived."
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
                Applicants can start straight away, while general accounts stay in the approval queue until an administrator assigns a role.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-200/60">
          {isVerifyMode ? (
            <div className="space-y-4">
              {errorMessage ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{errorMessage}</div>
              ) : null}
              {successMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{successMessage}</div>
              ) : null}
              {!token ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                  A verification token is required.
                </div>
              ) : isSubmitting ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">Verifying your email...</div>
              ) : null}
              <div className="text-center text-sm">
                <Link href="/login" className="text-sky-700 hover:underline">
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div>{successMessage}</div>
                {developmentActionUrl ? (
                  <div className="mt-2 break-all text-xs">
                    Development link: <a className="underline" href={developmentActionUrl}>{developmentActionUrl}</a>
                  </div>
                ) : null}
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

            {isRegistrationMode ? (
              <label className="block text-sm font-medium text-slate-700">
                Registering as
                <select
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                  name="accountType"
                  value={formState.accountType}
                  onChange={handleInputChange}
                  aria-label="Account type"
                >
                  <option value="applicant">Applicant</option>
                  <option value="general">General account</option>
                </select>
              </label>
            ) : null}

            {!isResetPasswordMode ? (
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
            ) : null}

            <label className="block text-sm font-medium text-slate-700">
              {isResetPasswordMode ? "New password" : "Password"}
              {isRegistrationMode || isResetPasswordMode ? (
                <input
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                  type="password"
                  name="password"
                  value={formState.password}
                  onChange={handleInputChange}
                  autoComplete="new-password"
                  required={!isForgotPasswordMode && !isVerifyRequestMode}
                />
              ) : isForgotPasswordMode || isVerifyRequestMode ? null : (
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
              {isSubmitting
                ? "Working..."
                : isRegistrationMode
                  ? "Create account"
                  : isForgotPasswordMode
                    ? "Send reset link"
                    : isResetPasswordMode
                      ? "Update password"
                      : isVerifyRequestMode
                        ? "Resend verification"
                        : "Sign in"}
            </button>
          </form>
          )}

          <div className="mt-5 text-center text-sm">
            {isRegistrationMode ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="text-sky-700 hover:underline">
                  Login
                </Link>
              </>
            ) : isForgotPasswordMode ? (
              <>
                Remembered your password?{" "}
                <Link href="/login" className="text-sky-700 hover:underline">
                  Back to login
                </Link>
              </>
            ) : isResetPasswordMode ? (
              <>
                Return to{" "}
                <Link href="/login" className="text-sky-700 hover:underline">
                  login
                </Link>
              </>
            ) : isVerifyRequestMode ? (
              <>
                Already verified?{" "}
                <Link href="/login" className="text-sky-700 hover:underline">
                  Back to login
                </Link>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <Link href="/login?mode=register" className="text-sky-700 hover:underline">
                  Register
                </Link>
                <span className="mx-2 text-slate-400">|</span>
                <Link href="/login?mode=forgot" className="text-sky-700 hover:underline">
                  Forgot password?
                </Link>
                <span className="mx-2 text-slate-400">|</span>
                <Link href="/login?mode=verify-request" className="text-sky-700 hover:underline">
                  Resend verification
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
