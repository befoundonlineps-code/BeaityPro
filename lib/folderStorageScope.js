import { ALL_STORAGES } from './storageScope'

// Which folders a storage shows.
//
// 🔴 THE FOLDER BELONGS TO A STORAGE NOW, AND THE BALANCE DOES NOT CHANGE.
//
// Two filters exist on this screen and they must never be confused:
//
//   THE TREE    narrows with the storage — new, deliberate, this file
//   THE BALANCE does not — the number on a product is what it always was
//
// The second is the one that must not move. lib/balanceView.js and
// lib/catalogueBalance.js decide it, they take no folder, and nothing here
// reaches them. lib/treeVsBalanceScope.test.js asserts both halves at once,
// because the dangerous edit is the one that makes them agree.
//
// ⚠️ AND IT IS MEASURED IN THE REFERENCE, NOT INFERRED. Three screenshots:
// «Cosmotolgy Storage» shows four folders, «Hair Department Storage» shows two
// entirely different ones, and «All storages» shows SEVEN — four plus two plus
// «Makeup Products», which appears in neither of the named storages. That last
// one is the witness: it can only be explained by a folder belonging to a
// storage that is not on screen, which is the whole claim.

// The storage a folder is not yet assigned to.
//
// 🔴 AND «UNASSIGNED» SHOWS UNDER «ALL STORAGES» ALONE — a written decision,
// not a fallback that happened.
//
// The alternative was «show it under every storage», which degrades to exactly
// today's behaviour and is therefore tempting. It is the worse choice for one
// reason: it makes the feature INVISIBLE. Every existing folder would go on
// appearing everywhere, nothing would look different, and nobody would ever
// assign a storage — so the column would sit empty for months while the screen
// quietly behaved as though it did not exist.
//
// ⇒ Unassigned folders gather under «all storages», where they can be found and
// assigned, and a single-storage tree shows only what has been claimed. The
// cost is that a storage with no assigned folders opens empty — which is why
// the empty state names the reason rather than showing a blank pane.
export const UNASSIGNED_STORAGE = null

const isUnassigned = (c) => c.storage_id === undefined || c.storage_id === null

// Every ancestor id of a folder, walking up until the chain ends.
//
// 🔴 TWO INDEPENDENT STOPPERS, AND THE SECOND ONE IS HERE BECAUSE INJECTION
// PROVED THE FIRST WAS UNGUARDED.
//
// `parent_id` is a self-reference and the database enforces no acyclicity —
// `product_categories_parent_id_salon_id_fkey` is a plain composite FK, and a
// foreign key cannot say «no loops» (measured in 084). So a cycle is reachable
// data, and a walk that meets one does not return a wrong answer: it HANGS.
//
//   `seen`        stops a loop by remembering where it has been
//   `byId.size`   stops ANY walk after more steps than there are folders,
//                 which is an upper bound on the longest acyclic chain
//
// ⚠️ The bound is what makes a careless edit SAFE TO MAKE. Delete `seen` and the
// walk still terminates with the right answer; delete the bound and `seen`
// still stops it. Only deleting both hangs.
//
// ⚠️ AND IT IS EXPORTED SO THE CYCLE CAN BE TESTED WITHOUT A TEST THAT HANGS.
// Handing this an instrumented index — one that throws past a sane number of
// reads — turns «the guard is gone» into a named failure in milliseconds. Going
// through foldersForStorage instead would build a real Map internally and
// freeze the whole file, and Jest stops a file at a hang: every test below it
// never runs, including one that had already failed.
export function ancestorIds(category, byId) {
  const seen = new Set()
  let current = category
  for (let step = 0; step <= byId.size && current && current.parent_id; step++) {
    if (seen.has(current.parent_id)) break
    seen.add(current.parent_id)
    current = byId.get(current.parent_id)
  }
  return seen
}

