// A write that changed no rows is a refusal, not a no-op.
//
// Under RLS an UPDATE or a DELETE that no policy allows comes back 200 with an
// empty body and no error — indistinguishable from success unless the rows are
// asked for with .select(). Only INSERT raises 42501. So the two verbs that can
// fail silently are exactly the two that need counting, and the one that shouts
// is the one that would have been safe without this.
//
// The single-row writes in productAdminIO.js and inventoryAdminIO.js have said
// this since they were written ("no error and no rows is a refusal"). The list
// diffs did not, which made them the only writes in either file that could
// report a success the database never performed.
//
// A short count is also what a row deleted by somebody else in the meantime
// looks like. Both deserve the same answer — "this could not be confirmed" —
// because in both cases the screen is no longer describing the table.
export function wroteAll(data, expected) {
  return Array.isArray(data) && data.length === expected
}
