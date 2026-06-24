"use client"

import Image from "next/image"
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react"

import PropertyImageGallery from "@/components/properties/PropertyImageGallery"
import { MAX_PROPERTY_IMAGES, getPropertyImagePath, type PendingPropertyImageReview, type PropertyRecord } from "@/lib/auth"

type PropertyManagerProps = {
  initialProperties: PropertyRecord[]
  canManage: boolean
  isAdmin: boolean
  landlordOptions?: Array<{
    id: string
    fullName: string
    email: string
  }>
  canAssignOwner?: boolean
  defaultOwnerId?: string
}

type PropertyFormState = {
  ownerId: string
  addressLine1: string
  addressLine2: string
  city: string
  postcode: string
  type: string
  status: string
  shortDescription: string
  longDescription: string
  bedrooms: string
  bathrooms: string
  monthlyRent: string
  affordabilityMultiple: string
}

const emptyForm: PropertyFormState = {
  ownerId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  type: "Detached house",
  status: "Available",
  shortDescription: "",
  longDescription: "",
  bedrooms: "0",
  bathrooms: "0",
  monthlyRent: "0",
  affordabilityMultiple: "2.5",
}

const propertyTypeOptions = [
  "Detached house",
  "Semi-detached house",
  "Terraced house",
  "Bungalow",
  "Flat",
  "Maisonette",
  "Studio",
  "Duplex",
  "Penthouse",
  "Cottage",
  "Converted property",
  "Other",
]

const propertyStatusOptions = [
  "Available",
  "Vacant",
  "Reserved",
  "Occupied",
  "Under maintenance",
  "Coming soon",
  "Off market",
]

function toFormState(property: PropertyRecord): PropertyFormState {
  return {
    ownerId: property.ownerId,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    postcode: property.postcode,
    type: property.type,
    status: property.status,
    shortDescription: property.shortDescription,
    longDescription: property.longDescription,
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
    monthlyRent: String(property.monthlyRent),
    affordabilityMultiple: String(property.affordabilityMultiple),
  }
}

function toPayload(form: PropertyFormState) {
  return {
    ownerId: form.ownerId,
    addressLine1: form.addressLine1,
    addressLine2: form.addressLine2,
    city: form.city,
    postcode: form.postcode,
    type: form.type,
    status: form.status,
    shortDescription: form.shortDescription,
    longDescription: form.longDescription,
    bedrooms: Number(form.bedrooms),
    bathrooms: Number(form.bathrooms),
    monthlyRent: Number(form.monthlyRent),
    affordabilityMultiple: Number(form.affordabilityMultiple),
  }
}

function getRemainingImageSlots(property: Pick<PropertyRecord, "images">) {
  return Math.max(0, MAX_PROPERTY_IMAGES - property.images.length)
}

function clampImageSelection(files: File[], maxFiles: number) {
  return files.filter((file) => file.type.startsWith("image/")).slice(0, maxFiles)
}

function useObjectUrls(files: File[]) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])

  useEffect(() => {
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [urls])

  return urls
}

type PendingImagePanelProps = {
  files: File[]
  previewUrls: string[]
  emptyMessage: string
}

