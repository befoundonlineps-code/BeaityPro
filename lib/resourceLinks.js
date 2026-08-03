// Turning a chosen set of ids into the two writes that make a join table match
// it: the rows to insert and the rows to delete.
//
// Both ends of the service↔resource link need exactly this. It was written
// inline inside ResourceFormDialog first, and putting a second inline copy in
// the service dialog would be a copy that drifts — the two screens would
// eventually disagree about some edge (a repeated id, a link deleted by
// somebody else) and only one of them would show it.
//
// idColumn names the side being chosen: 'service_id' when standing on a
// resource picking its services, 'resource_id' when standing on a service
// picking its resources.
export function linkDiff(existingRows, selectedIds, idColumn) {
  const rows = existingRows || []
  // Deduplicated deliberately. service_resources has unique(service_id,
  // resource_id), so a repeated id is not a second link — it is a failed
  // insert that takes the whole batch down with it, valid rows included.
  const chosen = [...new Set(selectedIds || [])]
  const present = new Set(rows.map((row) => row[idColumn]))
  const wanted = new Set(chosen)

  return {
    toAdd: chosen.filter((id) => !present.has(id)),
    toRemoveIds: rows.filter((row) => !wanted.has(row[idColumn])).map((row) => row.id),
  }
}

// The link rows belonging to one service, or to one resource, out of every
// link row in the salon — which is how both screens receive them.
export function linksFor(rows, idColumn, id) {
  if (!id) return []
  return (rows || []).filter((row) => row[idColumn] === id)
}
