import { rangesOverlap } from './appointmentGrid'

// Resources are filled sequentially: the lowest-ordered resource is used
// up before the next one is touched, so a whole resource stays free for a
// larger booking instead of several ending up half-occupied.
function byResourceOrder(a, b) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  const created = String(a.created_at || '').localeCompare(String(b.created_at || ''))
  if (created !== 0) return created
  return String(a.id).localeCompare(String(b.id))
}

export function serviceUsesResources(serviceId, serviceResources) {
  if (!serviceId) return false
  return (serviceResources || []).some((sr) => sr.service_id === serviceId)
}

// Every unit the service may occupy, in the order they should be tried.
// Empty when the service is linked to no resource at all — such a service
// books without touching resources.
export function orderedUnitsForService(serviceId, serviceResources, resources, units) {
  if (!serviceId) return []

  const linkedIds = new Set(
    (serviceResources || []).filter((sr) => sr.service_id === serviceId).map((sr) => sr.resource_id)
  )
  if (linkedIds.size === 0) return []

  const ordered = []
  for (const resource of (resources || []).filter((r) => linkedIds.has(r.id)).sort(byResourceOrder)) {
    const resourceUnits = (units || [])
      .filter((u) => u.resource_id === resource.id)
      .sort((a, b) => a.unit_index - b.unit_index)
    ordered.push(...resourceUnits)
  }
  return ordered
}

// The units still free, given the ids busy during the window in question.
// Its length is the "X remaining" shown while booking.
export function freeUnits(orderedUnits, occupiedUnitIds) {
  const occupied = occupiedUnitIds instanceof Set ? occupiedUnitIds : new Set(occupiedUnitIds || [])
  return (orderedUnits || []).filter((u) => !occupied.has(u.id))
}

// Which units are busy for [start, end). Ranges are half-open, matching the
// tstzrange && used by the database constraint, so a booking that ends
// exactly when another begins does NOT count as occupying it — the unit is
// free again at that instant.
//
// This is the authoritative rule: the query that fetches candidate rows may
// be broader, but membership is decided here.
export function occupiedUnitIds(appointments, start, end) {
  const busy = new Set()
  for (const a of appointments || []) {
    if (!a.resource_unit_id) continue
    if (a.status !== 'booked' && a.status !== 'completed') continue
    if (!a.start_time || !a.end_time) continue
    if (rangesOverlap(start, end, new Date(a.start_time), new Date(a.end_time))) {
      busy.add(a.resource_unit_id)
    }
  }
  return busy
}

// The units a booking could take for [start, end), in fill order. The first
// entry is the one that gets claimed.
export function availableUnitsFor(orderedUnits, appointments, start, end) {
  return freeUnits(orderedUnits, occupiedUnitIds(appointments, start, end))
}

// Which exclusion constraint a Postgres 23P01 came from, so a resource
// clash and an employee clash can be told apart and reported differently.
export function conflictKind(error) {
  if (!error) return null
  const text = `${error.message || ''} ${error.details || ''}`
  if (text.includes('appointments_resource_no_overlap')) return 'resource'
  if (text.includes('appointments_no_overlap')) return 'employee'
  if (error.code === '23P01') return 'unknown'
  return null
}
