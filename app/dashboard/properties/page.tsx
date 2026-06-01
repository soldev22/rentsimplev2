export default function PropertiesPage() {
  const properties = [
    { id: 1, address: "10 High Street", type: "House" },
    { id: 2, address: "Flat 2, City Road", type: "Flat" }
  ]

  return (
    <div className="p-5">
      <h1 className="text-xl font-bold mb-5">Properties</h1>

      <ul className="space-y-2">
        {properties.map((p) => (
          <li key={p.id} className="border p-2 rounded">
            {p.address} - {p.type}
          </li>
        ))}
      </ul>
    </div>
  )
}
