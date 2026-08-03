// Which screen the services page shows, given what has arrived so far.
//
// It exists because the answer used to be three-way — loading, no business
// types, the browser — and the loading branch returned a different element
// from the other two. React tears down a subtree whose element type changed,
// so every refetch destroyed the component holding the selected folder, the
// expanded branches and the search box. Saving a service reloaded the
// catalogue, and the screen came back with all of it blank.
//
// The gate itself was old and had been harmless for as long as that state sat
// in the same component as the gate: an early return inside a component does
// not unmount it, so its own useState survives. Splitting the component in two
// — done so the layout could be rendered and measured at all — moved the state
// into a child, and the untouched gate started destroying it.
//
// So there is no 'loading' screen any more. Loading is a thing the browser
// shows about itself, not a different thing shown instead of it.
export function browserScreen({ loading, typeCount }) {
  // A salon with no business types chosen gets an explanation instead. Only
  // once loading has settled, so it does not flash before the answer is known.
  if (!loading && typeCount === 0) return 'noTypes'
  return 'browser'
}
