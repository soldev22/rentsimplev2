"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs"
import { isClerkAPIResponseError } from "@clerk/nextjs/errors"
import type { ChangeEvent, FormEvent } from "react"
import { useState } from "react"

import { getDefaultDashboardPath, type AuthUser } from "@/lib/auth"
import { hasClerkPublishableKey } from "@/lib/clerk-env"

type AuthMode = "login" | "register"

type FormState = {
  firstName: string
  lastName: string
  email: string
  password: string
  verificationCode: string
}

const redirectUrl = "/dashboard"

function getErrorMessage(error: unknown) {
  if (isClerkAPIResponseError(error)) {
    return error.errors.map((issue) => issue.longMessage || issue.message).join(" ")
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Something went wrong. Please try again."
}

function getSignalErrorMessage(error: { message?: string } | null | undefined) {
  return error?.message || "Something went wrong. Please try again."
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode: AuthMode = searchParams.get("mode") === "register" ? "register" : "login"
  const isClerkAvailable = hasClerkPublishableKey()
  const clerk = useClerk()
  const { fetchStatus: signInFetchStatus, signIn } = useSignIn()
  const { fetchStatus: signUpFetchStatus, signUp } = useSignUp()
  const [formState, setFormState] = useState<FormState>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    verificationCode: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [requiresVerification, setRequiresVerification] = useState(false)

  const isLoaded = clerk.loaded && (mode === "login" ? signInFetchStatus === "idle" : signUpFetchStatus === "idle")

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

  async function completeSession(sessionId: string) {
    await clerk.setActive({ session: sessionId })
    router.push(await getPostAuthRedirectPath())
    router.refresh()
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!clerk.loaded || !signIn) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      const createResult = await signIn.create({
        identifier: formState.email,
        password: formState.password,
      })

      if (createResult.error) {
        setErrorMessage(getSignalErrorMessage(createResult.error))
        return
      }

      if ((signIn.status as string) === "needs_first_factor") {
        const passwordResult = await signIn.password({
          identifier: formState.email,
          password: formState.password,
        })

        if (passwordResult.error) {
          setErrorMessage(getSignalErrorMessage(passwordResult.error))
          return
        }
      }

      if ((signIn.status as string) === "complete") {
        await signIn.finalize({
          navigate: async () => {
            router.push(await getPostAuthRedirectPath())
            router.refresh()
          },
        })
        return
      }

      const existingSessionId = signIn.existingSession?.sessionId

      if (existingSessionId) {
        await completeSession(existingSessionId)
        return
      }

      if (signIn.status === "needs_second_factor" || signIn.status === "needs_new_password") {
        setErrorMessage("This account requires an additional sign-in step that this custom form does not handle yet.")
        return
      }

      setErrorMessage("We could not complete sign-in with this custom form. Try again or use a different sign-in method.")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!clerk.loaded || !signUp) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setInfoMessage(null)

    try {
      if (requiresVerification) {
        const verification = await signUp.verifications.verifyEmailCode({
          code: formState.verificationCode,
        })

        if (verification.error) {
          setErrorMessage(getSignalErrorMessage(verification.error))
          return
        }

        if (signUp.status !== "complete" || !signUp.createdSessionId) {
          setErrorMessage("Verification is not complete yet. Check the code and try again.")
          return
        }

        await completeSession(signUp.createdSessionId)
        return
      }

      const result = await signUp.create({
        firstName: formState.firstName,
        lastName: formState.lastName,
        emailAddress: formState.email,
        password: formState.password,
      })

      if (result.error) {
        setErrorMessage(getSignalErrorMessage(result.error))
        return
      }

      if (signUp.status === "complete" && signUp.createdSessionId) {
        await completeSession(signUp.createdSessionId)
        return
      }

      const verification = await signUp.verifications.sendEmailCode()

      if (verification.error) {
        setErrorMessage(getSignalErrorMessage(verification.error))
        return
      }

      setRequiresVerification(true)
      setInfoMessage(`We sent a verification code to ${formState.email}. Enter it below to finish creating your account.`)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  const isRegistrationMode = mode === "register"

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="login-card w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 border-b border-slate-200 pb-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
            RentSimple Access
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {mode === "login"
              ? "Sign in to manage properties, applicants, and tenant activity from one place."
              : "Create your account, then wait for an administrator to approve your RentSimple access."}
          </p>
        </div>

        <div className="mx-auto w-full max-w-md">
          {isClerkAvailable ? (
            <form className="space-y-4" onSubmit={isRegistrationMode ? handleRegisterSubmit : handleLoginSubmit}>
              <div id="clerk-captcha" className="min-h-16" />

              {!isLoaded ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Loading authentication...
                </div>
              ) : (
                <>
                  {errorMessage ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                      {errorMessage}
                    </div>
                  ) : null}

                  {infoMessage ? (
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                      {infoMessage}
                    </div>
                  ) : null}

                  {isRegistrationMode && !requiresVerification ? (
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

                  {!requiresVerification ? (
                    <>
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
                    </>
                  ) : (
                    <label className="block text-sm font-medium text-slate-700">
                      Verification code
                      <input
                        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-0 focus:border-sky-500"
                          type="text"
                        name="verificationCode"
                        value={formState.verificationCode}
                        onChange={handleInputChange}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        required
                      />
                    </label>
                  )}

                  <button
                    type="submit"
                    className="brand-button w-full rounded-md px-4 py-3 text-sm font-semibold"
                    disabled={!isLoaded || isSubmitting}
                  >
                    {isSubmitting
                      ? "Working..."
                      : requiresVerification
                        ? "Verify and continue"
                        : isRegistrationMode
                          ? "Create account"
                          : "Sign in"}
                  </button>
                </>
              )}
            </form>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-left text-sm text-amber-950">
              <p className="font-semibold">Clerk is not configured yet.</p>
              <p className="mt-2">
                Add valid Clerk publishable and secret keys to your local environment before using sign in or sign up.
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 text-center text-sm">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/login?mode=register" className="text-sky-700 hover:underline">
                Register
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-sky-700 hover:underline">
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}