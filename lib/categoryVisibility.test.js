import { isCategoryArchived, visibleCategories } from './categoryVisibility'
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
