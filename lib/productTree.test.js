import { buildProductTree, countProducts } from './productTree'

const cat = (id, name, parent_id = null, is_active = true, sort_order = 0) =>
  ({ id, name, parent_id, is_active, sort_order })
const prod = (id, category_id, name, is_active = true, sort_order = 0) =>
  ({ id, category_id, name, is_active, sort_order })

describe('buildProductTree', () => {
  const categories = [
    cat('hair', 'العناية بالشعر'),
    cat('dye', 'صبغات', 'hair'),
    cat('skin', 'مستحضرات البشرة'),
  ]
  const products = [
    prod('p1', 'hair', 'شامبو'),
    prod('p2', 'dye', 'صبغة سوداء'),
    prod('p3', 'skin', 'كريم'),
  ]

  it('nests folders and hangs each one’s products off it', () => {
    const [hair, skin] = buildProductTree(categories, products)

    expect(hair.products.map((p) => p.id)).toEqual(['p1'])
    expect(hair.children[0].id).toBe('dye')
    expect(hair.children[0].products.map((p) => p.id)).toEqual(['p2'])
    expect(skin.products.map((p) => p.id)).toEqual(['p3'])
  })

  it('keeps every folder by default, archived included', () => {
    // The catalogue screen is where archiving is undone, so the default has to
    // show what would otherwise have no way back.
    const withArchived = [...categories, cat('old', 'مسحوق قديم', null, false)]
    expect(buildProductTree(withArchived, []).map((n) => n.id))
      .toEqual(['hair', 'skin', 'old'])
  })

  it('applies no business-type filter, unlike the services catalogue', () => {
    // Nothing about a product decides who may see it. Passing categories that
    // carry no type at all still yields every one of them.
    expect(buildProductTree(categories, []).map((n) => n.id)).toEqual(['hair', 'skin'])
  })
})

describe('buildProductTree with hideArchived', () => {
  it('drops an archived folder', () => {
    const cats = [cat('a', 'حيّ'), cat('b', 'مؤرشف', null, false)]
    expect(buildProductTree(cats, [], { hideArchived: true }).map((n) => n.id)).toEqual(['a'])
  })

  // The case worth being sure about: the child's own is_active is true, and it
  // still has to go, because archiving is inherited downwards. Filtering the
  // built tree instead of its input would keep this child and promote it to a
  // root it never was.
  it('drops an active sub-folder whose parent is archived', () => {
    const cats = [
      cat('root', 'مؤرشف', null, false),
      cat('child', 'حيّ بذاته', 'root', true),
    ]
    const tree = buildProductTree(cats, [], { hideArchived: true })

    expect(tree).toEqual([])
  })

  it('drops an active grandchild under an archived grandparent', () => {
    const cats = [
      cat('root', 'مؤرشف', null, false),
      cat('mid', 'وسط حيّ', 'root', true),
      cat('leaf', 'ورقة حيّة', 'mid', true),
    ]
    expect(buildProductTree(cats, [], { hideArchived: true })).toEqual([])
  })

  it('never leaves a child stranded as a root it never was', () => {
    const cats = [
      cat('keep', 'يبقى'),
      cat('root', 'مؤرشف', null, false),
      cat('child', 'ابنه', 'root', true),
    ]
    const tree = buildProductTree(cats, [], { hideArchived: true })

    expect(tree.map((n) => n.id)).toEqual(['keep'])
    expect(tree.some((n) => n.id === 'child')).toBe(false)
  })

  // ⚠️ The case that separates thinning the input from filtering the result,
  // and the only one that does. Every test above puts the archived folder at
  // the top level, where both approaches agree — a mutation swapping one for
  // the other passed all of them. A filter applied to the built tree only ever
  // sees roots, so a live root would keep its archived child and everything
  // beneath it, in a tree that was asked to hide precisely that.
  it('drops an archived sub-folder nested under a live root', () => {
    const cats = [
      cat('root', 'جذر حيّ'),
      cat('mid', 'فرع مؤرشف', 'root', false),
    ]
    const [root] = buildProductTree(cats, [], { hideArchived: true })

    expect(root.id).toBe('root')
    expect(root.children).toEqual([])
  })

  it('drops a live leaf under an archived sub-folder under a live root', () => {
    // Archiving is inherited at any depth, not only from a root.
    const cats = [
      cat('root', 'جذر حيّ'),
      cat('mid', 'فرع مؤرشف', 'root', false),
      cat('leaf', 'ورقة حيّة بذاتها', 'mid', true),
    ]
    const [root] = buildProductTree(cats, [], { hideArchived: true })

    expect(root.children).toEqual([])
  })

  it('keeps a live sibling of an archived sub-folder', () => {
    const cats = [
      cat('root', 'جذر حيّ'),
      cat('dead', 'فرع مؤرشف', 'root', false),
      cat('alive', 'فرع حيّ', 'root', true),
    ]
    const [root] = buildProductTree(cats, [], { hideArchived: true })

    expect(root.children.map((n) => n.id)).toEqual(['alive'])
  })

  it('keeps a live branch untouched while removing an archived sibling', () => {
    const cats = [
      cat('live', 'حيّ'),
      cat('liveChild', 'ابن حيّ', 'live'),
      cat('dead', 'مؤرشف', null, false),
    ]
    const tree = buildProductTree(cats, [], { hideArchived: true })

    expect(tree.map((n) => n.id)).toEqual(['live'])
    expect(tree[0].children.map((n) => n.id)).toEqual(['liveChild'])
  })

  it('does not touch products — only folders', () => {
    // The list filters archived products itself, per selected folder. This
    // option is about the tree, and an archived product under a live folder
    // still arrives here.
    const cats = [cat('a', 'حيّ')]
    const prods = [prod('p1', 'a', 'حيّ'), prod('p2', 'a', 'مؤرشف', false)]
    const [root] = buildProductTree(cats, prods, { hideArchived: true })

    expect(root.products.map((p) => p.id)).toEqual(['p1', 'p2'])
  })
})

describe('countProducts', () => {
  it('counts every depth beneath a folder', () => {
    const cats = [cat('r', 'جذر'), cat('a', 'أ', 'r'), cat('b', 'ب', 'a')]
    const prods = [prod('1', 'r', 'x'), prod('2', 'a', 'y'), prod('3', 'b', 'z'), prod('4', 'b', 'w')]
    const [root] = buildProductTree(cats, prods)

    expect(countProducts(root)).toBe(4)
  })

  it('is zero for a folder with nothing anywhere below it', () => {
    const [root] = buildProductTree([cat('r', 'جذر')], [])
    expect(countProducts(root)).toBe(0)
  })
})
