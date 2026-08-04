// A write that changed no rows is a refusal, not a no-op.
//
// Under RLS an UPDATE or a DELETE that no policy allows comes back 200 with an
// empty body and no error — indistinguishable from success unless the rows are
// asked for with .select(). Only INSERT raises 42501. So the two verbs that can
// fail silently are exactly the two that need counting, and the one that shouts
// is the one that would have been safe without this.
//
// ⚠️ Read what this is NOT for. It was added believing the list diffs were
// silently reporting successes the database never performed. That was wrong,
// and the owner measured it: product_set_components carries four policies, one
// per verb, DELETE among them, all granted to PUBLIC. Today a delete deletes
// and an update updates, and somebody who removes a component finds it removed.
//
// What is left is smaller and true. Today the policy protects the function, not
// the function itself. A policy withdrawn, or a USING clause narrowed, turns
// these calls from correct into lying with no line changing here and no test
// failing — and the four single-row writes in this file's callers have guarded
// themselves against exactly that since they were written. This makes the three
// list diffs do the same. Maintenance, not a repair.
//
// A short count is also what a row deleted by somebody else in the meantime
// looks like. Both deserve the same answer — "this could not be confirmed" —
// because in both cases the screen is no longer describing the table.
export function wroteAll(data, expected) {
  return Array.isArray(data) && data.length === expected
}
