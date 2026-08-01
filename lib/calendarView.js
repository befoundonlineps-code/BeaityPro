// What the calendar is currently showing, and which employee columns follow
// from it.
//
// One selection drives two different grids. The first three modes stay on the
// day view and only narrow its columns; picking a single professional or a
// single resource switches to a week of that one subject instead. Keeping
// them in one value means the grid asks one question — what is selected? —
// rather than juggling a filter and a mode that could disagree.

export const VIEW_ALL = 'all'
export const VIEW_ON_SHIFT = 'onShift'
export const VIEW_ROLE = 'role'
export const VIEW_EMPLOYEE = 'employee'
export const VIEW_RESOURCE = 'resource'

export const DEFAULT_SELECTION = { kind: VIEW_ALL }

// A single subject fills a week; anything else is a day with columns per
// professional.
export function isWeekView(selection) {
  return selection?.kind === VIEW_EMPLOYEE || selection?.kind === VIEW_RESOURCE
}

// Only roles somebody actually holds become categories.
//
// The enum carries administrator, executive and owner alongside the service
// roles, and a salon that has none of them should not be offered a category
// that opens onto nothing. Ordered by the translated label so the menu reads
// alphabetically in whatever language is on screen rather than in enum
// declaration order.
export function rolesInUse(employees, labelFor) {
  const roles = [...new Set((employees || []).map((e) => e.role).filter(Boolean))]
  return roles.sort((a, b) => String(labelFor(a)).localeCompare(String(labelFor(b)), 'ar'))
}

// Whether a professional counts as working on the day being shown.
//
// Read off the windows the calendar has already worked out, not recomputed
// here: those have the recurring pattern, the dated shift exceptions and the
// absence veto folded in already. Somebody marked absent therefore drops out
// of "on shift" for free, which is the answer anybody would expect and one
// nobody has to maintain separately.
export function isOnShift(windows) {
  return (windows || []).length > 0
}

// The employee columns a selection asks for.
//
// The assistant toggle keeps its meaning for the two broad modes — it hides
// helpers from a roster meant to read as "who takes their own appointments".
// Asking for a role by name overrides it: the request named that group
// explicitly, and answering it with a silently shorter list would look like
// missing data rather than like a setting.
export function visibleEmployeesFor({ employees, selection, showAssistants, windowsByEmployee }) {
  const all = employees || []
  const kind = selection?.kind || VIEW_ALL
  const withoutAssistants = () => (showAssistants ? all : all.filter((e) => !e.is_assistant))

  if (kind === VIEW_ROLE) return all.filter((e) => e.role === selection.role)
  if (kind === VIEW_EMPLOYEE) return all.filter((e) => e.id === selection.employeeId)
  if (kind === VIEW_RESOURCE) return []
  if (kind === VIEW_ON_SHIFT) {
    return withoutAssistants().filter((e) => isOnShift((windowsByEmployee || {})[e.id]))
  }
  return withoutAssistants()
}
