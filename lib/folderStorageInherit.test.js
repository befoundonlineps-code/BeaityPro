import { storageForNewFolder, canCreateFolder, parentChoicesForFolder, NO_CONTEXT } from './folderStorageInherit'
import { ALL_STORAGES } from './storageScope'

const COSMO = 'stor-cosmo'
const HAIR = 'stor-hair'

const folder = (storage_id) => ({ id: 'parent', name: 'أب', parent_id: null, storage_id })

describe('a new folder takes its storage from the context, never from a question', () => {
  it('takes the selected storage when there is no parent', () => {
    expect(storageForNewFolder({ parent: null, lensStorageId: COSMO })).toBe(COSMO)
  })

  it('takes the parent’s storage when there is a parent', () => {
    expect(storageForNewFolder({ parent: folder(HAIR), lensStorageId: COSMO })).toBe(HAIR)
  })

  it('lets the parent win over the picker, not the other way round', () => {
    // 🔴 THE ORDER IS THE POINT, and getting it backwards builds a broken tree
    // rather than a wrong field: a subfolder in a storage other than its
    // parent's shows under its own storage and vanishes under its parent's —
    // and its parent becomes a «spine» for a folder that is not its own, which
    // is the case lib/folderStorageScope.test.js guards from the other side.
    expect(storageForNewFolder({ parent: folder(HAIR), lensStorageId: ALL_STORAGES })).toBe(HAIR)
    expect(storageForNewFolder({ parent: folder(COSMO), lensStorageId: HAIR })).toBe(COSMO)
  })
})

describe('no context means no folder, rather than a guess', () => {
  it('refuses when the lens is wide and nothing is selected', () => {
    // The owner's rule, in his words: «ما في سياق تلقائي نقدر ناخده منه، فما
    // منخمّن».
    expect(storageForNewFolder({ parent: null, lensStorageId: ALL_STORAGES })).toBe(NO_CONTEXT)
    expect(storageForNewFolder({ parent: null, lensStorageId: '' })).toBe(NO_CONTEXT)
    expect(storageForNewFolder({ parent: null, lensStorageId: null })).toBe(NO_CONTEXT)
    expect(storageForNewFolder({})).toBe(NO_CONTEXT)
  })

  it('refuses under a parent that has no storage either', () => {
    // ⚠️ Inheriting «unassigned» would be inheriting exactly — and it would
    // also mint a NEW unassigned folder, in a design whose whole point is that
    // the unassigned state stops being reachable. The three that exist are
    // legacy; a fourth would be a decision nobody took.
    expect(storageForNewFolder({ parent: folder(null), lensStorageId: COSMO })).toBe(NO_CONTEXT)
    expect(storageForNewFolder({ parent: folder(undefined), lensStorageId: ALL_STORAGES })).toBe(NO_CONTEXT)
  })
})

describe('the button and the write read the same answer', () => {
  // 🔴 DERIVED, NOT A SECOND CONDITION. A separate rule on the button — «disable
  // when the lens is all storages» — is the second list that drifts: it would
  // disable the button in a case the write handles perfectly (a selected,
  // assigned parent while the lens is wide), and one of the two would be
  // corrected later without the other.
  it('allows exactly the cases that produce a storage', () => {
    const cases = [
      { parent: null, lensStorageId: COSMO },
      { parent: folder(HAIR), lensStorageId: COSMO },
      { parent: folder(HAIR), lensStorageId: ALL_STORAGES },
      { parent: null, lensStorageId: ALL_STORAGES },
      { parent: folder(null), lensStorageId: ALL_STORAGES },
      {},
    ]
    for (const context of cases) {
      expect(canCreateFolder(context)).toBe(storageForNewFolder(context) !== NO_CONTEXT)
    }
  })

  it('allows a subfolder under an assigned parent even while the lens is wide', () => {
    // ⚠️ THE CASE WHERE THE OWNER'S SENTENCE AND ITS REASON PART. «Disable at
    // all storages» read literally forbids this; «there is no context to take
    // from» does not apply, because the parent IS the context — and the rule
    // one line above says so: «بغضّ النظر شو مختار بأعلى الشاشة».
    //
    // The reason is followed rather than the letter, and it is written here so
    // the choice is visible rather than buried in a boolean.
    expect(canCreateFolder({ parent: folder(HAIR), lensStorageId: ALL_STORAGES })).toBe(true)
  })

  it('forbids a root folder while the lens is wide', () => {
    expect(canCreateFolder({ parent: null, lensStorageId: ALL_STORAGES })).toBe(false)
  })
})

describe('a folder is never created into a storage it will vanish from', () => {
  // 🔴 THE SAME FAULT AS CLICKING A PASS-THROUGH NODE, THROUGH THE OTHER DOOR.
  // The dialog's parent list is the second way to hand a new folder somebody
  // else's storage — and the folder it makes is born invisible: created from
  // the Cosmotology tree, assigned to Hair, gone the moment it is saved.
  const CATEGORIES = [
    { id: 'c-nails', parent_id: null, name: 'أظافر', storage_id: COSMO, is_active: true },
    { id: 'c-care', parent_id: null, name: 'العناية', storage_id: HAIR, is_active: true },
    { id: 'c-loose', parent_id: null, name: 'قديم', storage_id: null, is_active: true },
    { id: 'c-sub', parent_id: 'c-nails', name: 'مبارد', storage_id: COSMO, is_active: true },
  ]
  const ids = (list) => list.map((c) => c.id)

  it('offers only this storage’s folders as a parent for a new one', () => {
    const options = parentChoicesForFolder({ category: null, categories: CATEGORIES, lensStorageId: COSMO })
    expect(ids(options)).toEqual(['c-nails', 'c-sub'])
  })

  it('offers every folder when the lens is wide, because nothing is out of view there', () => {
    const options = parentChoicesForFolder({ category: null, categories: CATEGORIES, lensStorageId: ALL_STORAGES })
    expect(ids(options)).toEqual(['c-nails', 'c-care', 'c-loose', 'c-sub'])
  })

  it('leaves an EDIT’s options alone, and that is a bug fix rather than a preference', () => {
    // ⚠️ An edit opens on the folder's CURRENT parent, which may be in another
    // storage — legacy nesting, or 086. Narrow the list there and the current
    // parent is missing from it, so the select falls back to «none» and saving
    // REPARENTS THE FOLDER TO THE ROOT with nobody asking for it.
    const editing = CATEGORIES[3]
    const options = parentChoicesForFolder({ category: editing, categories: CATEGORIES, lensStorageId: COSMO })
    expect(ids(options)).toContain('c-care')
    expect(ids(options)).toContain('c-loose')
  })

  it('still refuses a cycle, because the storage narrows on top of that rule and not instead of it', () => {
    // 🔴 The cycle guard is the rule this list existed for first — a folder
    // offered as a parent for its own ancestor writes a loop into parent_id and
    // the whole branch vanishes with nothing on screen to say why. A storage
    // filter layered carelessly could have replaced it.
    const editing = CATEGORIES[0]
    const options = parentChoicesForFolder({ category: editing, categories: CATEGORIES, lensStorageId: COSMO })
    expect(ids(options)).not.toContain('c-nails')
    expect(ids(options)).not.toContain('c-sub')
  })
})