// 🔴 THE FOLDERS A STORAGE SHOWS — ASSIGNED ONES, PLUS THE ANCESTORS THAT MAKE
// THEM REACHABLE.
//
// The spine is not generosity. A subfolder assigned to this storage under a
// parent that is not would be filtered away with its parent, because
// buildProductTree thins the flat list before walking it and a child with a
// missing parent is not a root — it simply vanishes. So the folder would be
// assigned, correct, and invisible.
//
// ⚠️ AND A SIBLING IN ANOTHER STORAGE DOES NOT LEAK THROUGH THE SPINE, which is
// the half worth checking rather than assuming. Selecting a spine parent shows
// the products of its descendants — but catalogueRows walks `descendantIds` over
// the list IT IS GIVEN, and it is given this filtered list. A sibling belonging
// to another storage is not in it, so its products are not in scope either.
//
// ⚠️ AND THIS HEADING SAID «THE SPINE LEAKS NOTHING», WHICH IS WIDER THAN THE
// PARAGRAPH UNDER IT. The sibling is closed; the spine's OWN products were not,
// because `descendantIds` includes the folder it starts from. That is closed
// separately, by `isPassThroughFolder` below — a spine is never selected at all.
// A heading claiming more than the reason beneath it is how a real limit gets
// read as covered.
export function foldersForStorage(categories, storageId) {
  const all = categories || []
  // ⚠️ «All storages» is the UNION and hides nothing — the owner's decision,
  // and the reference's behaviour: its «All storages» tree carries every folder
  // from every storage at once.
  if (!storageId || storageId === ALL_STORAGES) return all

  const byId = new Map(all.map((c) => [c.id, c]))
  const assigned = all.filter((c) => c.storage_id === storageId)

  const keep = new Set(assigned.map((c) => c.id))
  for (const c of assigned) for (const id of ancestorIds(c, byId)) keep.add(id)

  return all.filter((c) => keep.has(c.id))
}

// 🔴 A FOLDER THE TREE DRAWS WITHOUT IT BELONGING HERE — AND IT IS SHOWN, NEVER
// SELECTED.
//
// The spine above puts a folder on screen for one reason: its descendant is
// assigned here and would otherwise vanish with it. The folder itself is not in
// this storage. So the reviewer's question — «can somebody click it and create a
// folder under it, and what storage would that folder take?» — has a third
// answer better than either offered:
//
//   parent's storage   the new folder is born into another storage and
//                      DISAPPEARS from the tree it was created in
//   lens's storage     a child in this storage under a parent in that one —
//                      which is the very shape the spine exists to paper over
//   ⇒ NOT SELECTABLE   the question never arises
//
// ⚠️ AND «NOT SELECTABLE» RATHER THAN «NO ADD BUTTON», WHICH IS THE WHOLE
// SAVING. Add, Edit and Archive all act on the SELECTED folder. Blocking three
// buttons is three rules that drift apart; blocking the selection is one rule
// they all already read. Archive is the one that proves it matters — archiving a
// spine takes its whole subtree out of the OTHER storage, from a screen that is
// not looking at it.
//
// 🔴 AND SELECTION WAS NOT A HARMLESS READ EITHER — MEASURED BY READING, NOT
// ASSUMED. `descendantIds` starts at `new Set([category.id])`, so selecting a
// spine put the spine's OWN products in scope: products of a Hair folder, listed
// while the screen says Cosmotology. foldersForStorage's header claimed «THE
// SPINE LEAKS NOTHING» — and what it actually proved, one paragraph down, is
// that a SIBLING does not leak. That part is true. The heading was wider than
// its proof.
//
// ⚠️ AND THE SEARCH IS THE SAME LEAK THROUGH ANOTHER DOOR, AND WORSE. The screen
// hands `searchScope` the visible ids; with spines in it, a product in another
// storage is findable here IF ITS FOLDER HAPPENS TO HAVE A CHILD ASSIGNED HERE.
// Search results decided by an unrelated structural accident are not a narrower
// answer — they are an arbitrary one.
//
// ⚠️ AND IT ANSWERS ABOUT ANY FOLDER, not only one already on screen: a folder
// that is not in this storage is not selectable here whether it is drawn or not.
// That is the direction that fails safe — a stale selection surviving a change
// of lens is exactly the case a screen forgets to clear.
export function isPassThroughFolder(category, storageId) {
  if (!category) return false
  // «All storages» draws everything BECAUSE it is everything — nothing is on
  // screen by courtesy there, so nothing is pass-through.
  if (!storageId || storageId === ALL_STORAGES) return false
  return category.storage_id !== storageId
}

// The folders nobody has claimed yet, so the screen can point at them.
//
// ⚠️ Named rather than left implicit: a folder that shows under «all storages»
// and nowhere else looks like a bug until something says it is a state.
export function unassignedFolders(categories) {
  return (categories || []).filter(isUnassigned)
}

export function isUnassignedFolder(category) {
  return !!category && isUnassigned(category)
}
