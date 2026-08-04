import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// The stock documents and their movements.
//
// Both together, because a document without its lines is a row saying
// "something moved on Tuesday" — and the whole reason this screen exists is
// that the owner read a movement and did not recognise it as his own.
//
// ⚠️ No paging, no filters, no search, deliberately. The reference has "List of
// invoices" as a full window and it will need all three eventually; what is
// needed today is the ability to see a document and undo it, and the two rows
// that need undoing were posted this week. Paging arrives when the count asks
// for it; reversal was needed with the first wrong document.
//
// `error` is read rather than dropped, the same as the other hooks in this
// module: this list is legitimately empty on a fresh salon and the screen says
// so in words, so a swallowed failure would not fail — it would reassure.
export function useStockDocuments() {
  const [documents, setDocuments] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const [docs, moves] = await Promise.all([
        supabase.from('stock_documents').select('*'),
        supabase.from('stock_movements').select('*'),
      ])

      // Either failing fails both. A document list with its lines missing is
      // not half a list, it is a list that cannot be read.
      const failure = docs.error || moves.error
      if (failure) {
        setError(failure)
        return
      }

      setError(null)
      setDocuments(docs.data || [])
      setMovements(moves.data || [])
    } catch (thrown) {
      setError(thrown)
    } finally {
      setLoading(false)
    }
  }

  return { documents, movements, loading, error, reload: load }
}
