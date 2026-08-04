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
  return keyedLinkDiff(existingRows, selectedIds, (row) => row[idColumn])
}

// The same diff for a join table whose rows are not identified by one column.
//
// storage_responsibles is the case: a row names either an employee or a role,
// never both, so "which one is this" is a question about two columns at once.
// Rather than a third copy of insert-what-is-new, delete-what-is-gone, the
// caller says how to read a row's identity and gets the same answer back.
export function keyedLinkDiff(existingRows, selectedKeys, keyOf) {
  const rows = existingRows || []
  // Deduplicated deliberately. service_resources has unique(service_id,
  // resource_id), so a repeated id is not a second link — it is a failed
  // insert that takes the whole batch down with it, valid rows included.
  const chosen = [...new Set(selectedKeys || [])]
  const present = new Set(rows.map(keyOf))
  const wanted = new Set(chosen)

  return {
    toAdd: chosen.filter((key) => !present.has(key)),
    toRemoveIds: rows.filter((row) => !wanted.has(keyOf(row))).map((row) => row.id),
  }
}

// The link rows belonging to one service, or to one resource, out of every
// link row in the salon — which is how both screens receive them.
export function linksFor(rows, idColumn, id) {
  if (!id) return []
  return (rows || []).filter((row) => row[idColumn] === id)
}
