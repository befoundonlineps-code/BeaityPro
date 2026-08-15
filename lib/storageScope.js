// What "which storage" can answer, and nothing else.
//
// ⚠️ THIS FILE IMPORTS NOTHING, AND THAT IS ITS WHOLE JOB. The sentinel started
// in storageLens.js, which is its natural home — but storageLens imports
// stockDocumentForm, which imports documentFilters, which needs the sentinel to
// resolve the document list. That closes a cycle:
//
//     documentFilters → storageLens → stockDocumentForm → documentFilters
//
// ES modules tolerate a cycle and then fail at the worst moment: a const read
// during module evaluation comes back undefined rather than throwing. Here the
// read is inside a function body so it would probably survive — and "probably
// survives" is the reason to move it rather than the reason to keep it.
//
// Same move raisedCodes.js already made, and for the same sentence: living
// here, both can read it without either importing the other.

// The whole salon rather than a place inside it.
//
// ⚠️ A sentinel and not '' or null, because those already mean "nothing chosen
// yet" — and the two must not collapse. Nothing-chosen falls back to a real
// storage; all-storages does not, and a catalogue that quietly opened on one
// storage would be calling itself the catalogue.
export const ALL_STORAGES = 'all'

// Whether this view may hold ALL.
//
// ⚠️ FAILS CLOSED. A view this has never heard of cannot widen, so a screen
// added next year defaults to one real storage. The asymmetry is the point: a
// narrower view than somebody asked for is a nuisance, and a stocktake posted
// against "all storages" is not a view at all — it is a write with no place.
//
//   catalog · documents   "what do I have" · "what happened" — the whole salon
//                         can answer both
//   everything else       writes or reads one storage, and must name it
const WIDENABLE_VIEWS = new Set(['catalog', 'documents'])
export function lensMayWiden(view) {
  return WIDENABLE_VIEWS.has(view)
}

// The storage a screen is actually showing: a real id, or '' meaning "do not
// narrow".
//
// ⚠️ ONE ARGUMENT NOW, AND IT USED TO TAKE TWO. The second was the document
// list's own `allStorages` checkbox — a control it kept because it was the only
// screen where "all" was a real question. It is not the only one any more: the
// lens itself widens for exactly the two views that can mean it, so the
// checkbox became a second control for a question the header above it already
// answered. Which is the fault the catalogue's own picker had just been merged
// away for, still sitting one screen over.
export function storageInForce(lensStorageId) {
  if (!lensStorageId || lensStorageId === ALL_STORAGES) return ''
  return lensStorageId
}

// Which views cannot be entered without naming one real storage.
//
// 🔴 AND THE REASON IS NOT THAT THEY WOULD BREAK — IT IS THAT THEY WOULD NOT.
// currentLens resolves ALL to the default storage on any view that may not
// widen, so pressing "stocktake" from a catalogue showing all storages lands
// on the first live storage and counts it. Nothing errors. Somebody counts a
// shelf they did not choose.
//
// ⇒ That is the implicit choice this module spends its rounds removing, so the
// button is DISABLED while the lens is wide rather than allowed to resolve
// quietly. The lens sits on the same screen, so the fix is one control away and
// visible — which is the difference between a refusal and a dead end.
//
// ⚠️ AND IT IS THE SAME MECHANISM AS THE TOOLBAR, not a second gate at the
// moment of navigation. A gate would be a parallel path with its own rules to
// keep in step; this is the one question — does this screen need a storage —
// asked once. lib/storageScopedOperations.test.js asserts the two agree
// wherever both have an opinion.
//
// ⚠️ balances and coverage are here and are NOT in OPERATION_TABLE, because
// they write nothing — they READ one storage. isStorageScoped is about the row
// an operation writes and answers false for them, which is right for its own
// question and wrong for this one. Two questions, one of them wider.
//
// 🔴 AND `orders` JOINED THEM, WHICH REVERSES A SENTENCE THIS MODULE USED TO
// REPEAT: «order is the only operation that stays lit at all storages».
//
// It stayed lit because product_orders has no storage column — true then, true
// now, and never the whole question. The order SCREEN was rebuilt to the
// reference: its first window asks «which of THIS storage's folders», and its
// grid shows «what is in stock HERE». Both are unanswerable at «all storages».
//
// ⚠️ So the storage became a LENS on this screen without becoming a COLUMN on
// its row — and the two facts live in different files precisely because they
// are different questions. isStorageScoped('order') is still false and
// storageScopedOperations.test.js still asserts it; nothing about the schema
// moved. What moved is what the screen needs in order to draw.
//
// ⚠️ 067_3 recorded the contradiction long before it was resolved: the
// reference greys «Order products» at all-storages and we did not, and copying
// the greying then «would give us a rule that works by accident». It is no
// longer an accident — the reason is now ours and is written above.
const NEEDS_REAL_STORAGE = new Set([
  'supply', 'write_off', 'return_to_supplier', 'transfer',
  'stocktake', 'coverage', 'balances', 'orders',
])
export function needsRealStorage(view) {
  return NEEDS_REAL_STORAGE.has(view)
}

// Whether a navigation target is refused right now, and why it would be.
export function navigationBlocked(view, lensStorageId) {
  return needsRealStorage(view) && (!lensStorageId || lensStorageId === ALL_STORAGES)
}
