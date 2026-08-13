import { renderToStaticMarkup } from 'react-dom/server'
import ProductsBrowser from '../components/ProductsBrowser'
import { isPassThroughFolder, foldersForStorage } from './folderStorageScope'
import { ALL_STORAGES } from './storageScope'

// 🔴 A FOLDER THE TREE DRAWS WITHOUT IT BELONGING HERE — SHOWN, NEVER SELECTED.
//
// The reviewer's question: a folder kept on screen only so its child stays
// reachable — «can somebody click it and create a folder under it, and which
// storage would that folder take?»
//
// The answer decided here is that the question does not arise, and the reason is
// that BOTH available answers are wrong: the parent's storage creates a folder
// that vanishes the instant it is saved, and the lens's storage creates the
// mixed nesting the spine exists to paper over.
//
// ⚠️ AND «NOT SELECTABLE» RATHER THAN «NO ADD BUTTON». Add, Edit and Archive all
// act on the selected folder, so one rule closes three doors that would
// otherwise drift apart. Archive is the one that shows the stakes: it takes a
// whole subtree out of a storage the screen is not looking at.
jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

const COSMO = 'stor-cosmo'
const HAIR = 'stor-hair'

const STORAGES = [
  { id: COSMO, name: 'التجميل' },
  { id: HAIR, name: 'الشعر' },
]

// 🔴 THE DISCRIMINATING SHAPE, AND IT IS THE WHOLE FIXTURE: a parent in one
// storage with a child in another. `c-care` is drawn under Cosmotology for one
// reason — `c-shampoo` is assigned there and would vanish with its parent.
const CATEGORIES = [
  { id: 'c-care', parent_id: null, name: 'العناية', sort_order: 1, is_active: true, storage_id: HAIR },
  { id: 'c-shampoo', parent_id: 'c-care', name: 'شامبو', sort_order: 1, is_active: true, storage_id: COSMO },
  { id: 'c-nails', parent_id: null, name: 'أظافر', sort_order: 2, is_active: true, storage_id: COSMO },
  { id: 'c-loose', parent_id: null, name: 'قديم', sort_order: 3, is_active: true, storage_id: null },
]

const product = (id, categoryId, name) => ({
  id, name, category_id: categoryId, sort_order: 1,
  is_active: true, units_per_package: 1, base_unit: 'pcs',
})

// ⚠️ `منتج العناية` IS THE WITNESS. It sits in the spine folder itself — the one
// `descendantIds` puts back in scope, because it starts at `new Set([category.id])`.
// A fixture whose spine held no products of its own would pass every assertion
// below with the leak wide open.
const PRODUCTS = [
  product('p-care', 'c-care', 'منتج العناية'),
  product('p-shampoo', 'c-shampoo', 'منتج الشامبو'),
  product('p-nails', 'c-nails', 'منتج الأظافر'),
]

const render = (over) => renderToStaticMarkup(
  <ProductsBrowser
    salonId="s" suppliers={[]} balances={[]} storages={STORAGES}
    storageId={COSMO}
    catalogue={{
      products: PRODUCTS, categories: CATEGORIES, loading: false, error: null, reload: () => {},
    }}
    {...over}
  />
)

// The row as it is drawn, so «is it a control?» is asked of the markup rather
// than of the props that produced it.
const rowOf = (html, id) => {
  const at = html.indexOf(`data-tree-node="${id}"`)
  if (at === -1) return null
  // Back to the opening angle bracket of the element carrying the attribute, and
  // forward to the end of that tag — so «is it a button?» reads the tag name at
  // the front and the attributes read whole rather than half.
  const from = html.lastIndexOf('<', at)
  return html.slice(from, html.indexOf('>', at) + 1)
}

describe('which folders a storage owns, and which it merely draws', () => {
  it('calls a folder from another storage pass-through, and its own not', () => {
    const care = CATEGORIES[0]
    const shampoo = CATEGORIES[1]
    expect(isPassThroughFolder(care, COSMO)).toBe(true)
    expect(isPassThroughFolder(shampoo, COSMO)).toBe(false)
    // The same folder, from its own storage, is an ordinary folder.
    expect(isPassThroughFolder(care, HAIR)).toBe(false)
  })

  it('calls nothing pass-through under «all storages»', () => {
    // ⚠️ Everything is drawn there BECAUSE it is everything — nothing is on
    // screen by courtesy, so nothing is inert.
    for (const c of CATEGORIES) {
      expect(isPassThroughFolder(c, ALL_STORAGES)).toBe(false)
      expect(isPassThroughFolder(c, null)).toBe(false)
      expect(isPassThroughFolder(c, '')).toBe(false)
    }
  })

  it('treats an unassigned folder as pass-through under a storage, not under all', () => {
    const loose = CATEGORIES[3]
    expect(isPassThroughFolder(loose, COSMO)).toBe(true)
    expect(isPassThroughFolder(loose, ALL_STORAGES)).toBe(false)
  })

  it('answers about a folder that is not drawn here at all', () => {
    // Fails safe in the direction that matters: a stale selection surviving a
    // change of lens, or an id arriving from outside, is not a folder of this
    // storage whether the tree drew it or not.
    expect(foldersForStorage(CATEGORIES, COSMO).map((c) => c.id)).not.toContain('c-loose')
    expect(isPassThroughFolder(CATEGORIES[3], COSMO)).toBe(true)
  })
})

