import { storageChoices } from './stockDocumentForm'

// Which storage the person is working in — one answer for the whole module.
//
// ⚠️ FOUR SCREENS ANSWERED THIS SEPARATELY, WITH THREE DIFFERENT DEFAULTS: the
// document screens opened on nothing chosen, the stocktake and the balances on
// the first live storage, and the document list on "all storages". Moving
// between tabs lost the choice every time, so the same person saw three answers
// to "where am I" in one session.
//
// ⚠️ AND THE LENS CARRIES NO "ALL". Only the document list can mean it: a
// balance is per storage, post_stocktake takes one storage, and a supply enters
// one storage. A lens holding "all" would force those three to pick one
// silently — the implicit choice this module spends its rounds removing. The
// list keeps an explicit widening of its own instead, because its question is a
// different one: the lens says where I am working, the list asks what happened
// in the salon.

// The storage a fresh session opens on: the first live one, or nothing when
// there is none to open on.
//
// ⚠️ Nothing rather than the first archived one. A salon whose every storage is
// archived should show "choose a storage" and not quietly work inside one
// somebody deliberately retired.
export function defaultLens(storages) {
  const live = (storages || []).find((s) => s && s.is_active !== false)
  return live ? live.id : ''
}

// What the lens offers, and it is the SAME rule the document screens already
// used — imported rather than restated. An archived storage stays listed while
// it is the one selected, so the lens cannot silently move somebody out of a
// storage they are reading.
export function lensChoices(storages, selectedId) {
  return storageChoices(storages, selectedId)
}

// The lens value to use right now.
//
// ⚠️ Derived rather than stored-on-load, so no effect writes state after a
// render. `chosen` is empty until somebody picks, and until then the answer
// follows the data — which is also what makes the first render correct instead
// of correct one render later.
export function currentLens(storages, chosen) {
  if (chosen && (storages || []).some((s) => s.id === chosen)) return chosen
  return defaultLens(storages)
}

// Whether changing the lens would destroy work that is not saved anywhere.
//
// ⚠️ THE FEATURE CAN RECREATE THE FAULT IT WAS BUILT AFTER. A shared lens means
// changing storage on the balances tab wipes an in-progress count on the
// stocktake tab — silent, plausible and permanent, exactly the class closed one
// round ago, arriving this time through a convenience rather than a filter.
//
// The count is bound to its storage and cannot survive the move, so the answer
// is to ASK rather than to migrate. The screen reports how many counts are
// unsaved; this decides.
export function lensChangeCosts(pendingCounts) {
  return Number(pendingCounts) > 0
}
