import { storageChoices } from './stockDocumentForm'
import { ALL_STORAGES, lensMayWiden } from './storageScope'

// Which storage the person is working in — one answer for the whole module.
//
// ⚠️ FOUR SCREENS ANSWERED THIS SEPARATELY, WITH THREE DIFFERENT DEFAULTS: the
// document screens opened on nothing chosen, the stocktake and the balances on
// the first live storage, and the document list on "all storages". Moving
// between tabs lost the choice every time, so the same person saw three answers
// to "where am I" in one session.
//
// ⚠️ THE LENS USED TO CARRY NO "ALL" AT ALL, and the reason was right for the
// screens it had: a balance is per storage, post_stocktake takes one storage, a
// supply enters one storage. A lens holding "all" would make those three pick
// one silently — the implicit choice this module spends its rounds removing.
//
// 🔴 THEN THE CATALOGUE GREW A BALANCE COLUMN, and with it a real answer to
// "which storage" for the first time — so it was excluded from the lens on a
// premise that had expired ("a lens above it would be a control that does
// nothing"). It was briefly given a SECOND picker of its own instead, which is
// two controls for one concept: set the lens to تجريبي, move to the catalogue,
// and the catalogue says "all storages". One screen, two answers to one
// question — the fault this module keeps closing, opened by the fix for
// another.
//
// ✅ SO THE LENS WIDENS, AND ONLY WHERE WIDENING MEANS SOMETHING:
//
//   catalog · documents   may hold ALL — their question is "what do I have"
//                         and "what happened", which the whole salon can answer
//   everything else       one real storage, exactly as before
//
// ⚠️ And `lensMayWiden` FAILS CLOSED: a view it has never heard of gets a real
// storage. A caller that forgets to say which view it is cannot be handed
// "all" by accident, which is the direction that matters — the cost of being
// wrong is a stocktake posted against no storage.

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

// ⚠️ Re-exported from lib/storageScope.js rather than defined here, and the
// reason is a cycle: this file imports stockDocumentForm, which imports
// documentFilters, which needs the sentinel too. A leaf module with no imports
// is what lets both read it without either importing the other — the same move
// raisedCodes.js already made.
export { ALL_STORAGES, lensMayWiden }

// The lens value to use right now.
//
// ⚠️ Derived rather than stored-on-load, so no effect writes state after a
// render. `chosen` is empty until somebody picks, and until then the answer
// follows the data — which is also what makes the first render correct instead
// of correct one render later.
// ⚠️ `view` is the third argument and not an option: the same stored choice
// means different things depending on where it is read. Somebody standing on
// the catalogue with ALL and pressing "supply" must not arrive at a supply
// screen that thinks it is filling "all storages" — so the widening is resolved
// AT THE READ rather than stored per screen, and one screen cannot inherit
// another's widening.
export function currentLens(storages, chosen, view) {
  if (chosen === ALL_STORAGES) {
    return lensMayWiden(view) ? ALL_STORAGES : defaultLens(storages)
  }
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
