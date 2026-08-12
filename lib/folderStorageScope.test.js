import { foldersForStorage, unassignedFolders, isUnassignedFolder, ancestorIds } from './folderStorageScope'
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

  // ── The cycle, and the test that used to prove nothing ──────────────────
  //
  // 🔴 THE FIRST VERSION OF THIS WAS A FALSE GREEN, AND INJECTION IS WHAT SAID
  // SO. It built a two-folder loop and then assigned a THIRD folder, sitting
  // outside it — so `ancestorIds` was never called on anything inside the
  // cycle, and deleting the cycle guard outright left all twelve tests passing.
  //
  // The claim was «does not hang on a parent chain that loops». The case was «a
  // loop exists somewhere in the list». Those are different sentences, and only
  // the second one was checked.
  describe('a parent chain that loops', () => {
    // The assigned folder is INSIDE the cycle now. This is the fixture that
    // makes the walk enter it.
    const LOOP = [
      cat('x', COSMO, { parent_id: 'y' }),
      cat('y', null, { parent_id: 'x' }),
      cat('outside', HAIR),
    ]

    it('is bounded by the number of folders even with nothing remembered', () => {
      // 🔴 THE SECOND STOPPER, MEASURED RATHER THAN TRUSTED — and it is the one
      // that decides whether a future bad edit HANGS or merely misbehaves.
      //
      // The map counts its reads and throws by name past a sane cap, so this
      // test fails in milliseconds instead of freezing the file. That matters
      // more than it sounds: Jest stops a file at a hang, so every test below
      // this line would silently never run.
      let reads = 0
      const counting = {
        size: LOOP.length,
        get(id) {
          if (++reads > LOOP.length * 4) throw new Error('ancestorIds did not terminate')
          return LOOP.find((c) => c.id === id)
        },
      }
      expect([...ancestorIds(LOOP[0], counting)].sort()).toEqual(['x', 'y'])
      expect(reads).toBeLessThanOrEqual(LOOP.length + 1)
    })

    // 🔴 AND THIS IS THE ONLY CYCLE TEST IN THE FILE, WHICH IS A LIMIT RATHER
    // THAN AN OVERSIGHT — WRITTEN DOWN SO IT IS NOT READ AS COVERAGE.
    //
    // Two more were written and removed: one handing `ancestorIds` a real Map,
    // and one going through `foldersForStorage`, which builds its own Map
    // inside. Both assert real things. Both HANG when the stoppers are removed,
    // and measured: with both gone the whole file froze and Jest printed
    // nothing at all — including the failure of the instrumented test above,
    // which had already fired. A hanging test does not fail loudly; it erases
    // the file's report.
    //
    // ⇒ So the cycle is only ever walked through an index that can refuse. What
    // is NOT covered is `foldersForStorage` on cyclic data — and the honest
    // reason is that the only test for it is one that blinds the suite, not
    // that nobody thought of it.
  })
})
