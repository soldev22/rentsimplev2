import "server-only"

import type { AuthUser, PropertyRecord, TenancyApplicationRecord } from "@/lib/auth"
import { normalizeEmail } from "@/lib/auth"
import { deletePropertyImageAssets } from "@/lib/server/blob"
import { getApplicationsContainer, getPropertiesContainer, getUsersContainer } from "@/lib/server/cosmos"
import { fetchAllQueryInBatches } from "@/lib/server/pagination"

const PRIMARY_RESET_ADMIN_EMAIL = normalizeEmail("mike@rentsimple.co.uk")

type StoredUserResetRecord = {
  id: string
  email: string
}

function assertAdmin(user: AuthUser) {
  if (user.role !== "admin") {
    throw new Error("Forbidden")
  }
}

export async function resetWorkspaceForTesting(adminUser: AuthUser) {
  assertAdmin(adminUser)

  const preservedEmails = new Set([PRIMARY_RESET_ADMIN_EMAIL, normalizeEmail(adminUser.email)])

  const [usersContainer, propertiesContainer, applicationsContainer] = await Promise.all([
    getUsersContainer(),
    getPropertiesContainer(),
    getApplicationsContainer(),
  ])

  const [users, properties, applications] = await Promise.all([
    fetchAllQueryInBatches<StoredUserResetRecord>(usersContainer, { query: "SELECT c.id, c.email FROM c" }),
    fetchAllQueryInBatches<PropertyRecord>(propertiesContainer, { query: "SELECT * FROM c" }),
    fetchAllQueryInBatches<TenancyApplicationRecord>(applicationsContainer, { query: "SELECT * FROM c" }),
  ])

  const usersToDelete = users.filter((user) => !preservedEmails.has(normalizeEmail(user.email)))

  await Promise.all(
    properties.flatMap((property) => property.images.map((image) => deletePropertyImageAssets(image))),
  )

  await Promise.all([
    ...applications.map((application) => applicationsContainer.item(application.id, application.applicantId).delete()),
    ...properties.map((property) => propertiesContainer.item(property.id, property.ownerId).delete()),
    ...usersToDelete.map((user) => usersContainer.item(user.id, user.id).delete()),
  ])

  return {
    preservedEmails: [...preservedEmails],
    deletedApplications: applications.length,
    deletedProperties: properties.length,
    deletedUsers: usersToDelete.length,
  }
}