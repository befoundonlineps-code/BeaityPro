import fs from 'fs'
import path from 'path'
import { catalogueRows } from './catalogueView'

// The storage picker changes ONE COLUMN. It does not change which rows exist.
//
// ⚠️ THAT SENTENCE IS WHAT THE WHOLE DESIGN STANDS ON, AND NOTHING WAS CHECKING
// IT. Four checks were written for the new column and all four look at CELLS —
// never at the row set. Review named the gap and the witness for it:
//
//   the row count is EIGHT in both picker positions (083 · 067_1)
//   «بلسم 250 مل» has zero movements in every storage (079b_3), so it is the
//   FIRST row to vanish if a filter ever leaks
//
// And it earns a test rather than a look, because a look happens once and a
// filter leaks in somebody's tidy-up three months later.
//
// ⚠️ A rendering test would be the direct way and this project has no harness
// for one — no @testing-library, and jest runs on `node`. Adding both to guard
// one invariant is a bigger change than the invariant. So this guards the
// invariant STRUCTURALLY, which this project prefers anyway: 069a's lesson was
// that matching should stop being something to keep up and become something
// that cannot come apart.
//
// The structural fact: the row set is produced by catalogueRows, whose inputs
// do not include a storage — so it CANNOT narrow by one. A leak would have to
// arrive as storageId or balances entering that computation, and a React
// dependency array is where that becomes visible (and `exhaustive-deps` is
// already on in this project, keeping deps honest).
describe('the row set cannot see the storage', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'ProductsBrowser.js'), 'utf8',
  )

  // The useMemo that produces `rows`, body and dependency array.
  const rowsMemo = source.slice(
    source.indexOf('const rows = useMemo('),
    source.indexOf('const groups = useMemo('),
  )

  it('found the computation rather than scanning nothing', () => {
    // A guard that scans nothing reports nothing wrong — and a rename would
    // silently empty this slice.
    expect(rowsMemo).toContain('catalogueRows(')
    expect(rowsMemo.length).toBeGreaterThan(80)
  })

  it('names neither the storage nor the balances', () => {
    // ⚠️ Both halves matter. `storageId` is the obvious leak; `balances` is the
    // quiet one — filtering rows to "products this storage has a balance row
    // for" narrows the catalogue without the word "storage" appearing anywhere.
    expect(rowsMemo).not.toMatch(/\bstorageId\b/)
    expect(rowsMemo).not.toMatch(/\bbalances\b/)
    expect(rowsMemo).not.toMatch(/\bbalanceByProduct\b/)
  })

  it('does not let the balance map decide which rows are drawn', () => {
    // The other place a leak fits: the table body, filtering by whether the
    // balance map has an entry. `.get(` on the map is how the CELL reads it and
    // is expected; `.has(` or a filter on it is how the ROW SET would.
    const body = source.slice(source.indexOf('<tbody>'))
    expect(body).not.toMatch(/balanceByProduct\.has\(/)
    expect(body).not.toMatch(/balanceByProduct[^\n]*\.filter\(/)
  })

  it('would catch a leak', () => {
    // Counter-evidence on a copy — nothing touches the work tree.
    const leaked = `const rows = useMemo(
      () => catalogueRows({ products, categories, storageId }),
      [products, categories, storageId]
    )`
    expect(leaked).toMatch(/\bstorageId\b/)
    expect(rowsMemo).not.toBe(leaked)
  })

  it('and the row set really is blind to it, not merely unnamed', () => {
    // ⚠️ The text guard above says the word is absent. This says the FUNCTION
    // cannot use it: catalogueRows is called with a fixed set of inputs, so
    // passing a storage through it changes nothing. Product «بلسم» is the
    // witness review named — zero movements anywhere, so it is the first row a
    // leak would take.
    const products = [
      { id: 'p1', name: 'بلسم 250 مل', category_id: 'c1', is_active: true, kind: 'product' },
      { id: 'p2', name: 'شامبو علاجي', category_id: 'c1', is_active: true, kind: 'product' },
    ]
    const categories = [{ id: 'c1', name: 'مجلّد', parent_id: null, is_active: true }]
    const args = { products, categories, categoryId: null, search: '', hideArchived: false }

    const asAll = catalogueRows(args)
    const asOneStorage = catalogueRows({ ...args, storageId: 's1', balances: [] })

    expect(asAll.map((p) => p.id)).toEqual(asOneStorage.map((p) => p.id))
    expect(asAll.map((p) => p.name)).toContain('بلسم 250 مل')
  })
})
