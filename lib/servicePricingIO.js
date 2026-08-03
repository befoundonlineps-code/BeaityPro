import { supabase } from './supabaseClient'

// Writing the prices the matrix changed.
//
// Split out of the dialog for the reason every *IO in this project is: the
// shape of the write is the part that can be got wrong invisibly — the wrong
// table, a missing eq, an update that touches every row — and none of that is
// checkable while it is buried in a click handler.
//
// One statement per row rather than an upsert of the lot. services rows carry
// far more than a price, and an upsert would need every column of every row
// to avoid nulling something; these are the touched ones only, and there are
// never many.
export async function saveServicePrices(changes, client = supabase) {
  const written = []

  for (const change of changes || []) {
    const { error } = await client
      .from('services')
      .update({ price: change.price })
      .eq('id', change.id)

    if (error) return { written, error }
    written.push(change.id)
  }

  return { written, error: null }
}
