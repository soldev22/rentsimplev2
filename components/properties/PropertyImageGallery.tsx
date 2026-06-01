"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import { getPropertyImageLabel, getPropertyImagePath, type PropertyImageRecord } from "@/lib/auth"

type PropertyImageGalleryProps = {
  propertyId: string
  images: PropertyImageRecord[]
  canManage?: boolean
  isPending?: boolean
  onRemove?: (blobName: string) => void
  gridClassName?: string
}

function getModerationStatusMeta(image: PropertyImageRecord) {
  if (image.moderationStatus === "pending_review") {
    return {
      label: "Pending admin approval",
      className: "bg-amber-100 text-amber-800",
    }
  }

  return {
    label: "Approved",
    className: "bg-emerald-100 text-emerald-800",
  }
}

export default function PropertyImageGallery({
  propertyId,
  images,
  canManage = false,
  isPending = false,
  onRemove,
  gridClassName = "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6",
}: PropertyImageGalleryProps) {
  const [activeImageId, setActiveImageId] = useState<string | null>(null)

  const activeImage = images.find((image) => image.id === activeImageId) ?? null

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveImageId(null)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <>
      <div className={gridClassName}>
        {images.map((image) => (
          <div key={image.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {(() => {
              const imageLabel = getPropertyImageLabel(image)
              const moderationStatus = getModerationStatusMeta(image)

              return (
                <>
            <button
              type="button"
              aria-label={`Open ${imageLabel}`}
              className="relative block aspect-square w-full border-b border-slate-200 bg-slate-50"
              onClick={() => setActiveImageId(image.id)}
            >
              <Image
                src={getPropertyImagePath(propertyId, image.id, "thumbnail")}
                alt={imageLabel}
                fill
                className="object-cover"
                unoptimized
              />
            </button>
            <div className="p-3">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="truncate text-left text-sm font-medium text-sky-700 hover:underline"
                  onClick={() => setActiveImageId(image.id)}
                >
                  {imageLabel}
                </button>
                {canManage && onRemove ? (
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-rose-700"
                    disabled={isPending}
                    onClick={() => onRemove(image.blobName)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              {image.moderationStatus === "pending_review" ? (
                <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${moderationStatus.className}`}>
                  {moderationStatus.label}
                </div>
              ) : (
                <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${moderationStatus.className}`}>
                  {moderationStatus.label}
                </div>
              )}
              <div className="mt-2 text-xs text-slate-500">
                {image.contentType} · {(image.size / 1024).toFixed(1)} KB
              </div>
            </div>
                </>
              )
            })()}
          </div>
        ))}
      </div>

      {activeImage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setActiveImageId(null)}>
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const moderationStatus = getModerationStatusMeta(activeImage)

              return (
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{getPropertyImageLabel(activeImage)}</div>
                <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${moderationStatus.className}`}>
                  {moderationStatus.label}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {activeImage.contentType} · {(activeImage.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
                onClick={() => setActiveImageId(null)}
              >
                Close
              </button>
            </div>
              )
            })()}
            <div className="flex max-h-[80vh] items-center justify-center bg-slate-100 p-4">
              <Image
                src={getPropertyImagePath(propertyId, activeImage.id)}
                alt={getPropertyImageLabel(activeImage)}
                width={1600}
                height={1200}
                className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain"
                unoptimized
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}