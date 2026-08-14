import Image from "next/image"
import Link from "next/link"

import { getPropertyImageLabel, getPropertyImagePath } from "@/lib/auth"
import { hasCosmosConfiguration } from "@/lib/server/cosmos"
import { listPublicAvailableProperties } from "@/lib/server/properties"

const APP_VERSION = "1.0.16"

function formatCurrency(value: number) {
  return `GBP ${value.toLocaleString()} pcm`
}

function formatPublishedDate(date: Date) {
  const day = date.getDate()
  const month = date.toLocaleString("en-GB", { month: "long" })
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, "0")
  const minute = String(date.getMinutes()).padStart(2, "0")

  return `${day} ${month} ${year} ${hour}:${minute}`
}

export default async function HomePage() {
  const properties = hasCosmosConfiguration() ? await listPublicAvailableProperties("") : []
  const latestProperties = [...properties]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 10)
  const publishedDate = formatPublishedDate(new Date())

  return (
    <div className="bg-slate-50 text-gray-900">
      <div id="available-properties" className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live listings</p>
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                V1
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Latest 10 available properties</h2>
            <p className="mt-2 text-sm text-slate-600">Newest available homes are shown here first.</p>
          </div>
          <Link href="/properties" className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            See all properties and filters
          </Link>
        </div>

        {latestProperties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            No properties are currently marked as Available.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {latestProperties.map((property) => {
              const heroImage = property.images.find((image) => image.moderationStatus === "approved")

              return (
                <article key={property.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {heroImage ? (
                    <div className="relative h-44 w-full bg-slate-200">
                      <Image
                        src={getPropertyImagePath(property.id, heroImage.id, "thumbnail")}
                        alt={getPropertyImageLabel(heroImage)}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="flex h-44 items-center justify-center bg-slate-100 text-sm text-slate-500">
                      No approved image yet
                    </div>
                  )}

                  <div className="space-y-3 p-4">
                    <div className="text-lg font-bold text-slate-900">{formatCurrency(property.monthlyRent)}</div>
                    <h3 className="text-base font-semibold text-slate-900">{property.address}</h3>
                    <p className="text-sm text-slate-600">
                      {property.type} • {property.bedrooms} bed • {property.bathrooms} bath
                    </p>
                    <p className="text-sm text-slate-600">{property.city}{property.postcode ? `, ${property.postcode}` : ""}</p>
                    <Link href={`/properties/${property.id}`} className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                      View details
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white/80 px-6 py-4 text-center text-sm text-slate-600 backdrop-blur-sm">
        <div>Version: {APP_VERSION}</div>
        <div>Published: {publishedDate}</div>
      </footer>
    </div>
  )
}
