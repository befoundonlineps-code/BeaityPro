// The week a date belongs to, Sunday first.
//
// Sunday is not a preference here: employee_schedules stores weekly patterns
// under day_of_week 0–6 with 0 meaning Sunday, and getDay() agrees. A week
// that started anywhere else would have to be translated back every time a
// schedule was read.

export const DAYS_IN_WEEK = 7

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// The Sunday on or before the given day.
export function weekStartISO(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() - d.getDay())
  return toISO(d)
}

// The seven dates of that week, Sunday through Saturday.
//
// Built by stepping a Date rather than by adding days to a string, so months,
// year ends and daylight-saving shifts are the platform's problem and not a
// calculation of ours.
export function weekDaysISO(dateISO) {
  const start = weekStartISO(dateISO)
  if (!start) return []
  const days = []
  for (let i = 0; i < DAYS_IN_WEEK; i += 1) {
    const d = new Date(`${start}T00:00:00`)
    d.setDate(d.getDate() + i)
    days.push(toISO(d))
  }
  return days
}

// Move a whole week at a time, keeping the position within it.
export function shiftWeekISO(dateISO, weeks) {
  const d = new Date(`${dateISO}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateISO
  d.setDate(d.getDate() + weeks * DAYS_IN_WEEK)
  return toISO(d)
}

// The pieces a range label is built from, left for the caller to put in
// whatever order the language wants.
//
// sameMonth decides which of the two phrasings applies: a week inside one
// month names it once, a week straddling two has to name both.
export function weekRangeParts(dateISO, locale) {
  const days = weekDaysISO(dateISO)
  if (days.length === 0) return null
  const first = new Date(`${days[0]}T00:00:00`)
  const last = new Date(`${days[DAYS_IN_WEEK - 1]}T00:00:00`)
  const monthName = (d) => d.toLocaleDateString(locale, { month: 'long' })

  return {
    startDay: first.getDate(),
    endDay: last.getDate(),
    startMonth: monthName(first),
    endMonth: monthName(last),
    startYear: first.getFullYear(),
    endYear: last.getFullYear(),
    sameMonth: first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear(),
  }
}

// Half-open bounds for fetching a whole week in one query, matching the
// convention every other range in this codebase uses.
export function weekBounds(dateISO) {
  const days = weekDaysISO(dateISO)
  if (days.length === 0) return null
  const from = new Date(`${days[0]}T00:00:00`)
  const to = new Date(`${days[DAYS_IN_WEEK - 1]}T00:00:00`)
  to.setDate(to.getDate() + 1)
  return { from, to }
}
