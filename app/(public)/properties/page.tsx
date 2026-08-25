import Image from "next/image"
import Link from "next/link"

import { getUserRole } from "@/lib/auth"
import { listApplicationsForApplicant } from "@/lib/server/applications"
import { getPropertyImageLabel, getPropertyImagePath } from "@/lib/auth"
import { listPublicAvailableProperties } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

type PropertiesPageProps = {
  searchParams: Promise<{
    q?: string
    type?: string
    beds?: string
    maxRent?: string
    sort?: string
  }>
}

function formatSearchHeading(query: string) {
  const normalized = query.trim()
  return normalized ? `Available homes near ${normalized}` : "Available homes to rent"
}

function formatCurrency(value: number) {
  return `£${value.toLocaleString()}`
}

function parseNonNegativeNumber(value?: string) {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function sortProperties(
  properties: Awaited<ReturnType<typeof listPublicAvailableProperties>>,
  sort: string,
) {
  const nextProperties = [...properties]

  switch (sort) {
    case "price_asc":
      return nextProperties.sort((left, right) => left.monthlyRent - right.monthlyRent)
    case "price_desc":
      return nextProperties.sort((left, right) => right.monthlyRent - left.monthlyRent)
    case "beds_desc":
      return nextProperties.sort((left, right) => right.bedrooms - left.bedrooms)
    default:
      return nextProperties
  }
}

export default async function PublicPropertiesPage({ searchParams }: PropertiesPageProps) {
  const { q = "", type = "", beds = "", maxRent = "", sort = "recommended" } = await searchParams
  const sessionUser = await getSessionUser()
  const isApplicant = Boolean(sessionUser && getUserRole(sessionUser) === "applicant")
  const applicantApplications = isApplicant ? await listApplicationsForApplicant(sessionUser!) : []
  const activeApplicationByPropertyId = new Map(
    applicantApplications
      .filter((application) => application.status !== "declined" && application.status !== "withdrawn")
      .map((application) => [application.propertyId, application]),
  )
  const allProperties = await listPublicAvailableProperties(q)
  const minimumBedrooms = parseNonNegativeNumber(beds)
  const maximumRent = parseNonNegativeNumber(maxRent)
  const normalizedType = type.trim().toLowerCase()
  const typeOptions = [...new Set(allProperties.map((property) => property.type.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right))
  const filteredProperties = sortProperties(
    allProperties.filter((property) => {
      if (normalizedType && property.type.trim().toLowerCase() !== normalizedType) {
        return false
      }

      if (minimumBedrooms !== null && property.bedrooms < minimumBedrooms) {
        return false
      }

      if (maximumRent !== null && property.monthlyRent > maximumRent) {
        return false
      }

      return true
    }),
    sort,
  )
  const activeFilterCount = [normalizedType, minimumBedrooms !== null, maximumRent !== null].filter(Boolean).length

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_32%,#f8fafc_100%)] px-4 py-6 text-slate-900 md:px-6 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="brand-shell-surface px-5 py-6 text-white md:px-8 md:py-8">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
              <span className="rounded-full bg-white/12 px-3 py-1">Rent</span>
              <span>Live property search</span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{formatSearchHeading(q)}</h1>
            <p className="mt-3 max-w-3xl text-sm text-slate-200 md:text-base">
              Search rentals by area, then refine by property type, bedrooms, budget, and ranking.
            </p>

            <form action="/properties" method="get" className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/10 p-3 backdrop-blur md:p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,0.75fr))_auto]">
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Enter area, postcode, or street"
                  className="w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400"
                />
                <select aria-label="Property type" name="type" defaultValue={type} className="rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400">
                  <option value="">Any type</option>
                  {typeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <select aria-label="Minimum bedrooms" name="beds" defaultValue={beds} className="rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400">
                  <option value="">Any beds</option>
                  <option value="1">1+ beds</option>
                  <option value="2">2+ beds</option>
                  <option value="3">3+ beds</option>
                  <option value="4">4+ beds</option>
                </select>
                <select aria-label="Maximum rent" name="maxRent" defaultValue={maxRent} className="rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-cyan-400">
                  <option value="">Any budget</option>
                  <option value="1000">Up to £1,000</option>
                  <option value="1500">Up to £1,500</option>
                  <option value="2000">Up to £2,000</option>
                  <option value="3000">Up to £3,000</option>
                </select>
                <input type="hidden" name="sort" value={sort} />
                <button type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                  Search
                </button>
              </div>
            </form>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-200 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-8">
            <div>
              <div className="text-sm font-semibold text-slate-900">{filteredProperties.length} properties found</div>
              <div className="mt-1 text-sm text-slate-500">
                {activeFilterCount > 0 ? `${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` : "Browse all current public rental listings"}
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <form action="/properties" method="get" className="flex items-center gap-2">
                <input type="hidden" name="q" value={q} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="beds" value={beds} />
                <input type="hidden" name="maxRent" value={maxRent} />
                <label htmlFor="sort" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Sort
                </label>
                <select id="sort" name="sort" defaultValue={sort} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" title="Sort properties by">
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Lowest rent</option>
                  <option value="price_desc">Highest rent</option>
                  <option value="beds_desc">Most bedrooms</option>
                </select>
                <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                  Apply
                </button>
              </form>

              <Link href="/login" className="rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-900 transition-colors hover:bg-cyan-100">
                Save search via account
              </Link>
            </div>
          </div>
        </section>

        {filteredProperties.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">No matching properties yet</h2>
            <p className="mt-3 text-sm text-slate-600">
              Try another location search, or check back once more homes have been marked available to rent.
            </p>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
            {filteredProperties.map((property) => {
              const heroImage = property.images.find((image) => image.moderationStatus === "approved" && image.isCoverImage)
                ?? property.images.find((image) => image.moderationStatus === "approved")
              const existingApplication = activeApplicationByPropertyId.get(property.id)
              const quickApplyStatus = !sessionUser
                ? {
                    tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
                    message: "Register as an applicant to apply for this flat with Quick Apply.",
                    ctaHref: "/login?mode=register&accountType=applicant",
                    ctaLabel: "Register to apply or sign in",
                  }
                : isApplicant
                  ? existingApplication
                    ? {
                        tone: "border-amber-200 bg-amber-50 text-amber-900",
                        message: "You are already registered for this flat.",
                        ctaHref: "/dashboard/applicant",
                        ctaLabel: "View your application",
                      }
                    : {
                        tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
                        message: "You can apply for this flat now using Quick Apply.",
                        ctaHref: `/dashboard/applicant?propertyId=${property.id}`,
                        ctaLabel: "Apply now",
                      }
                  : {
                      tone: "border-cyan-200 bg-cyan-50 text-cyan-900",
                      message: "Register as an applicant to apply for this flat.",
                      ctaHref: "/login?mode=register&accountType=applicant",
                      ctaLabel: "Register to apply or sign in",
                    }

              return (
              <article key={property.id} className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_14px_48px_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_18px_58px_rgba(15,23,42,0.14)]">
                <div className="grid gap-0 md:grid-cols-[320px_minmax(0,1fr)]">
                  {heroImage ? (
                    <div className="relative min-h-[240px] overflow-hidden bg-slate-200">
                      <Image
                        src={getPropertyImagePath(property.id, heroImage.id, "thumbnail")}
                        alt={getPropertyImageLabel(heroImage)}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />
                      <div className="absolute left-4 top-4 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-900">
                        {property.status}
                      </div>
                    </div>
                  ) : (
                    <div className="brand-shell-surface flex min-h-[240px] flex-col justify-end px-6 py-5 text-white">
                      <div className="inline-flex w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                        {property.status}
                      </div>
                      <div className="mt-6 text-sm text-slate-200">No hero image uploaded yet</div>
                    </div>
                  )}

                  <div className="space-y-5 px-5 py-5 md:px-6 md:py-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-3xl font-bold tracking-tight text-slate-950">{formatCurrency(property.monthlyRent)} pcm</div>
                        <h2 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">{property.address}</h2>
                        <p className="mt-1 text-sm text-slate-500">{property.type} in {property.city}{property.postcode ? `, ${property.postcode}` : ""}</p>
                      </div>

                      <Link href={`/properties/${property.id}`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                        View details
                      </Link>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium">{property.bedrooms} bedroom{property.bedrooms === 1 ? "" : "s"}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium">{property.bathrooms} bathroom{property.bathrooms === 1 ? "" : "s"}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium">Public listing</span>
                    </div>

                    <p className="text-sm leading-6 text-slate-700">
                      {property.shortDescription || property.longDescription || "A rental property now available through RentSimple."}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm">
                      <div className="text-slate-500">Listed in {property.city}</div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">Ready to view online</span>
                        <Link href={`/properties/${property.id}`} className="font-semibold text-sky-700 hover:text-sky-900">
                          Open listing
                        </Link>
                      </div>
                    </div>

                    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${quickApplyStatus.tone}`}>
                      <span className="font-medium">{quickApplyStatus.message}</span>
                      <Link href={quickApplyStatus.ctaHref} className="font-semibold underline-offset-2 hover:underline">
                        {quickApplyStatus.ctaLabel}
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            )})}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Refine your search</div>
                <p className="mt-2 text-sm text-slate-600">
                  Use the filters to narrow the live list without leaving the results view.
                </p>

                <form action="/properties" method="get" className="mt-5 space-y-3">
                  <div>
                    <label htmlFor="sidebar-q" className="mb-2 block text-sm font-medium text-slate-700">Area</label>
                    <input id="sidebar-q" type="search" name="q" defaultValue={q} placeholder="Area or postcode" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500" />
                  </div>
                  <div>
                    <label htmlFor="sidebar-type" className="mb-2 block text-sm font-medium text-slate-700">Property type</label>
                    <select id="sidebar-type" name="type" defaultValue={type} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500" title="Select property type">
                      <option value="">Any type</option>
                      {typeOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="sidebar-beds" className="mb-2 block text-sm font-medium text-slate-700">Bedrooms</label>
                      <select id="sidebar-beds" name="beds" defaultValue={beds} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500" title="Select minimum bedrooms">
                        <option value="">Any</option>
                        <option value="1">1+</option>
                        <option value="2">2+</option>
                        <option value="3">3+</option>
                        <option value="4">4+</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sidebar-rent" className="mb-2 block text-sm font-medium text-slate-700">Max rent</label>
                      <select id="sidebar-rent" name="maxRent" defaultValue={maxRent} className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-500" title="Select maximum rent budget">
                        <option value="">Any</option>
                        <option value="1000">£1,000</option>
                        <option value="1500">£1,500</option>
                        <option value="2000">£2,000</option>
                        <option value="3000">£3,000</option>
                      </select>
                    </div>
                  </div>
                  <input type="hidden" name="sort" value={sort} />
                  <div className="flex gap-3">
                    <button type="submit" className="flex-1 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                      Update results
                    </button>
                    <Link href="/properties" className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                      Reset
                    </Link>
                  </div>
                </form>
              </section>

              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">RentSimple view</div>
                <div className="mt-3 space-y-3 text-sm text-slate-600">
                  <p>Image-led cards, fast location search, and a direct path into the full listing.</p>
                  <p>Next enhancements can add saved alerts, map browsing, and agent contact flow.</p>
                </div>
              </section>
            </aside>
          </section>
        )}
      </div>
    </div>
  )
}