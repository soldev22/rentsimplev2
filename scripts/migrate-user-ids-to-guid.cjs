// One-off migration: replace email-based user ids with GUIDs and remap references.
// Usage: node scripts/migrate-user-ids-to-guid.cjs [--apply]
const fs = require("fs")
const { randomUUID } = require("crypto")
const { CosmosClient } = require("@azure/cosmos")

const env = {}
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}

const apply = process.argv.includes("--apply")
const db = new CosmosClient({ endpoint: env.COSMOSDB_ENDPOINT, key: env.COSMOSDB_KEY }).database(env.COSMOSDB_DATABASE)
const all = async (name) => (await db.container(name).items.query("SELECT * FROM c").fetchAll()).resources
const strip = ({ _rid, _self, _etag, _attachments, _ts, ...doc }) => doc

;(async () => {
  const users = db.container("users")
  const userDocs = await all("users")
  const idMap = new Map()
  for (const u of userDocs) if (u.id.includes("@")) idMap.set(u.id, randomUUID())
  const remap = (v) => (typeof v === "string" && idMap.has(v.toLowerCase()) ? idMap.get(v.toLowerCase()) : v)

  console.log(apply ? "APPLYING" : "DRY RUN", "- users to migrate:", idMap.size)
  for (const [from, to] of idMap) console.log(`  ${from} -> ${to}`)

  // Remap references on users that already have GUID ids.
  for (const u of userDocs.filter((u) => !idMap.has(u.id))) {
    const next = { ...strip(u), landlordAccountId: remap(u.landlordAccountId), managedByAgentId: remap(u.managedByAgentId) }
    if (next.landlordAccountId !== u.landlordAccountId || next.managedByAgentId !== u.managedByAgentId) {
      console.log("  update user refs", u.id)
      if (apply) await users.items.upsert(next)
    }
  }

  // Re-create users under their new id (id is the partition key), then delete the old record.
  for (const u of userDocs.filter((u) => idMap.has(u.id))) {
    const next = {
      ...strip(u),
      id: idMap.get(u.id),
      landlordAccountId: remap(u.landlordAccountId),
      managedByAgentId: remap(u.managedByAgentId),
      sessionTokenHash: undefined,
      sessionExpiresAt: undefined,
      updatedAt: new Date().toISOString(),
    }
    console.log("  recreate user", u.email, "->", next.id)
    if (apply) {
      await users.items.create(next)
      await users.item(u.id, u.id).delete()
    }
  }

  // Maintenance (partition /propertyId): plain in-place updates.
  for (const m of await all("maintenance")) {
    const next = { ...strip(m), tenantId: remap(m.tenantId), reportedById: remap(m.reportedById) }
    if (next.tenantId !== m.tenantId || next.reportedById !== m.reportedById) {
      console.log("  update maintenance", m.id)
      if (apply) await db.container("maintenance").items.upsert(next)
    }
  }

  // Properties (partition /ownerId) and applications (partition /applicantId): re-create when the key changes.
  for (const [name, keyField, others] of [
    ["properties", "ownerId", ["landlordId", "managedByAgentId"]],
    ["applications", "applicantId", ["landlordId", "tenantId"]],
  ]) {
    const container = db.container(name)
    for (const d of await all(name)) {
      const next = strip(d)
      for (const f of [keyField, ...others]) next[f] = remap(d[f])
      if ([keyField, ...others].every((f) => next[f] === d[f])) continue
      console.log(`  update ${name}`, d.id)
      if (!apply) continue
      if (next[keyField] !== d[keyField]) {
        await container.items.create(next)
        await container.item(d.id, d[keyField]).delete()
      } else {
        await container.items.upsert(next)
      }
    }
  }

  console.log("Done.")
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
