// A save that has a delete inside it, and the one question that has to come
// first.
//
// Two windows need this now, so it is one function rather than two that drift.
// The shape is always the same: changing one field on a form makes rows that
// hang off the row illegal, the database refuses the update while they exist,
// and the honest thing is to do the deletion the screen implies rather than
// explain an ordering constraint to somebody who did not ask about one.
//
// Three answers, not two, because the delete is the part nobody asked for:
//   'save'         nothing is going away
//   'confirmDrop'  it is, and nobody has said yes yet
//   'dropThenSave' they have, so delete the rows and then write the row
//
// `dropping` is derived on every render rather than stored, so undoing the
// change that caused it withdraws the question by itself. `confirmed` is stored
// — it has to be, because the answer is a press — and the caller clears it when
// the field changes, so that leaving and coming back asks again rather than
// acting on a yes given about a different state.
export function dropAction({ dropping, confirmed }) {
  if (!dropping) return 'save'
  return confirmed ? 'dropThenSave' : 'confirmDrop'
}
