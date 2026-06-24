import Link from "next/link"
import { redirect } from "next/navigation"

import PropertyBulkUploadForm from "@/components/forms/PropertyBulkUploadForm"
import { getUserRole, isPendingApproval } from "@/lib/auth"
import { getSessionUser } from "@/lib/server/session"

export const dynamic = "force-dynamic"

export default async function PropertyBulkUploadPage() {
  const user = await getSessionUser()

  if (!user) {
    redirect("/login")
  }

  if (isPendingApproval(user)) {
    redirect("/waiting")
  }

  const role = getUserRole(user)
  if (!["landlord", "agent"].includes(role)) {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Bulk Upload Properties</h1>
        <p className="text-slate-600 mt-1">
          Upload multiple properties at once with CSV and images
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Upload Properties</h2>
          <p className="text-sm text-slate-600 mb-4">
            Prepare a ZIP file with your properties CSV file and images folder. All properties
            will be created in draft status for review before publishing.
          </p>
        </div>

        <PropertyBulkUploadForm landlordEmail={user.email} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">CSV Format Example</h3>
          <pre className="text-xs bg-white p-3 rounded overflow-x-auto border border-slate-200">
{`address,city,postcode,propertyType,bedrooms,bathrooms,monthlyRent,shortDescription,imageFiles
42 Main Street,London,SW1A 1AA,flat,2,1,1500,Beautiful 2-bed flat,"prop1-front.jpg,prop1-kitchen.jpg"
15 Oak Road,Manchester,M1 1AD,house,3,2,2000,Victorian terraced house,"prop2-ext.jpg"`}
          </pre>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <h3 className="font-semibold text-slate-900 mb-3">File Structure</h3>
          <pre className="text-xs bg-white p-3 rounded overflow-x-auto border border-slate-200">
{`properties.zip
├── properties.csv
└── images/
    ├── prop1-front.jpg
    ├── prop1-kitchen.jpg
    ├── prop2-ext.jpg
    └── prop2-bedroom.jpg`}
          </pre>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-semibold text-blue-900 mb-3">Important</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li>• All properties will start in <strong>draft status</strong></li>
          <li>• You must review each property before publishing</li>
          <li>• The system will validate addresses, postcodes, and rental prices</li>
          <li>• Images should be JPG, PNG, WebP, or GIF format</li>
          <li>• For legal and audit purposes, all uploads are logged with your email and timestamp</li>
        </ul>
      </div>

      <div className="flex gap-2">
        <Link
          href="/dashboard/properties"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          ← Back to Properties
        </Link>
      </div>
    </div>
  )
}