function PendingImagePanel({ files, previewUrls, emptyMessage }: PendingImagePanelProps) {
  if (files.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-500">{emptyMessage}</div>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {files.map((file, index) => (
        <div key={`${file.name}-${file.lastModified}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="relative h-32 w-full bg-slate-100">
            {previewUrls[index] ? (
              <Image src={previewUrls[index]} alt={file.name} fill className="object-cover" unoptimized />
            ) : null}
          </div>
          <div className="p-3">
            <div className="truncate text-sm font-medium text-slate-900">{file.name}</div>
            <div className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
        </div>
      ))}
    </div>
  )
}

async function fetchPendingPropertyImageReviews() {
  const response = await fetch("/api/admin/property-images")
  const payload = (await response.json()) as { reviews?: PendingPropertyImageReview[]; error?: string }

  if (!response.ok || !payload.reviews) {
    throw new Error(payload.error || "Unable to load pending image reviews.")
  }

  return payload.reviews
}

export default function PropertyManager({
  initialProperties,
  canManage,
  isAdmin,
  landlordOptions = [],
  canAssignOwner = false,
  defaultOwnerId,
}: PropertyManagerProps) {
  const [properties, setProperties] = useState(initialProperties)
  const [selectedPropertyId, setSelectedPropertyId] = useState("")
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false)
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(true)
  const [portfolioSearch, setPortfolioSearch] = useState("")
  const [createForm, setCreateForm] = useState<PropertyFormState>(emptyForm)
  const [createImageFiles, setCreateImageFiles] = useState<File[]>([])
  const [isCreateDropActive, setIsCreateDropActive] = useState(false)
  const [editForm, setEditForm] = useState<PropertyFormState>(emptyForm)
  const [editorImageFiles, setEditorImageFiles] = useState<File[]>([])
  const [isEditorDropActive, setIsEditorDropActive] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isGeneratingCreateDescription, setIsGeneratingCreateDescription] = useState(false)
  const [isGeneratingEditDescription, setIsGeneratingEditDescription] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingImageReviews, setPendingImageReviews] = useState<PendingPropertyImageReview[]>([])
  const [isPending, startTransition] = useTransition()
  const editFormRef = useRef<HTMLFormElement | null>(null)
  const exitEditModeAfterSaveRef = useRef(false)
  const deferredPortfolioSearch = useDeferredValue(portfolioSearch)

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId],
  )
  const filteredProperties = useMemo(() => {
    const query = deferredPortfolioSearch.trim().toLowerCase()

    if (!query) {
      return properties
    }

    return properties.filter((property) => {
      const haystack = [
        property.address,
        property.addressLine1,
        property.addressLine2,
        property.city,
        property.postcode,
        property.type,
        property.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [deferredPortfolioSearch, properties])
  const remainingSelectedPropertySlots = selectedProperty ? getRemainingImageSlots(selectedProperty) : 0
  const createPreviewUrls = useObjectUrls(createImageFiles)
  const editorPreviewUrls = useObjectUrls(editorImageFiles)

  useEffect(() => {
    if (!isAdmin) {
      setPendingImageReviews([])
      return
    }

    let isMounted = true

    void fetchPendingPropertyImageReviews()
      .then((reviews) => {
        if (isMounted) {
          setPendingImageReviews(reviews)
        }
      })
      .catch((loadError) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load pending image reviews.")
        }
      })

    return () => {
      isMounted = false
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isCreatePanelOpen) {
      return
    }

    if (createForm.affordabilityMultiple.trim() !== "") {
      return
    }

    setCreateForm((current) => ({
      ...current,
      affordabilityMultiple: "2.5",
    }))
  }, [createForm.affordabilityMultiple, isCreatePanelOpen])

  useEffect(() => {
    if (!canAssignOwner || !defaultOwnerId) {
      return
    }

    setCreateForm((current) => (current.ownerId ? current : { ...current, ownerId: defaultOwnerId }))
  }, [canAssignOwner, defaultOwnerId])

  function selectProperty(property: PropertyRecord | null, nextEditMode = false) {
    setSelectedPropertyId(property?.id ?? "")
    setEditForm(property ? toFormState(property) : emptyForm)
    setEditorImageFiles([])
    setIsEditorDropActive(false)
    setIsEditMode(Boolean(property) && nextEditMode)
  }

  function updateCreateField(name: keyof PropertyFormState, value: string) {
    setCreateForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  function updateEditField(name: keyof PropertyFormState, value: string) {
    setEditForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function requestGeneratedDescription(
    form: PropertyFormState,
    options?: { propertyId?: string },
  ): Promise<{
    shortDescription: string
    longDescription: string
  }> {
    const response = await fetch("/api/properties/description", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        propertyId: options?.propertyId,
        addressLine1: form.addressLine1,
        addressLine2: form.addressLine2,
        city: form.city,
        postcode: form.postcode,
        type: form.type,
        status: form.status,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        monthlyRent: Number(form.monthlyRent),
      }),
    })

    const payload = (await response.json()) as {
      shortDescription?: string
      longDescription?: string
      error?: string
    }

    if (!response.ok || !payload.shortDescription || !payload.longDescription) {
      throw new Error(payload.error || "Unable to generate description.")
    }

    return {
      shortDescription: payload.shortDescription,
      longDescription: payload.longDescription,
    }
  }

  async function handleGenerateCreateDescription() {
    setError(null)
    setMessage(null)
    setIsGeneratingCreateDescription(true)

    try {
      const description = await requestGeneratedDescription(createForm)
      updateCreateField("shortDescription", description.shortDescription)
      updateCreateField("longDescription", description.longDescription)
      setMessage("Descriptions generated.")
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate description.")
    } finally {
      setIsGeneratingCreateDescription(false)
    }
  }

  async function handleGenerateEditDescription() {
    setError(null)
    setMessage(null)
    setIsGeneratingEditDescription(true)

    try {
      const description = await requestGeneratedDescription(editForm, { propertyId: selectedPropertyId })
      updateEditField("shortDescription", description.shortDescription)
      updateEditField("longDescription", description.longDescription)
      setMessage("Descriptions generated.")
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Unable to generate description.")
    } finally {
      setIsGeneratingEditDescription(false)
    }
  }

  async function uploadImages(propertyId: string, files: File[]) {
    const uploadedImages: PropertyRecord["images"] = []

    for (const file of files) {
      const formData = new FormData()
      formData.set("propertyId", propertyId)
      formData.set("file", file)

      const response = await fetch("/api/properties/images", {
        method: "POST",
        body: formData,
      })

      const payload = (await response.json()) as {
        image?: PropertyRecord["images"][number]
        error?: string
      }

      if (!response.ok || !payload.image) {
        throw new Error(payload.error || `Unable to upload ${file.name}.`)
      }

      uploadedImages.push(payload.image)
    }

    return uploadedImages
  }

  async function fetchPropertyById(propertyId: string) {
    const response = await fetch(`/api/properties/${propertyId}`)
    const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

    if (!response.ok || !payload.property) {
      throw new Error(payload.error || "Unable to refresh property.")
    }

    return payload.property
  }

  function assignCreateFiles(files: File[]) {
    const nextFiles = clampImageSelection(files, MAX_PROPERTY_IMAGES)

    if (files.length > nextFiles.length || nextFiles.length > MAX_PROPERTY_IMAGES) {
      setError(`A property can only store ${MAX_PROPERTY_IMAGES} images.`)
    } else {
      setError(null)
    }

    setCreateImageFiles(nextFiles)
  }

  function assignEditorFiles(files: File[]) {
    if (!selectedProperty) {
      setEditorImageFiles([])
      return
    }

    const nextFiles = clampImageSelection(files, remainingSelectedPropertySlots)

    if (files.length > nextFiles.length || remainingSelectedPropertySlots <= 0) {
      setError(`A property can only store ${MAX_PROPERTY_IMAGES} images.`)
    } else {
      setError(null)
    }

    setEditorImageFiles(nextFiles)
  }

  function handleCreateImageSelection(event: React.ChangeEvent<HTMLInputElement>) {
    assignCreateFiles(Array.from(event.target.files ?? []))
  }

  function handleEditorImageSelection(event: React.ChangeEvent<HTMLInputElement>) {
    assignEditorFiles(Array.from(event.target.files ?? []))
  }

  function handleCreateDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsCreateDropActive(false)
    assignCreateFiles(Array.from(event.dataTransfer.files ?? []))
  }

  function handleEditorDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setIsEditorDropActive(false)
    assignEditorFiles(Array.from(event.dataTransfer.files ?? []))
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    if (createImageFiles.length > MAX_PROPERTY_IMAGES) {
      setError(`A property can only store ${MAX_PROPERTY_IMAGES} images.`)
      return
    }

    startTransition(async () => {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload(createForm)),
      })

      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to create property.")
        return
      }

      let nextProperty = payload.property as PropertyRecord
      let uploadMessage: string | null = null

      try {
        const uploadedImages = await uploadImages(nextProperty.id, createImageFiles)

        if (uploadedImages.length > 0) {
          nextProperty = {
            ...nextProperty,
            images: [...nextProperty.images, ...uploadedImages],
          }
        }
      } catch (uploadError) {
        uploadMessage = uploadError instanceof Error ? uploadError.message : "Unable to upload property images."

        try {
          nextProperty = await fetchPropertyById(nextProperty.id)
        } catch {
          // Keep the created property in local state even if the follow-up refresh fails.
        }
      }

      setProperties((current) => [nextProperty, ...current])
      selectProperty(nextProperty, true)
      setIsCreatePanelOpen(false)
      setCreateForm(emptyForm)
      setCreateImageFiles([])
      setEditorImageFiles([])

      if (isAdmin && createImageFiles.length > 0) {
        try {
          const reviews = await fetchPendingPropertyImageReviews()
          setPendingImageReviews(reviews)
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load pending image reviews.")
        }
      }

      if (uploadMessage) {
        setError(uploadMessage)
        setMessage("Property created, but one or more images failed to upload. Review the image panel before continuing.")
        return
      }

      setMessage(
        createImageFiles.length > 0
          ? "Property created. Uploaded images are now pending admin approval."
          : "Property created.",
      )
    })
  }

  function saveSelectedProperty(exitEditModeOnSuccess = false) {
    if (!selectedProperty) {
      return
    }

    setError(null)
    setMessage(null)

    startTransition(async () => {
      const response = await fetch(`/api/properties/${selectedProperty.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toPayload(editForm)),
      })

      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to update property.")
        return
      }

      setProperties((current) =>
        current.map((property) => (property.id === payload.property?.id ? (payload.property as PropertyRecord) : property)),
      )
      setMessage("Property updated.")
      exitEditModeAfterSaveRef.current = false

      if (exitEditModeOnSuccess) {
        setIsEditMode(false)
      }
    })
  }

  function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveSelectedProperty(exitEditModeAfterSaveRef.current)
  }

  function handleDelete() {
    if (!selectedProperty || !window.confirm(`Delete ${selectedProperty.address}?`)) {
      return
    }

    setError(null)
    setMessage(null)

    startTransition(async () => {
      const response = await fetch(`/api/properties/${selectedProperty.id}`, {
        method: "DELETE",
      })

      const payload = (await response.json()) as { ok?: boolean; error?: string }

      if (!response.ok || !payload.ok) {
        setError(payload.error || "Unable to delete property.")
        return
      }

      const remainingProperties = properties.filter((property) => property.id !== selectedProperty.id)
      setProperties(remainingProperties)
      selectProperty(null)
      setMessage("Property deleted.")
    })
  }

  function handleImageUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedProperty || editorImageFiles.length === 0) {
      return
    }

    if (remainingSelectedPropertySlots <= 0) {
      setError(`A property can only store ${MAX_PROPERTY_IMAGES} images.`)
      return
    }

    setError(null)
    setMessage(null)

    startTransition(async () => {
      const uploadedImages = await uploadImages(selectedProperty.id, editorImageFiles)

      setProperties((current) =>
        current.map((property) =>
          property.id === selectedProperty.id
            ? { ...property, images: [...property.images, ...uploadedImages] }
            : property,
        ),
      )
      setEditorImageFiles([])

      if (isAdmin) {
        try {
          const reviews = await fetchPendingPropertyImageReviews()
          setPendingImageReviews(reviews)
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load pending image reviews.")
          return
        }
      }

      setMessage(
        `${uploadedImages.length} image${uploadedImages.length === 1 ? "" : "s"} uploaded and awaiting admin approval.`,
      )
    })
  }

  function handleImageDelete(blobName: string) {
    if (!selectedProperty) {
      return
    }

    setError(null)
    setMessage(null)

    startTransition(async () => {
      const response = await fetch("/api/properties/images", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          blobName,
        }),
      })

      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to delete image.")
        return
      }

      setProperties((current) =>
        current.map((property) => (property.id === payload.property?.id ? (payload.property as PropertyRecord) : property)),
      )
      setMessage("Image removed.")
    })
  }

  function handlePendingImageReview(propertyId: string, imageId: string, action: "approve" | "reject") {
    setError(null)
    setMessage(null)

    startTransition(async () => {
      const response = await fetch("/api/admin/property-images", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ propertyId, imageId, action }),
      })

      const payload = (await response.json()) as { property?: PropertyRecord; error?: string }

      if (!response.ok || !payload.property) {
        setError(payload.error || "Unable to review property image.")
        return
      }

      setPendingImageReviews((current) =>
        current.filter((review) => !(review.propertyId === propertyId && review.image.id === imageId)),
      )
      setProperties((current) =>
        current.map((property) => (property.id === payload.property?.id ? (payload.property as PropertyRecord) : property)),
      )

      if (selectedPropertyId === payload.property.id) {
        setEditForm(toFormState(payload.property))
      }

      setMessage(action === "approve" ? "Image approved." : "Image rejected and removed.")
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage property records and attach image assets stored in Azure Blob Storage.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div>
      ) : null}

      {isAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Pending image approvals</h2>
              <p className="mt-1 text-sm text-slate-600">Review newly uploaded images before they leave the moderation queue.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {pendingImageReviews.length} pending
            </div>
          </div>

          {pendingImageReviews.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              No images are waiting for admin review.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {pendingImageReviews.map((review) => (
                <div key={review.image.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <Image
                      src={getPropertyImagePath(review.propertyId, review.image.id, "thumbnail")}
                      alt={review.image.originalFileName || review.image.blobName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-3 p-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{review.propertyAddress}</div>
                      <div className="mt-1 text-xs text-slate-500">Owner: {review.ownerId}</div>
                    </div>
                    <div className="text-xs text-slate-600">
                      {review.image.originalFileName || review.image.blobName}
                    </div>
                    <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <div>Sexual: {review.image.moderationScores?.sexual ?? 0}</div>
                      <div>Violence: {review.image.moderationScores?.violence ?? 0}</div>
                      <div>Hate: {review.image.moderationScores?.hate ?? 0}</div>
                      <div>Self-harm: {review.image.moderationScores?.selfHarm ?? 0}</div>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 text-xs text-slate-600">
                      {review.image.moderationReason || "Awaiting admin approval."}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                        disabled={isPending}
                        onClick={() => handlePendingImageReview(review.propertyId, review.image.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700"
                        disabled={isPending}
                        onClick={() => handlePendingImageReview(review.propertyId, review.image.id, "reject")}
                      >
                        Reject and delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Add property</h2>
              <p className="mt-1 text-sm text-slate-600">Create a new property record and optionally attach images.</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => setIsCreatePanelOpen((current) => !current)}
            >
              {isCreatePanelOpen ? "Collapse" : "Expand"}
            </button>
          </div>

          {isCreatePanelOpen ? (
            <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={handleCreate}>

          {canAssignOwner && landlordOptions.length > 0 ? (
            <label className="text-sm font-medium text-slate-700 lg:col-span-2">
              Landlord owner
              <select
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                value={createForm.ownerId}
                onChange={(event) => updateCreateField("ownerId", event.target.value)}
                required
              >
                {landlordOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.fullName} · {option.email}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            Address line 1
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={createForm.addressLine1}
              onChange={(event) => updateCreateField("addressLine1", event.target.value)}
              placeholder="Flat 2, 10 High Street"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700 lg:col-span-2">
            Address line 2
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={createForm.addressLine2}
              onChange={(event) => updateCreateField("addressLine2", event.target.value)}
              placeholder="Area, district, or building name"
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Town / city
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={createForm.city}
              onChange={(event) => updateCreateField("city", event.target.value)}
              placeholder="Leeds"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Postcode
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 uppercase text-slate-900"
              value={createForm.postcode}
              onChange={(event) => updateCreateField("postcode", event.target.value.toUpperCase())}
              placeholder="LS1 4AB"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Property type
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={createForm.type}
              onChange={(event) => updateCreateField("type", event.target.value)}
              required
            >
              {propertyTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Listing status
            <select
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              value={createForm.status}
              onChange={(event) => updateCreateField("status", event.target.value)}
              required
            >
              {propertyStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Monthly rent
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              type="number"
              min="0"
              value={createForm.monthlyRent}
              onChange={(event) => updateCreateField("monthlyRent", event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Bedrooms
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              type="number"
              min="0"
              value={createForm.bedrooms}
              onChange={(event) => updateCreateField("bedrooms", event.target.value)}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Bathrooms
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              type="number"
              min="0"
              value={createForm.bathrooms}
              onChange={(event) => updateCreateField("bathrooms", event.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Salary to rent ratio
            <input
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
              type="number"
              min="0.1"
              step="0.1"
              value={createForm.affordabilityMultiple}
              onChange={(event) => updateCreateField("affordabilityMultiple", event.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-500">Common UK screening tends to land around 2.5x to 3.0x annual rent.</span>
          </label>

          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Images</div>
            <p className="mt-1 text-sm text-slate-600">
              Select images now and they will upload automatically after the property record is created.
            </p>
            <label
              className={`mt-3 block rounded-xl border-2 border-dashed p-5 text-sm font-medium transition ${
                isCreateDropActive ? "border-sky-500 bg-sky-50 text-sky-900" : "border-slate-300 bg-white text-slate-700"
              }`}
              onDragOver={(event) => {
                event.preventDefault()
                setIsCreateDropActive(true)
              }}
              onDragLeave={() => setIsCreateDropActive(false)}
              onDrop={handleCreateDrop}
            >
              <span className="block font-semibold">Add property images</span>
              <span className="mt-1 block text-sm text-slate-500">Drag images here or click to browse.</span>
              <input
                className="sr-only"
                type="file"
                accept="image/*"
                multiple
                onChange={handleCreateImageSelection}
              />
            </label>
                      <div className="mt-1 text-sm text-slate-500">
              {createImageFiles.length === 0
                ? "No images selected yet."
                : `${createImageFiles.length} image${createImageFiles.length === 1 ? "" : "s"} ready to upload.`}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Limit: {MAX_PROPERTY_IMAGES} images per property.
            </div>
            <div className="mt-4">
              <PendingImagePanel
                files={createImageFiles}
                previewUrls={createPreviewUrls}
                emptyMessage="No client-side previews yet. Selected images will appear here before upload."
              />
            </div>
          </div>

          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-900">Descriptions</div>
                <p className="mt-1 text-sm text-slate-600">
                  Add a short summary and a fuller listing description, or generate both from the property details above.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                disabled={isGeneratingCreateDescription || isPending}
                onClick={handleGenerateCreateDescription}
              >
                {isGeneratingCreateDescription ? "Generating..." : "Generate with AI"}
              </button>
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Short description
              <input
                className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                value={createForm.shortDescription}
                onChange={(event) => updateCreateField("shortDescription", event.target.value)}
                placeholder="A short summary for cards and headings."
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Long description
              <textarea
                className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                value={createForm.longDescription}
                onChange={(event) => updateCreateField("longDescription", event.target.value)}
                placeholder="A fuller property description will appear here."
              />
            </label>
          </div>

          <div className="lg:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Create property"}
            </button>
          </div>
            </form>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              The add property form is collapsed. Expand it when you want to create a new listing.
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Portfolio</h2>
              <p className="mt-1 text-sm text-slate-600">Browse the properties assigned to the logged-in user.</p>
            </div>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              onClick={() => setIsPortfolioOpen((current) => !current)}
            >
              {isPortfolioOpen ? "Collapse" : "Expand"}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-end lg:justify-between">
            <label className="block flex-1 text-sm font-medium text-slate-700">
              Search portfolio
              <input
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900"
                value={portfolioSearch}
                onChange={(event) => setPortfolioSearch(event.target.value)}
                placeholder="Search by address, town, postcode, status, or type"
              />
            </label>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                {filteredProperties.length} of {properties.length} shown
              </div>
              {portfolioSearch.trim() ? (
                <button
                  type="button"
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => setPortfolioSearch("")}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {isPortfolioOpen ? (
            properties.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No properties are assigned to this account yet.
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              No properties match that search yet.
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {filteredProperties.map((property) => (
                <li
                  key={property.id}
                  className={`rounded-xl border px-4 py-4 transition ${
                    property.id === selectedPropertyId ? "border-slate-900 bg-slate-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex-1 text-left"
                      onClick={() => selectProperty(property)}
                    >
                      <div className="font-semibold text-slate-900">{property.address}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        {property.type} · {property.status}
                      </div>
                      {canAssignOwner ? (
                        <div className="mt-1 text-sm text-slate-500">Owner: {property.ownerId}</div>
                      ) : null}
                      <div className="mt-1 text-sm text-slate-500">
                        {property.bedrooms} bed · {property.bathrooms} bath · £{property.monthlyRent.toLocaleString()}/month
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                        {property.images.length === 0 ? (
                          <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-xs text-slate-500">
                            No thumbnails yet
                          </div>
                        ) : (
                          property.images.slice(0, 6).map((image) => (
                            <div key={image.id} className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                              <Image
                                src={getPropertyImagePath(property.id, image.id, "thumbnail")}
                                alt={image.blobName}
                                fill
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ))
                        )}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {property.images.length} / {MAX_PROPERTY_IMAGES} images used
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        type="button"
                        className="text-sm font-medium text-sky-700 hover:underline"
                        onClick={() => selectProperty(property)}
                      >
                        Details
                      </button>
                      {canManage ? (
                        <button
                          type="button"
                          className="text-sm font-medium text-slate-700 hover:underline"
                          onClick={() => selectProperty(property, true)}
                        >
                          Edit
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
              The portfolio list is collapsed. Expand it to browse the current user&apos;s properties.
            </div>
          )}
      </section>

      {selectedProperty ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4" onClick={() => selectProperty(null)}>
          <div
            className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedProperty.address}</h2>
                <div className="mt-1 text-sm text-slate-600">
                  {selectedProperty.type} · {selectedProperty.status} · £{selectedProperty.monthlyRent.toLocaleString()}/month
                </div>
              </div>
              <div className="flex items-center gap-3">
                {canManage ? (
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                    onClick={() => {
                      if (isEditMode) {
                        exitEditModeAfterSaveRef.current = true
                        editFormRef.current?.requestSubmit()
                        return
                      }

                      setIsEditMode(true)
                    }}
                  >
                    {isEditMode ? "Save changes and done" : "Edit"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => selectProperty(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[0.95fr_1.05fr]">
              <section className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">Details</h3>

                  {!isEditMode ? (
                    <div className="mt-4 space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {canAssignOwner ? (
                          <div className="rounded-xl bg-slate-50 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Owner</div>
                            <div className="mt-2 text-sm font-semibold text-slate-900">{selectedProperty.ownerId}</div>
                          </div>
                        ) : null}
                        <div className="rounded-xl bg-slate-50 p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Type</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{selectedProperty.type}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{selectedProperty.status}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bedrooms</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{selectedProperty.bedrooms}</div>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-4">
                          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Bathrooms</div>
                          <div className="mt-2 text-sm font-semibold text-slate-900">{selectedProperty.bathrooms}</div>
                        </div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Monthly rent</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">£{selectedProperty.monthlyRent.toLocaleString()}/month</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Affordability ratio</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900">{selectedProperty.affordabilityMultiple.toFixed(1)}x annual rent</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Short description</div>
                        <p className="mt-3 text-sm font-medium text-slate-800">
                          {selectedProperty.shortDescription || "No short description has been added yet."}
                        </p>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Long description</div>
                        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                          {selectedProperty.longDescription || "No long description has been added yet."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <form ref={editFormRef} className="mt-4 space-y-4" onSubmit={handleUpdate}>
                      {canAssignOwner && landlordOptions.length > 0 ? (
                        <label className="block text-sm font-medium text-slate-700">
                          Landlord owner
                          <select
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            value={editForm.ownerId}
                            onChange={(event) => updateEditField("ownerId", event.target.value)}
                            required
                          >
                            {landlordOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.fullName} · {option.email}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <label className="block text-sm font-medium text-slate-700">
                        Address line 1
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                          value={editForm.addressLine1}
                          onChange={(event) => updateEditField("addressLine1", event.target.value)}
                          required
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Address line 2
                        <input
                          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                          value={editForm.addressLine2}
                          onChange={(event) => updateEditField("addressLine2", event.target.value)}
                        />
                      </label>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-slate-700">
                          Town / city
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            value={editForm.city}
                            onChange={(event) => updateEditField("city", event.target.value)}
                            required
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          Postcode
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 uppercase text-slate-900"
                            value={editForm.postcode}
                            onChange={(event) => updateEditField("postcode", event.target.value.toUpperCase())}
                            required
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-slate-700">
                          Property type
                          <select
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            value={editForm.type}
                            onChange={(event) => updateEditField("type", event.target.value)}
                            required
                          >
                            {propertyTypeOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          Listing status
                          <select
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            value={editForm.status}
                            onChange={(event) => updateEditField("status", event.target.value)}
                            required
                          >
                            {propertyStatusOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-4">
                        <label className="text-sm font-medium text-slate-700">
                          Monthly rent
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            type="number"
                            min="0"
                            value={editForm.monthlyRent}
                            onChange={(event) => updateEditField("monthlyRent", event.target.value)}
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          Bedrooms
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            type="number"
                            min="0"
                            value={editForm.bedrooms}
                            onChange={(event) => updateEditField("bedrooms", event.target.value)}
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          Bathrooms
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            type="number"
                            min="0"
                            value={editForm.bathrooms}
                            onChange={(event) => updateEditField("bathrooms", event.target.value)}
                          />
                        </label>

                        <label className="text-sm font-medium text-slate-700">
                          Salary to rent ratio
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={editForm.affordabilityMultiple}
                            onChange={(event) => updateEditField("affordabilityMultiple", event.target.value)}
                          />
                        </label>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Descriptions</div>
                            <p className="mt-1 text-sm text-slate-600">
                              Write both manually or generate a short summary plus a fuller draft from the property details.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                            disabled={isGeneratingEditDescription || isPending}
                            onClick={handleGenerateEditDescription}
                          >
                            {isGeneratingEditDescription ? "Generating..." : "Generate with AI"}
                          </button>
                        </div>
                        <label className="mt-4 block text-sm font-medium text-slate-700">
                          Short description
                          <input
                            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            value={editForm.shortDescription}
                            onChange={(event) => updateEditField("shortDescription", event.target.value)}
                            placeholder="A short summary for cards and headings."
                          />
                        </label>
                        <label className="mt-4 block text-sm font-medium text-slate-700">
                          Long description
                          <textarea
                            className="mt-2 min-h-32 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
                            value={editForm.longDescription}
                            onChange={(event) => updateEditField("longDescription", event.target.value)}
                            placeholder="A fuller property description will appear here."
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          type="submit"
                          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                          disabled={isPending}
                        >
                          {isPending ? "Saving..." : "Save changes"}
                        </button>
                        <button
                          type="button"
                          className="rounded-md border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700"
                          disabled={isPending}
                          onClick={handleDelete}
                        >
                          Delete property
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {canManage && isEditMode ? (
                  <form className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleImageUpload}>
                    <div className="text-sm font-semibold text-slate-900">Property images</div>
                    <p className="text-xs text-slate-500">
                      Images added here go through the same moderation checks as new-property uploads and remain pending until approved.
                    </p>
                    <label
                      className={`block rounded-xl border-2 border-dashed p-5 text-sm font-medium transition ${
                        isEditorDropActive ? "border-sky-500 bg-sky-50 text-sky-900" : "border-slate-300 bg-white text-slate-700"
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setIsEditorDropActive(true)
                      }}
                      onDragLeave={() => setIsEditorDropActive(false)}
                      onDrop={handleEditorDrop}
                    >
                      <span className="block font-semibold">Select images</span>
                      <span className="mt-1 block text-sm text-slate-500">Drag images here or click to browse.</span>
                      <input
                        className="sr-only"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEditorImageSelection}
                      />
                    </label>
                    <div className="text-xs text-slate-500">
                      {remainingSelectedPropertySlots} slot{remainingSelectedPropertySlots === 1 ? "" : "s"} remaining.
                    </div>
                    <PendingImagePanel
                      files={editorImageFiles}
                      previewUrls={editorPreviewUrls}
                      emptyMessage="No pending editor uploads. Drop or select files to preview them here."
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-300"
                      disabled={editorImageFiles.length === 0 || isPending || remainingSelectedPropertySlots <= 0}
                    >
                      Upload selected images
                    </button>
                  </form>
                ) : null}
              </section>

              <section className="space-y-5">
                <div>
                  <div className="font-semibold text-slate-900">Images</div>
                  <div className="text-sm text-slate-600">
                    {selectedProperty.images.length} image{selectedProperty.images.length === 1 ? "" : "s"} attached
                  </div>
                  <div className="text-xs text-slate-500">
                    {remainingSelectedPropertySlots} of {MAX_PROPERTY_IMAGES} upload slots remaining
                  </div>
                </div>

                {!canManage ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    This role can view property records but cannot modify them.
                  </div>
                ) : null}

                <div>
                  {selectedProperty.images.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                      No images uploaded yet.
                    </div>
                  ) : (
                    <PropertyImageGallery
                      propertyId={selectedProperty.id}
                      images={selectedProperty.images}
                      canManage={canManage}
                      isPending={isPending}
                      onRemove={handleImageDelete}
                    />
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
