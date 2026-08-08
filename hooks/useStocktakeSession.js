import { useState, useEffect, useCallback } from 'react'
import {
  fetchOpenSession, openSession, saveCount, removeCount, discardSession,
} from '../lib/stocktakeSessionIO'
import { baseUnitsFor } from '../lib/stockDocument'
import { defaultCountUom } from '../lib/stocktakeSheet'

// The count in progress, held where the page can see it AND written to the
// database as it is typed.
//
// ⚠️ WHY BOTH. The raw strings still live in React because typing has to be
// instant and because the difference between '' and '0' is the whole of
// COUNT_STATE — Number() destroys it. The rows exist in the database because
// React state does not survive F5, a closed browser, or the person finishing
// the count on a different device, and being called away mid-count is the
// ordinary case rather than the exception.
//
// So this is a cache over rows, not a second source of truth: every write goes
// through immediately, and a reload rebuilds the cache from the rows.
//
// ⚠️ AND THE RULE THAT KEEPS THEM HONEST: THE DATABASE NEVER HOLDS A COUNT THE
// SCREEN IS NOT SHOWING. Clearing a box deletes the row. Typing something
// unusable — a negative, a letter, a unit this product does not have — deletes
// it too, because an unusable count is not a count. Without that, the sheet
// shows -3, the table still holds the 5 typed a minute ago, and posting writes
// the 5. Silent, plausible, permanent.
export function useStocktakeSession(storageId) {
  const [session, setSession] = useState(null)
  const [startedBy, setStartedBy] = useState(null)
  const [startedAt, setStartedAt] = useState(null)
  const [counts, setCounts] = useState({})
  const [uoms, setUoms] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [writeError, setWriteError] = useState(null)

  const load = useCallback(async () => {
    if (!storageId) {
      setSession(null); setCounts({}); setUoms({}); setLoading(false); setError(null)
      return
    }
    setLoading(true)
    try {
      const result = await fetchOpenSession(storageId)
      if (!result.ok) {
        // ⚠️ Read rather than dropped. An empty sheet is what a storage with
        // nothing counted looks like, so a swallowed failure would not fail —
        // it would say "start counting" over a count that already exists, and
        // the first box typed would collide with rows nobody could see.
        setError(result.error || new Error('stocktake session read returned nothing'))
        return
      }
      setError(null)
      setSession(result.session)
      setStartedBy(result.session ? result.session.started_by : null)
      setStartedAt(result.session ? result.session.started_at : null)
      setCounts(rawCountsOf(result.counts))
      setUoms(framesOf(result.counts))
    } catch (thrown) {
      setError(thrown)
    } finally {
      setLoading(false)
    }
  }, [storageId])

  useEffect(() => { load() }, [load])

  // The session is created by the first count, not by arriving on the tab.
  // ⚠️ Opening one on arrival would put an empty session on every storage
  // somebody merely looked at, and the partial unique index would then make
  // each of those a "count in progress" that another person is asked about.
  async function ensureSession(salonId) {
    if (session) return { ok: true, session }
    const opened = await openSession({ salonId, storageId })
    if (!opened.ok) return { ok: false, error: opened.error }
    setSession(opened.session)
    setStartedBy(opened.session.started_by)
    setStartedAt(opened.session.started_at)
    // Joining somebody else's open sheet brings their counts with it — the
    // race path in openSession, and the ordinary "two people, one storage" one.
    if (opened.joined) {
      setCounts(rawCountsOf(opened.counts))
      setUoms(framesOf(opened.counts))
    }
    return { ok: true, session: opened.session, joined: opened.joined }
  }

  // What the screen calls when a box loses focus, or when its frame changes.
  //
  // `raw` is exactly what is in the box. product is needed for the packaging
  // factor: the row stores base units so the arithmetic cannot be redone
  // differently by a report later, and the typed pair is stored beside it so
  // the sheet can be redrawn saying "3 packages" rather than "750".
  async function writeCount({ salonId, product, raw, uom }) {
    setWriteError(null)
    const frame = uom || defaultCountUom(product)
    const usable = usableCount(raw, product, frame)

    // Not a count: clear whatever the table is holding for this product.
    if (usable === null) {
      if (!session) return
      const removed = await removeCount({ sessionId: session.id, productId: product.id })
      // ⚠️ A delete that removes nothing is the ordinary case here — there was
      // no row — so it is not reported. removeCount cannot tell that from RLS
      // refusing, and this is the one caller where the difference does not
      // matter: either way the table holds no count, which is what was wanted.
      if (removed.error) setWriteError(removed.error)
      return
    }

    const ready = await ensureSession(salonId)
    if (!ready.ok) { setWriteError(ready.error || new Error('could not open a stocktake session')); return }

    const written = await saveCount({
      sessionId: ready.session.id,
      salonId,
      productId: product.id,
      countedBase: usable,
      enteredQuantity: Number(raw),
      enteredUom: frame,
    })
    if (!written.ok) {
      setWriteError(written.error || new Error('the count was not saved'))
    }
  }

  // Throwing the whole sheet away. The screen names the number first.
  async function discard() {
    if (!session) { setCounts({}); setUoms({}); return { ok: true } }
    const result = await discardSession(session.id)
    if (!result.ok) { setWriteError(result.error || new Error('the count could not be discarded')); return result }
    setSession(null); setStartedBy(null); setStartedAt(null); setCounts({}); setUoms({})
    return result
  }

  // After posting: the rows now belong to a document and this sheet is over.
  // ⚠️ Not a reload — post_stocktake_session set document_id, so fetchOpenSession
  // would correctly find nothing, and asking it would be a round trip to be told
  // what we already know.
  function clearAfterPost() {
    setSession(null); setStartedBy(null); setStartedAt(null); setCounts({}); setUoms({})
  }

  return {
    session, startedBy, startedAt, counts, uoms, loading, error, writeError,
    setCounts, setUoms, reload: load, writeCount, discard, clearAfterPost,
  }
}

// The base-unit value this box would store, or null when it is not a count.
//
// ⚠️ Zero returns 0 and not null, and the distinction is the point: '' means
// nobody counted this and '0' means the shelf is empty, which is the finding
// most likely to differ from the record. `if (!usable)` anywhere on this path
// would collapse them.
function usableCount(raw, product, frame) {
  const text = String(raw ?? '').trim()
  if (text === '') return null
  const typed = Number(text)
  if (!Number.isFinite(typed) || typed < 0) return null
  const factor = baseUnitsFor(product, frame)
  if (factor === null) return null
  return typed * factor
}

// The rows, back into the shape the sheet holds.
//
// ⚠️ counted_entered_quantity and not counted_base, because the frame is stored
// beside it: somebody who counted 3 packages must see 3 again, not 750. The
// fallback exists for a row written before the frame was recorded, and reads it
// in base units, which is what it is.
const rawCountsOf = (rows) => Object.fromEntries((rows || []).map((row) => [
  row.product_id,
  String(row.counted_entered_quantity ?? row.counted_base ?? ''),
]))

const framesOf = (rows) => Object.fromEntries((rows || []).flatMap((row) => (
  row.counted_entered_uom ? [[row.product_id, row.counted_entered_uom]] : []
)))
