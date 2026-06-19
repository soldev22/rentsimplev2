import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import PropertyImageGallery from "@/components/properties/PropertyImageGallery"
import { MAX_PROPERTY_IMAGES, isPendingApproval } from "@/lib/auth"
import { getPropertyForUser } from "@/lib/server/properties"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type PageContext = {
  params: Promise<{
    id: string
  }>
}

export default async function PropertyDetail({ params }: PageContext) {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const { id } = await params
  const property = await getPropertyForUser(user, id)

  if (!property) {
    notFound()
  }

  const pendingImages = property.images.filter((image) => image.moderationStatus === "pending_review").length
  const approvedImages = property.images.length - pendingImages

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Property</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{property.address}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {property.type} · {property.status} · £{property.monthlyRent.toLocaleString()}/month
          </p>
        </div>
        <Link href="/dashboard/properties" className="text-sm font-medium text-sky-700 hover:underline">
          Back to properties
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Overview</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bedrooms</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{property.bedrooms}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bathrooms</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{property.bathrooms}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Owner</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{property.ownerId}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Affordability ratio</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">{property.affordabilityMultiple.toFixed(1)}x annual rent</div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Short description</h3>
            <p className="mt-3 text-slate-800">
              {property.shortDescription || "No short description has been added yet."}
            </p>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Long description</h3>
            <p className="mt-3 whitespace-pre-wrap text-slate-700">
              {property.longDescription || "No long description has been added yet."}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Images</h2>
          <p className="mt-2 text-sm text-slate-600">
            {property.images.length} of {MAX_PROPERTY_IMAGES} image slots in use for this property.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800">
              {approvedImages} approved
            </div>
            <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-800">
              {pendingImages} pending review
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Images uploaded from both create and edit stay in pending review until an admin approves them.
          </p>
          {property.images.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No images have been uploaded for this property yet.
            </div>
          ) : (
            <div className="mt-4">
              <PropertyImageGallery
                propertyId={property.id}
                images={property.images}
                gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
