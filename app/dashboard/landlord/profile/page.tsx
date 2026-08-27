import { redirect } from "next/navigation"

export default function LandlordProfilePage() {
  redirect("/dashboard/settings?tab=profile")
}