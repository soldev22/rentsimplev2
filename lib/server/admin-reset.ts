import "server-only"

import type { AuthUser, PropertyRecord, TenancyApplicationRecord } from "@/lib/auth"
import { deletePropertyImageAssets } from "@/lib/server/blob"
import { getApplicationsContainer, getPropertiesContainer } from "@/lib/server/cosmos"
import { fetchAllQueryInBatches } from "@/lib/server/pagination"

function assertAdmin(user: AuthUser) {
  if (user.role !== "admin") {
    throw new Error("Forbidden")
  }
}

export async function resetWorkspaceForTesting(adminUser: AuthUser) {
  assertAdmin(adminUser)

  const [propertiesContainer, applicationsContainer] = await Promise.all([
    getPropertiesContainer(),
    getApplicationsContainer(),
  ])

  const [properties, applications] = await Promise.all([
    fetchAllQueryInBatches<PropertyRecord>(propertiesContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<TenancyApplicationRecord>(applicationsContainer, { query: "SELECT * FROM c" }),
  ])

  await Promise.all(
    properties.flatMap((property) => property.images.map((image) => deletePropertyImageAssets(image))),
  )

  await Promise.all([
    ...applications.map((application) => applicationsContainer.item(application.id, application.applicantId).delete()),
    ...properties.map((property) => propertiesContainer.item(property.id, property.ownerId).delete()),
  ])

  return {
    deletedApplications: applications.length,
    deletedProperties: properties.length,
    deletedUsers: 0,
  }
}