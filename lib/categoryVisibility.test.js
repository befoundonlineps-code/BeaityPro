import { isCategoryArchived, visibleCategories, countAffectedServices, descendantIds, parentOptionsFor } from './categoryVisibility'
import { indexCategoriesById } from './categoryTypes'

const cat = (id, parent_id, is_active = true) => ({ id, parent_id, is_active, name: id })

describe('isCategoryArchived', () => {
  const tree = [
    cat('root'),
    cat('sub', 'root'),
    cat('leaf', 'sub'),
    cat('archivedRoot', null, false),
    cat('subOfArchived', 'archivedRoot'),
  ]
  const byId = indexCategoriesById(tree)
  const archived = (id) => isCategoryArchived(byId[id], byId)

  it('says no when nothing in the chain is archived', () => {
    expect(archived('root')).toBe(false)
    expect(archived('sub')).toBe(false)
    expect(archived('leaf')).toBe(false)
  })

  it('says yes for the archived category itself', () => {
    expect(archived('archivedRoot')).toBe(true)
  })

  it('carries down to a child that is active on its own', () => {
    // The child's own flag is still true — the answer comes from the parent,
    // which is what lets un-archiving restore it untouched.
    expect(byId.subOfArchived.is_active).toBe(true)
    expect(archived('subOfArchived')).toBe(true)
  })

  it('reads a missing flag as active', () => {
    // Every existing row got true from the column default, but a category
    // built in memory before a reload may have no flag at all.
    expect(isCategoryArchived({ id: 'x', parent_id: null }, {})).toBe(false)
  })

  it('survives a parent that is not in the index', () => {
    expect(isCategoryArchived({ id: 'x', parent_id: 'gone' }, {})).toBe(false)
  })

  it('does not loop forever on a broken chain', () => {
    const loop = indexCategoriesById([
      { id: 'a', parent_id: 'b', is_active: true },
      { id: 'b', parent_id: 'a', is_active: true },
    ])
    expect(isCategoryArchived(loop.a, loop)).toBe(false)
  })

  it('finds an archived grandparent, not just a parent', () => {
    const deep = indexCategoriesById([
      cat('top', null, false),
      cat('mid', 'top'),
      cat('bottom', 'mid'),
    ])
    expect(isCategoryArchived(deep.bottom, deep)).toBe(true)
  })
})

describe('visibleCategories', () => {
  it('drops an archived category and everything under it', () => {
    const all = [cat('a'), cat('b', 'a'), cat('x', null, false), cat('y', 'x')]
    expect(visibleCategories(all).map((c) => c.id)).toEqual(['a', 'b'])
  })

  it('keeps everything when nothing is archived', () => {
    const all = [cat('a'), cat('b', 'a')]
    expect(visibleCategories(all)).toHaveLength(2)
  })

  it('copes with nothing at all', () => {
    expect(visibleCategories(null)).toEqual([])
    expect(visibleCategories([])).toEqual([])
  })
})

describe('countAffectedServices', () => {
  const cats = [
    { id: 'c1', parent_id: null },
    { id: 'c2', parent_id: 'c1' },
    { id: 'c3', parent_id: 'c2' },
    { id: 'c4', parent_id: null },
  ]
  const svcs = [
    { category_id: 'c1' }, { category_id: 'c2' }, { category_id: 'c2' },
    { category_id: 'c3' }, { category_id: 'c4' },
  ]

  it('counts a whole subtree, however deep', () => {
    // c1 holds one, c2 two, c3 one — three levels down.
    expect(countAffectedServices(cats[0], cats, svcs)).toBe(4)
  })

  it('counts from a sub-category down, not up', () => {
    expect(countAffectedServices(cats[1], cats, svcs)).toBe(3)
  })

  it('counts a folder with no children as just its own', () => {
    expect(countAffectedServices(cats[3], cats, svcs)).toBe(1)
  })

  it('is zero for nothing selected, or a folder holding nothing', () => {
    expect(countAffectedServices(null, cats, svcs)).toBe(0)
    expect(countAffectedServices({ id: 'empty' }, cats, svcs)).toBe(0)
  })

  it('does not hang on a parent chain that loops', () => {
    const loop = [{ id: 'a', parent_id: 'b' }, { id: 'b', parent_id: 'a' }]
    expect(countAffectedServices(loop[0], loop, [{ category_id: 'a' }, { category_id: 'b' }])).toBe(2)
  })
})

describe('descendantIds', () => {
  // The exact tree the cycle was found in: a root, its child, and its
  // grandchild. Offering the grandchild as a parent for the root would make
  // parent_id loop, and the tree builder tolerates cycles quietly — so the
  // whole branch would vanish with nothing on screen to explain it.
  const cats = [
    { id: 'root', parent_id: null, name: 'التجميل والعناية بالبشرة' },
    { id: 'sub', parent_id: 'root', name: 'التجميل اللاجراحي' },
    { id: 'grand', parent_id: 'sub', name: 'جراحة عامة' },
    { id: 'other', parent_id: null, name: 'المكياج' },
  ]

  it('includes the category itself', () => {
    expect(descendantIds(cats[0], cats).has('root')).toBe(true)
  })

  it('reaches a grandchild, not just a direct child', () => {
    const ids = descendantIds(cats[0], cats)
    expect([...ids].sort()).toEqual(['grand', 'root', 'sub'])
  })

  it('leaves an unrelated branch out', () => {
    expect(descendantIds(cats[0], cats).has('other')).toBe(false)
  })

  it('is empty for nothing selected, so every parent stays on offer', () => {
    expect(descendantIds(null, cats).size).toBe(0)
  })

  it('does not hang on a parent chain that loops', () => {
    const loop = [{ id: 'a', parent_id: 'b' }, { id: 'b', parent_id: 'a' }]
    expect([...descendantIds(loop[0], loop)].sort()).toEqual(['a', 'b'])
  })
})

describe('the parent list a category may be moved into', () => {
  // What CategoryFormDialog computes. Kept here beside descendantIds because
  // the rule is the same one, and the dialog only applies it.
  const cats = [
    { id: 'root', parent_id: null },
    { id: 'sub', parent_id: 'root' },
    { id: 'grand', parent_id: 'sub' },
    { id: 'other', parent_id: null },
  ]
  const optionsFor = (category) => parentOptionsFor(category, cats).map((c) => c.id)

  it('refuses a grandchild as a parent for its own grandparent', () => {
    // The reported gap: only direct children used to be excluded.
    expect(optionsFor(cats[0])).toEqual(['other'])
  })

  it('refuses a child as a parent for its own parent', () => {
    expect(optionsFor(cats[1])).toEqual(['root', 'other'])
  })

  it('offers everything when adding a new category', () => {
    expect(optionsFor(null)).toEqual(['root', 'sub', 'grand', 'other'])
  })
})
