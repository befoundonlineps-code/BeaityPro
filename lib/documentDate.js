// The date a person puts on a stock document — one place, for every writer.
//
// ⚠️ THE OWNER'S DECISION, and its shape matters as much as its content:
// a document records something that HAPPENED, so a date in the future is not a
// document. Four of his five real documents carried future dates, which is how
// this was found.
//
// ⚠️ AT THE INPUT ONLY — NO TRIGGER, and the reason is not preference.
// `CHECK (doc_date <= now())` is refused by Postgres outright: now() is not
// immutable and a CHECK may only call immutable functions. A trigger could do
// it, and would be the wrong price: doc_date enters no calculation today (the
// balance is a sum over movements, order-independent, and the cost chain sorts
// by created_at rather than doc_date), so a wrong date misleads a reader and
// corrupts nothing. That is a display fault, and the screen is where display
// faults are guarded.
//
// ⚠️ NO LOWER BOUND, deliberately. Recording a purchase from last month is
// ordinary and is exactly what a person does the first week they use this. A
// `min` would refuse the commonest legitimate backdating.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

const pad = (n) => String(n).padStart(2, '0')

// Today, where the person is standing.
//
// ⚠️ NOT `toISOString().slice(0, 10)`, which is UTC. The screen used that for
// its default and it is wrong for anybody east of Greenwich: at 01:00 in
// Palestine (UTC+3) the UTC date is still yesterday, so a supply entered after
// midnight would be dated the day before — silently, and looking perfectly
// ordinary in the list.
export function today(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// What the date field's `max` attribute should be.
//
// ⚠️ The bound is a DAY, not an instant, and that is what makes "end of day"
// automatic rather than arithmetic. Comparing against now() would refuse a
// document dated today, because today's date read as a timestamp is midnight
// and midnight has already passed. Comparing day to day, every hour of today
// passes and tomorrow does not — with no timezone conversion anywhere.
export const maxDocumentDate = today

// '' when the date is fit to send, or the key of the reason it is not.
//
// ⚠️ The shape is checked before the comparison, and not for tidiness: these
// are compared as STRINGS, which is exact for YYYY-MM-DD and arbitrary for
// anything else. Measured against a today of '2026-08-06', with every
// candidate being tomorrow written some other way:
//
//   '07/08/2026'    sorts LOW  → would be ACCEPTED        ← the dangerous half
//   ' 2026-08-07'   sorts LOW  → would be ACCEPTED
//   '2026-8-7'      sorts HIGH → refused, but as "future"
//   '26-08-07'      sorts HIGH → refused, but as "future"
//
// So it fails in both directions and the shape decides which — a pasted
// day-first date walks straight through. Refusing what this function cannot
// judge is the only answer that does not depend on how the day was spelt.
export function documentDateError(value, now = new Date()) {
  if (!value) return 'products:docs.dateRequiredError'
  if (!ISO_DAY.test(String(value))) return 'products:docs.dateInvalidError'
  if (String(value) > maxDocumentDate(now)) return 'products:docs.dateFutureError'
  return ''
}
