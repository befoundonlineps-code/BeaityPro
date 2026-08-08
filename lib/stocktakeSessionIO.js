import { supabase } from './supabaseClient'

// The count in progress: opened, written to as it is typed, and either posted
// or discarded.
//
// ⚠️ EVERY WRITE HERE IS ONE ROW AND ONE STATEMENT, which is why this file
// carries none of the compensation lib/productOrderIO.js needs. An order is a
// parent and its lines written as a pair with no transaction between them; a
// count is a single upsert that either lands or does not. There is no half.
//
// The posting itself is NOT here — it is post_stocktake_session, an RPC, in
// lib/stockIO.js, because that one really is several writes that must be one:
// a document, a movement per difference, a balance on every count, and the
// session's closure. That is the line this module has always drawn.

// Whichever count is open on this storage, with its rows, or nulls.
//
// ⚠️ Both or neither, the rule every read in this module keeps: a session drawn
// without its counts says "nothing has been counted yet", which is a real state
// this screen shows. Half a read would look like data.
export async function fetchOpenSession(storageId, client = supabase) {
  const found = await client
    .from('stocktake_sessions')
    .select('id, salon_id, storage_id, started_by, started_at')
    .eq('storage_id', storageId)
    .is('document_id', null)
    .limit(1)

  if (found.error) return { ok: false, error: found.error, session: null, counts: [] }
  const session = (found.data || [])[0] || null
  if (!session) return { ok: true, error: null, session: null, counts: [] }

  const counts = await client
    .from('stocktake_counts')
    .select('id, product_id, counted_base, counted_entered_quantity, counted_entered_uom, counted_at')
    .eq('session_id', session.id)

  if (counts.error) return { ok: false, error: counts.error, session: null, counts: [] }
  return { ok: true, error: null, session, counts: counts.data || [] }
}

// Every session and every count, for the coverage report.
//
// ⚠️ NOT NARROWED TO POSTED ONES IN THE QUERY, and that is deliberate rather
// than lazy. lib/stocktakeCoverage.js drops the open ones, and it is where the
// rule is stated and tested — a `.not.is('document_id', null)` here would be a
// second copy of it, agreeing today and free to drift, on the rule that decides
// whether an abandoned count pollutes a report.
export async function fetchCoverage(client = supabase) {
  const sessions = await client
    .from('stocktake_sessions')
    .select('id, storage_id, started_by, started_at, document_id')

  if (sessions.error) return { ok: false, error: sessions.error, sessions: [], counts: [] }

  const counts = await client
    .from('stocktake_counts')
    .select('session_id, product_id, counted_base, balance_at_post, counted_at')

  if (counts.error) return { ok: false, error: counts.error, sessions: [], counts: [] }

  // ⚠️ Both or neither. Sessions drawn without their counts would report every
  // stocktake as having covered nothing — a coverage report that says the work
  // was never done, which is worse than one that says it failed.
  return { ok: true, error: null, sessions: sessions.data || [], counts: counts.data || [] }
}

// Start counting this storage, or hand back the count already open on it.
//
// ⚠️ THE UNIQUE INDEX IS PART OF THIS FUNCTION, not an obstacle to it. Two
// people pressing "start" at the same instant both find nothing open and both
// insert; one of them gets 23505, and the honest answer to that is not an error
// message — it is the session the other one just made. Checking first and
// inserting second cannot close that window; catching the refusal can.
export async function openSession({ salonId, storageId }, client = supabase) {
  const existing = await fetchOpenSession(storageId, client)
  if (!existing.ok) return { ok: false, error: existing.error, session: null, counts: [], joined: false }
  if (existing.session) return { ...existing, joined: true }

  const created = await client
    .from('stocktake_sessions')
    .insert([{ salon_id: salonId, storage_id: storageId }])
    .select()

  if (created.error) {
    // 23505 is the partial unique index, and it means somebody won the race.
    if (created.error.code === '23505') {
      const raced = await fetchOpenSession(storageId, client)
      if (raced.ok && raced.session) return { ...raced, joined: true }
    }
    return { ok: false, error: created.error, session: null, counts: [], joined: false }
  }

  // No error and no rows is RLS declining, which from here looks like success.
  if (!created.data || created.data.length === 0) {
    return { ok: false, error: null, session: null, counts: [], joined: false }
  }

  return { ok: true, error: null, session: created.data[0], counts: [], joined: false }
}

// One product's count, written the moment it is typed.
//
// ⚠️ AN UPSERT AND NOT AN INSERT, on (session_id, product_id). Counting a
// product twice CORRECTS the first answer; without the conflict target the
// sheet would accumulate a row per correction and post whichever the planner
// happened to return first — a stocktake decided by row order.
export async function saveCount(
  { sessionId, salonId, productId, countedBase, enteredQuantity, enteredUom },
  client = supabase
) {
  const { data, error } = await client
    .from('stocktake_counts')
    .upsert([{
      session_id: sessionId,
      salon_id: salonId,
      product_id: productId,
      counted_base: countedBase,
      counted_entered_quantity: enteredQuantity ?? null,
      counted_entered_uom: enteredUom || null,
    }], { onConflict: 'session_id,product_id' })
    .select()

  if (error) return { ok: false, error, row: null }
  if (!data || data.length === 0) return { ok: false, error: null, row: null }
  return { ok: true, error: null, row: data[0] }
}

// Taking a product back off the sheet — "I did not count this after all",
// which is a different statement from counting zero.
//
// ⚠️ Counted zero says the shelf is empty and posts a difference. Removed says
// nothing about this product, and it will not appear in the coverage report.
// The screen must not offer one where the person means the other.
export async function removeCount({ sessionId, productId }, client = supabase) {
  const { data, error } = await client
    .from('stocktake_counts')
    .delete()
    .eq('session_id', sessionId)
    .eq('product_id', productId)
    .select()

  if (error) return { ok: false, error }
  // A delete nobody is allowed comes back 200 with an empty body under RLS.
  // ⚠️ So does deleting a row that was already gone, and here they deserve the
  // same answer: the screen is no longer describing the table either way.
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}

// Throwing the whole count away, which is what "discard and start fresh" does.
//
// ⚠️ THE COUNTS GO BY CASCADE, and the cascade bypasses row security — so for
// THIS path the gate is the session's own DELETE policy, which 054a narrows to
// `document_id is null`. A posted count cannot be discarded by this call, by
// the database and not by this code: a posted session records a real count at a
// real time, and it stays true even after the stocktake is reversed.
//
// ⚠️ AND DELETING THE COUNTS HERE TOO WOULD NOT BE UNGATED — an earlier version
// of this comment said so and was wrong, caught in review. A direct delete
// meets stocktake_counts_delete, which 054a narrows with an EXISTS on the
// parent, so both roads are guarded and a posted session's counts are refused
// on either.
//
// The real objection is the one the rest of this file is built on: two
// statements where one will do is a HALF STATE where there was none. Counts
// gone and the session delete refused for any reason leaves an open sheet with
// nothing on it — and nothing above needed compensation precisely because every
// write here is single.
//
// ⚠️ And this destroys an hour of somebody's work, unlike deleting an order.
// The screen names the number before calling it.
export async function discardSession(sessionId, client = supabase) {
  const { data, error } = await client
    .from('stocktake_sessions')
    .delete()
    .eq('id', sessionId)
    .select()

  if (error) return { ok: false, error }
  if (!data || data.length === 0) return { ok: false, error: null }
  return { ok: true, error: null }
}
