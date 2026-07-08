import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import QuickApplyCard from "@/components/properties/QuickApplyCard"
import PropertyImageGallery from "@/components/properties/PropertyImageGallery"
import { getPropertyImageLabel, getPropertyImagePath, getUserRole } from "@/lib/auth"
import { listApplicationsForApplicant } from "@/lib/server/applications"
import { getPublicAvailableProperty } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

type PublicPropertyPageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function PublicPropertyPage({ params }: PublicPropertyPageProps) {
  const { id } = await params
  const property = await getPublicAvailableProperty(id)
  const sessionUser = await getSessionUser()

  if (!property) {
    notFound()
  }

  const applicantApplications = sessionUser && getUserRole(sessionUser) === "applicant" ? await listApplicationsForApplicant(sessionUser) : []
  const existingApplication = applicantApplications.find(
    (application) =>
      application.propertyId === property.id &&
      application.status !== "declined" &&
      application.status !== "withdrawn",
  )

  const approvedImages = property.images.filter((image) => image.moderationStatus === "approved")
  const heroImage = approvedImages[0] ?? null
  const applicantPropertyPath = `/dashboard/applicant?propertyId=${property.id}`
  const encodedApplicantPropertyPath = encodeURIComponent(applicantPropertyPath)
  const applicationCtaHref =
    existingApplication
      ? "/dashboard/applicant"
      : sessionUser && getUserRole(sessionUser) === "applicant"
      ? applicantPropertyPath
      : `/login?mode=register&redirectTo=${encodedApplicantPropertyPath}`
  const signInApplyHref = `/login?redirectTo=${encodedApplicantPropertyPath}`
  const applicationCtaLabel =
    existingApplication
      ? "View your application"
      : sessionUser && getUserRole(sessionUser) === "applicant"
      ? "Apply for this flat"
      : "Register to apply or sign in"
  const canQuickApply = Boolean(
    sessionUser &&
      getUserRole(sessionUser) === "applicant" &&
      sessionUser.applicantProfile &&
      !existingApplication,
  )

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_32%,#f8fafc_100%)] px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <Link href="/properties" className="font-semibold text-sky-700 hover:text-sky-900">
            Back to search results
          </Link>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-500 shadow-sm">
            {property.status} listing
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_380px]">
            <div className="relative min-h-[320px] bg-slate-200 md:min-h-[440px]">
              {heroImage ? (
                <>
                  <Image
                    src={getPropertyImagePath(property.id, heroImage.id)}
                    alt={getPropertyImageLabel(heroImage)}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
                    <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100 backdrop-blur-sm">
                      {property.type}
                    </div>
                    <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{property.address}</h1>
                    <p className="mt-3 text-sm text-slate-200 md:text-base">{property.city}{property.postcode ? `, ${property.postcode}` : ""}</p>
                  </div>
                </>
              ) : (
                <div className="brand-shell-surface flex h-full min-h-[320px] flex-col justify-end p-6 md:min-h-[440px] md:p-8">
                  <div className="inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                    {property.type}
                  </div>
                  <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{property.address}</h1>
                  <p className="mt-3 text-sm text-slate-200 md:text-base">{property.city}{property.postcode ? `, ${property.postcode}` : ""}</p>
                </div>
              )}
            </div>

            <aside className="flex flex-col justify-between border-l border-slate-200 bg-white p-6 md:p-8">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Monthly rent</div>
                <div className="mt-3 text-4xl font-bold tracking-tight text-slate-950">£{property.monthlyRent.toLocaleString()}</div>
                <div className="mt-1 text-sm text-slate-500">per calendar month</div>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-slate-700">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Bedrooms</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{property.bedrooms}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Bathrooms</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{property.bathrooms}</div>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-slate-700">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span>Status</span>
                    <span className="font-semibold text-slate-900">{property.status}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span>Property type</span>
                    <span className="font-semibold text-slate-900">{property.type}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <span>Gallery</span>
                    <span className="font-semibold text-slate-900">{approvedImages.length} photo{approvedImages.length === 1 ? "" : "s"}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {existingApplication ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    You are already registered for this flat. Status: {existingApplication.status.replaceAll("_", " ")}.
                  </div>
                ) : sessionUser && getUserRole(sessionUser) === "applicant" ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    You can apply for this flat now.
                  </div>
                ) : (
                  <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                    Register as an applicant to apply for this flat and use Quick Apply.
                  </div>
                )}
                {canQuickApply && sessionUser?.applicantProfile ? (
                  <QuickApplyCard
                    propertyId={property.id}
                    propertyAddress={property.address}
                    monthlyRent={property.monthlyRent}
                    applicantProfile={sessionUser.applicantProfile}
                  />
                ) : null}
                <Link href={applicationCtaHref} className="block rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                  {applicationCtaLabel}
                </Link>
                {!sessionUser ? (
                  <Link href={signInApplyHref} className="block rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                    Already registered? Sign in to apply
                  </Link>
                ) : null}
              </div>
            </aside>
          </div>
        </section>

        <div className="grid gap-6">
          <div className="space-y-6">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Property overview</h2>
              <p className="mt-4 text-base leading-7 text-slate-700">
                {property.shortDescription || "A rental property listed through RentSimple."}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Address</h3>
                  <p className="mt-3 text-slate-800">{property.address}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Area</h3>
                  <p className="mt-3 text-slate-800">{property.city}{property.postcode ? `, ${property.postcode}` : ""}</p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Description</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {property.longDescription || "More details will be published on this listing soon."}
              </p>
            </section>
          </div>

        </div>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
            <span className="text-sm text-slate-500">{approvedImages.length} approved image{approvedImages.length === 1 ? "" : "s"}</span>
          </div>

          {approvedImages.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              Photos will appear here once the listing gallery is ready.
            </div>
          ) : (
            <div className="mt-4">
              <PropertyImageGallery
                propertyId={property.id}
                images={approvedImages}
                gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}