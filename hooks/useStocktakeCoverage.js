import { useState, useEffect } from 'react'
import { fetchCoverage } from '../lib/stocktakeSessionIO'

// Every stocktake ever posted, and every count in it.
//
// ⚠️ Its own hook rather than a widening of useStocktakeSession, because the
// two ask opposite questions. That one asks "what is open on THIS storage" and
// reloads whenever the lens moves; this asks "what has happened across all of
// them" and does not care about the lens at all. Folding them together would
// make the report re-read on every storage change, and make the sheet carry the
// whole history of counting to draw one shelf.
export function useStocktakeCoverage() {
  const [sessions, setSessions] = useState([])
  const [counts, setCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const result = await fetchCoverage()
      if (!result.ok) {
        // ⚠️ Read rather than dropped, and it matters more here than on most
        // screens: an empty coverage report is what a salon that has never
        // counted looks like, so a swallowed failure would say "nothing has
        // ever been counted" to somebody who counted yesterday.
        setError(result.error || new Error('stocktake coverage read returned nothing'))
        return
      }
      setError(null)
      setSessions(result.sessions)
      setCounts(result.counts)
    } catch (thrown) {
      setError(thrown)
    } finally {
      setLoading(false)
    }
  }

  return { sessions, counts, loading, error, reload: load }
}
