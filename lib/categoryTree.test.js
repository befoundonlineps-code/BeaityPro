import { buildCategoryTree, countItems, byOrder } from './categoryTree'

const cat = (id, name, parent_id = null, sort_order = 0) => ({ id, name, parent_id, sort_order })

describe('buildCategoryTree', () => {
  it('nests to any depth, not two', () => {
    // The bug this recursion replaced built roots and their direct children
    // only. A third level saved correctly and then appeared nowhere at all.
    const cats = [cat('r', 'root'), cat('a', 'level 2', 'r'), cat('b', 'level 3', 'a'), cat('c', 'level 4', 'b')]
    const [root] = buildCategoryTree(cats)

    expect(root.children[0].id).toBe('a')
    expect(root.children[0].children[0].id).toBe('b')
    expect(root.children[0].children[0].children[0].id).toBe('c')
  })

  // What a cycle really does, measured rather than assumed. The comment this
  // replaces said an unguarded walk would recurse until the stack gave out;
  // it does not, because a cycle is unreachable — the walk starts at folders
  // with no parent, and every folder in a cycle has one. The real damage is
  // silence: the branch is simply not there, and nothing on screen says so.
  // That silence is what lib/categoryVisibility.js exists to prevent.
  it('drops a whole cycle out of the tree rather than crashing', () => {
    const cats = [cat('r', 'root'), cat('a', 'a', 'b'), cat('b', 'b', 'a')]
    const tree = buildCategoryTree(cats)

    expect(tree.map((n) => n.id)).toEqual(['r'])
    expect(tree[0].children).toEqual([])
  })

  it('leaves nothing at all when every folder is inside the cycle', () => {
    expect(buildCategoryTree([cat('a', 'a', 'b'), cat('b', 'b', 'a')])).toEqual([])
  })

  it('drops a folder that is its own parent, and keeps the rest', () => {
    const cats = [cat('r', 'root'), cat('x', 'x', 'x')]
    expect(buildCategoryTree(cats).map((r) => r.id)).toEqual(['r'])
  })

  it('hangs rows off each folder under the key it is told', () => {
    const cats = [cat('r', 'root'), cat('a', 'child', 'r')]
    const rows = [{ id: 'p1', category_id: 'r' }, { id: 'p2', category_id: 'a' }, { id: 'p3', category_id: 'a' }]
    const [root] = buildCategoryTree(cats, {
      itemsFor: (id) => rows.filter((row) => row.category_id === id),
      itemsKey: 'products',
    })

    expect(root.products.map((p) => p.id)).toEqual(['p1'])
    expect(root.children[0].products.map((p) => p.id)).toEqual(['p2', 'p3'])
  })

  it('drops what isVisible refuses, at any depth', () => {
    const cats = [cat('r', 'root'), cat('a', 'keep', 'r'), cat('b', 'drop', 'r')]
    const [root] = buildCategoryTree(cats, { isVisible: (c) => c.name !== 'drop' })

    expect(root.children.map((c) => c.name)).toEqual(['keep'])
  })

  it('keeps everything when told nothing', () => {
    const cats = [cat('r', 'root'), cat('a', 'child', 'r')]
    expect(buildCategoryTree(cats)[0].children).toHaveLength(1)
  })

  it('is empty rather than broken with no categories', () => {
    expect(buildCategoryTree(null)).toEqual([])
    expect(buildCategoryTree([])).toEqual([])
  })

  it('orders by sort_order, then by name in Arabic', () => {
    // Measured, not guessed: localeCompare('أ','ا','ar') is -1, so the hamza
    // form sorts first. An earlier version of this test asserted the reverse
    // from intuition and failed before any mutation was applied to the code.
    const cats = [cat('a', 'ب', null, 2), cat('b', 'ا', null, 1), cat('c', 'أ', null, 1)]
    expect(buildCategoryTree(cats).map((r) => r.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('countItems', () => {
  const cats = [cat('r', 'root'), cat('a', 'a', 'r'), cat('b', 'b', 'a')]
  const rows = [
    { id: '1', category_id: 'r' }, { id: '2', category_id: 'a' },
    { id: '3', category_id: 'b' }, { id: '4', category_id: 'b' },
  ]
  const [root] = buildCategoryTree(cats, {
    itemsFor: (id) => rows.filter((row) => row.category_id === id),
    itemsKey: 'products',
  })

  it('counts every depth beneath a folder, not just its own', () => {
    expect(countItems(root, 'products')).toBe(4)
  })

  it('is zero for a folder holding nothing anywhere below it', () => {
    const [empty] = buildCategoryTree([cat('e', 'empty')], { itemsKey: 'products' })
    expect(countItems(empty, 'products')).toBe(0)
  })
})

describe('byOrder', () => {
  it('puts a lower sort_order first', () => {
    expect(byOrder({ sort_order: 1, name: 'ب' }, { sort_order: 2, name: 'أ' })).toBeLessThan(0)
  })
})
