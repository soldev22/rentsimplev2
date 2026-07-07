"use client"

import { useState } from "react"

interface Photo {
  id: string
  url: string
  uploadedAt: string
}

interface PhotoGalleryProps {
  photos: Photo[]
  onDeletePhoto?: (photoId: string) => void
  isLoading?: boolean
}

export function PhotoGallery({ photos, onDeletePhoto, isLoading }: PhotoGalleryProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)

  if (!photos || photos.length === 0) {
    return null
  }

  const currentPhoto = photos[selectedPhotoIndex]
  const hasMultiple = photos.length > 1

  const goToPrevious = () => {
    setSelectedPhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setSelectedPhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Photos ({photos.length})</h3>

      <div className="mt-4">
        {/* Main Photo Display */}
        <div className="relative overflow-hidden rounded-lg bg-slate-100">
          <img
            src={currentPhoto.url}
            alt={`Photo ${selectedPhotoIndex + 1}`}
            className="h-96 w-full object-cover"
            onError={(e) => {
              const img = e.target as HTMLImageElement
              img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Crect fill='%23e2e8f0' width='400' height='300'/%3E%3Ctext x='50%25' y='50%25' font-size='16' fill='%23475569' text-anchor='middle' dominant-baseline='middle'%3EImage unavailable%3C/text%3E%3C/svg%3E"
            }}
          />

          {/* Navigation Arrows */}
          {hasMultiple && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Previous photo"
              >
                ←
              </button>
              <button
                onClick={goToNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Next photo"
              >
                →
              </button>
            </>
          )}

          {/* Photo Counter */}
          {hasMultiple && (
            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-sm text-white">
              {selectedPhotoIndex + 1} / {photos.length}
            </div>
          )}
        </div>

        {/* Photo Info & Actions */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-600">
            Uploaded{" "}
            {new Date(currentPhoto.uploadedAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          {onDeletePhoto && (
            <button
              onClick={() => onDeletePhoto(currentPhoto.id)}
              disabled={isLoading}
              className="rounded px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              title="Delete this photo"
            >
              🗑️ Delete
            </button>
          )}
        </div>

        {/* Thumbnail Strip */}
        {hasMultiple && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                onClick={() => setSelectedPhotoIndex(index)}
                className={`flex-shrink-0 rounded-lg border-2 transition-all ${
                  index === selectedPhotoIndex ? "border-blue-600" : "border-slate-200 opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={photo.url}
                  alt={`Thumbnail ${index + 1}`}
                  className="h-16 w-16 object-cover rounded"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement
                    img.className = "h-16 w-16 bg-slate-200 rounded"
                  }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