describe('the tree draws the pass-through folder and refuses to select it', () => {
  it('draws it as a plain element rather than a button', () => {
    const html = render()
    const care = rowOf(html, 'c-care')
    expect(care).toBeTruthy()
    expect(care).toContain('data-pass-through="true"')
    expect(care).not.toContain('<button')
  })

  it('still draws the folders it owns as buttons', () => {
    // 🔴 THE ASSERTION THAT KEEPS THE OTHER ONE HONEST. «No button on c-care»
    // passes just as well on a tree that drew no buttons at all.
    const html = render()
    expect(rowOf(html, 'c-shampoo')).toContain('<button')
    expect(rowOf(html, 'c-nails')).toContain('<button')
    expect(rowOf(html, 'c-shampoo')).not.toContain('data-pass-through')
  })

  it('opens it without being asked, because its child is the only reason it is here', () => {
    // ⚠️ The tree starts with nothing expanded. A collapsed pass-through row
    // hides the folder it exists to reach AND cannot be clicked to open — a row
    // that does nothing at all. Deleting the always-open rule drops
    // `c-shampoo` out of the markup entirely, which is why this is asserted on
    // the rendered child rather than on a flag.
    expect(render()).toContain('data-tree-node="c-shampoo"')
  })

  it('names the storage it belongs to rather than saying «elsewhere»', () => {
    // A refusal that names the case gives a door: switch the picker to that one.
    const care = rowOf(render(), 'c-care')
    expect(care).toBeTruthy()
    expect(render()).toContain('الشعر')
  })

  it('makes it an ordinary, selectable folder from its own storage', () => {
    // The inertness is a property of WHERE YOU ARE STANDING, not of the folder.
    const html = render({ storageId: HAIR })
    expect(rowOf(html, 'c-care')).toContain('<button')
    expect(rowOf(html, 'c-care')).not.toContain('data-pass-through')
  })

  it('makes it selectable under «all storages» too', () => {
    const html = render({ storageId: ALL_STORAGES })
    expect(rowOf(html, 'c-care')).toContain('<button')
  })
})

describe('a pass-through folder cannot become the selection, however it is reached', () => {
  it('shows «pick a folder» rather than its products when handed as the opening folder', () => {
    // 🔴 THE READ LEAK, AND IT WAS LIVE BEFORE THIS RULE. `descendantIds`
    // starts at the folder itself, so selecting the spine listed the SPINE'S
    // OWN products — a Hair folder's goods under a screen that says
    // Cosmotology.
    const html = render({ initialCategoryId: 'c-care' })
    expect(html).toContain('data-empty-state="pick-folder"')
    expect(html).not.toContain('منتج العناية')
  })

  it('still shows a folder it owns when handed one', () => {
    // Keeps the assertion above from passing on a screen that shows nothing at
    // all — the empty-to-empty comparison this project has already paid for.
    const html = render({ initialCategoryId: 'c-shampoo' })
    expect(html).toContain('منتج الشامبو')
    expect(html).not.toContain('data-empty-state="pick-folder"')
  })

  it('lists its products from its own storage', () => {
    const html = render({ storageId: HAIR, initialCategoryId: 'c-care' })
    expect(html).toContain('منتج العناية')
  })
})

describe('the search does not reach through a pass-through folder either', () => {
  it('finds this storage’s products and not the drawn-by-courtesy one’s', () => {
    // ⚠️ THE SAME LEAK THROUGH ANOTHER DOOR, AND WORSE. With spines in the
    // search scope, `منتج العناية` is findable from Cosmotology ONLY BECAUSE
    // its folder happens to have a child assigned here. Move `c-shampoo`
    // elsewhere and the same product stops being findable — a result decided by
    // a structural accident two levels away that the searcher cannot see.
    const html = render({ initialSearch: 'منتج' })
    expect(html).toContain('منتج الشامبو')
    expect(html).toContain('منتج الأظافر')
    expect(html).not.toContain('منتج العناية')
  })

  it('finds it from its own storage', () => {
    const html = render({ storageId: HAIR, initialSearch: 'منتج' })
    expect(html).toContain('منتج العناية')
  })

  it('finds everything from «all storages»', () => {
    // Where nothing is pass-through, nothing is withheld — the invariant that
    // keeps the narrowing from becoming a place products can hide.
    const html = render({ storageId: ALL_STORAGES, initialSearch: 'منتج' })
    for (const name of ['منتج العناية', 'منتج الشامبو', 'منتج الأظافر']) {
      expect(html).toContain(name)
    }
  })
})
