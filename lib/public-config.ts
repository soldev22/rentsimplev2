export const CONTACT_PHONE = "07739 870670"
export const CONTACT_PHONE_HREF = `tel:+44${CONTACT_PHONE.replace(/\s/g, "").slice(1)}`
export const LANDLORD_VIDEO_URL = process.env.NEXT_PUBLIC_LANDLORD_VIDEO_URL?.trim() || ""
