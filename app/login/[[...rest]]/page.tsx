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

function getSafeRedirectPath(redirectTo: string | null) {
  if (!redirectTo) {
    return null
  }

  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return null
  }

  return redirectTo
}

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
  const redirectToParam = getSafeRedirectPath(searchParams.get("redirectTo"))
  const redirectQuery = redirectToParam ? `&redirectTo=${encodeURIComponent(redirectToParam)}` : ""
  const registerHref = `/login?mode=register${redirectQuery}`
  const forgotHref = `/login?mode=forgot${redirectQuery}`
  const verifyRequestHref = `/login?mode=verify-request${redirectQuery}`
  const loginHref = redirectToParam ? `/login?redirectTo=${encodeURIComponent(redirectToParam)}` : "/login"
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
    accountType: "general",
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
          router.replace(redirectToParam ?? getDefaultDashboardPath(data.user))
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
  }, [redirectToParam, router])

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
        return redirectToParam ?? redirectUrl
      }

      const data = (await response.json()) as {
        user?: Pick<AuthUser, "role" | "approval_status"> | null
      }

      return redirectToParam ?? getDefaultDashboardPath(data.user ?? null)
    } catch {
      return redirectToParam ?? redirectUrl
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
    <div className="relative flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_#e0ecff_0%,_#f6f8fc_45%,_#f1f5f9_100%)] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-2xl shadow-slate-300/40 backdrop-blur-sm sm:p-7">
        <div className="mb-5 text-center">
          <p className="text-[0.72rem] font-semibold tracking-[0.3em] text-slate-500">rentsimple</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {isRegistrationMode
              ? "Create account"
              : isForgotPasswordMode
                ? "Reset password"
                : isResetPasswordMode
                  ? "Set new password"
                  : isVerifyMode
                    ? "Verify email"
                    : isVerifyRequestMode
                      ? "Resend verification"
                      : "Sign in"}
          </h1>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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
                <Link href={loginHref} className="text-sky-700 hover:underline">
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
                <span className="mt-2 block text-xs text-slate-500">
                  General accounts enter the admin approval queue after email verification. Applicants can start the tenancy workflow immediately.
                </span>
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

          <div className="mt-4 text-center text-sm">
            {isRegistrationMode ? (
              <>
                Already have an account?{" "}
                <Link href={loginHref} className="text-sky-700 hover:underline">
                  Sign in
                </Link>
              </>
            ) : isForgotPasswordMode ? (
              <>
                Remembered your password?{" "}
                <Link href={loginHref} className="text-sky-700 hover:underline">
                  Sign in
                </Link>
              </>
            ) : isResetPasswordMode ? (
              <>
                Return to{" "}
                <Link href={loginHref} className="text-sky-700 hover:underline">
                  sign in
                </Link>
              </>
            ) : isVerifyRequestMode ? (
              <>
                Already verified?{" "}
                <Link href={loginHref} className="text-sky-700 hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <Link href={registerHref} className="text-sky-700 hover:underline">
                  Create one
                </Link>
                <span className="mx-2 text-slate-400">|</span>
                <Link href={forgotHref} className="text-sky-700 hover:underline">
                  Reset password
                </Link>
                <span className="mx-2 text-slate-400">|</span>
                <Link href={verifyRequestHref} className="text-sky-700 hover:underline">
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
