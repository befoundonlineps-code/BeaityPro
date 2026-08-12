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
// ⚠️ Guarded against a cycle rather than trusted. parent_id is a self-reference
// with no database-side acyclicity check, and a walk that meets one does not
// return a wrong answer — it hangs, which reads as a slow machine rather than
// as bad data.
function ancestorIds(category, byId) {
  const seen = new Set()
  let current = category
  while (current && current.parent_id && !seen.has(current.parent_id)) {
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
// ⚠️ AND THE SPINE LEAKS NOTHING, which is the half worth checking rather than
// assuming. Selecting a spine parent shows the products of its descendants —
// but catalogueRows walks `descendantIds` over the list IT IS GIVEN, and it is
// given this filtered list. A sibling belonging to another storage is not in
// it, so its products are not in scope either.
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
