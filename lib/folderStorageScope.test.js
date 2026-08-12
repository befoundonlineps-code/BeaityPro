import { foldersForStorage, unassignedFolders, isUnassignedFolder } from './folderStorageScope'
import { ALL_STORAGES } from './storageScope'

const cat = (id, storage_id, over = {}) => ({
  id, name: id, parent_id: null, sort_order: 1, is_active: true, storage_id, ...over,
})

// The reference's own three storages, in the shape its screenshots show.
const COSMO = 'stor-cosmo'
const HAIR = 'stor-hair'
const THIRD = 'stor-third'

const CATEGORIES = [
  cat('after-laser', COSMO),
  cat('hydration', COSMO),
  cat('peeling', COSMO),
  cat('skin-care', COSMO),
  cat('bath', HAIR),
  cat('hair-treatment', HAIR),
  // 🔴 THE WITNESS. In the reference this is «Makeup Products» — it appears in
  // the «All storages» tree and in NEITHER of the two named storages. Nothing
  // but «it belongs to a storage that is not on screen» explains it, which is
  // why it is in this fixture rather than a fourth Cosmotology folder.
  cat('makeup', THIRD),
]

const ids = (list) => list.map((c) => c.id)

describe('a storage shows its own folders', () => {
  it('shows the four the reference shows for the first storage', () => {
    expect(ids(foldersForStorage(CATEGORIES, COSMO)).sort())
      .toEqual(['after-laser', 'hydration', 'peeling', 'skin-care'])
  })

  it('shows an entirely different two for the second', () => {
    // ⚠️ Disjoint, not overlapping — which is the claim. Two storages sharing a
    // folder would pass a «filters something» test and fail this one.
    expect(ids(foldersForStorage(CATEGORIES, HAIR)).sort()).toEqual(['bath', 'hair-treatment'])
    const cosmo = new Set(ids(foldersForStorage(CATEGORIES, COSMO)))
    expect(ids(foldersForStorage(CATEGORIES, HAIR)).some((id) => cosmo.has(id))).toBe(false)
  })

  it('shows nothing for a storage nobody assigned a folder to', () => {
    // Fails closed: an unknown storage narrows to nothing rather than widening
    // to everything, the same way catalogueScope treats a folder that is gone.
    expect(foldersForStorage(CATEGORIES, 'stor-from-next-year')).toEqual([])
  })
})

describe('«all storages» is the union and hides nothing', () => {
  it('shows every folder from every storage at once', () => {
    // The reference's third screenshot: seven folders — four plus two plus the
    // one that belongs to neither.
    expect(ids(foldersForStorage(CATEGORIES, ALL_STORAGES)).sort()).toEqual([...ids(CATEGORIES)].sort())
    expect(foldersForStorage(CATEGORIES, ALL_STORAGES)).toHaveLength(7)
  })

  it('treats «nothing chosen» the same way', () => {
    // '' and null are «no storage in force», which on the catalogue resolves to
    // ALL — so the tree must not empty itself while the lens is still settling.
    expect(foldersForStorage(CATEGORIES, '')).toHaveLength(7)
    expect(foldersForStorage(CATEGORIES, null)).toHaveLength(7)
    expect(foldersForStorage(CATEGORIES, undefined)).toHaveLength(7)
  })
})

describe('a folder nobody assigned yet', () => {
  const WITH_ORPHAN = [...CATEGORIES, cat('legacy', null), cat('legacy-2', undefined)]

  it('appears under «all storages»', () => {
    expect(ids(foldersForStorage(WITH_ORPHAN, ALL_STORAGES))).toContain('legacy')
    expect(ids(foldersForStorage(WITH_ORPHAN, ALL_STORAGES))).toContain('legacy-2')
  })

  it('appears under no single storage at all', () => {
    // 🔴 THE DECISION, AND THE OTHER OPTION WAS «show it everywhere».
    // That one degrades to today's behaviour exactly, so nothing would look
    // different and nobody would ever assign a storage — the column would sit
    // empty for months while the screen behaved as though the feature did not
    // exist. Gathering them under «all» is what makes them findable.
    for (const storage of [COSMO, HAIR, THIRD]) {
      expect(ids(foldersForStorage(WITH_ORPHAN, storage))).not.toContain('legacy')
      expect(ids(foldersForStorage(WITH_ORPHAN, storage))).not.toContain('legacy-2')
    }
  })

  it('is namable, so the screen can point at it', () => {
    expect(ids(unassignedFolders(WITH_ORPHAN))).toEqual(['legacy', 'legacy-2'])
    expect(isUnassignedFolder(cat('x', null))).toBe(true)
    expect(isUnassignedFolder(cat('x', undefined))).toBe(true)
    expect(isUnassignedFolder(cat('x', COSMO))).toBe(false)
    expect(isUnassignedFolder(null)).toBe(false)
  })
})

describe('a subfolder stays reachable', () => {
  // 🔴 THE HOLE THAT A FLAT FILTER LEAVES, and it is silent: the folder is
  // assigned, correct, and invisible.
  //
  // buildProductTree thins the flat list BEFORE walking it, and a child whose
  // parent is missing is not promoted to a root — it vanishes. So a subfolder
  // assigned to this storage, under a parent that is not, would be filtered
  // away with its parent and nothing would say so.
  const NESTED = [
    cat('root-unassigned', null),
    cat('child-cosmo', COSMO, { parent_id: 'root-unassigned' }),
    cat('child-hair', HAIR, { parent_id: 'root-unassigned' }),
  ]

  it('keeps the ancestors an assigned folder hangs from', () => {
    expect(ids(foldersForStorage(NESTED, COSMO)).sort()).toEqual(['child-cosmo', 'root-unassigned'])
  })

  it('does not drag the siblings in with the spine', () => {
    // ⚠️ THE HALF WORTH CHECKING RATHER THAN ASSUMING. The spine is a parent
    // that is not assigned to this storage — so if keeping it also kept its
    // other children, one storage's tree would be showing another storage's
    // folders, and selecting the parent would put their products on screen.
    expect(ids(foldersForStorage(NESTED, COSMO))).not.toContain('child-hair')
    expect(ids(foldersForStorage(NESTED, HAIR))).not.toContain('child-cosmo')
  })

  it('walks up more than one level', () => {
    const DEEP = [
      cat('a', null),
      cat('b', null, { parent_id: 'a' }),
      cat('c', COSMO, { parent_id: 'b' }),
    ]
    expect(ids(foldersForStorage(DEEP, COSMO)).sort()).toEqual(['a', 'b', 'c'])
  })

  it('does not hang on a parent chain that loops', () => {
    // ⚠️ parent_id is a self-reference with no acyclicity check in the
    // database, and a walk that meets a cycle does not return a wrong answer —
    // it HANGS, which reads as a slow machine rather than as bad data. This
    // project has already paid for a test that hung instead of failing: it
    // blinded every test under it in the same file.
    const LOOP = [
      cat('x', null, { parent_id: 'y' }),
      cat('y', null, { parent_id: 'x' }),
      cat('z', COSMO),
    ]
    expect(ids(foldersForStorage(LOOP, COSMO))).toEqual(['z'])
  })
})
