import { Fragment, useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, Plus, Pencil, Archive } from 'lucide-react'
import TwoPaneBrowser, { ToolButton } from './TwoPaneBrowser'
import ProductFormDialog from './ProductFormDialog'
import ProductCategoryFormDialog from './ProductCategoryFormDialog'
import { buildProductTree, countProducts } from '../lib/productTree'
import { treeContains } from '../lib/categoryTree'
import { isCategoryArchived, descendantIds } from '../lib/categoryVisibility'
import { catalogueRows, catalogueGroups } from '../lib/catalogueView'
import { indexCategoriesById } from '../lib/categoryTypes'
import { dbErrorSentence } from '../lib/dbErrors'
import { stockedStorages } from '../lib/balanceView'
import { setProductArchived, setProductCategoryArchived } from '../lib/productAdminIO'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// The products screen.
//
// Same shape as the services screen and the same component underneath
// (TwoPaneBrowser), which is why the folder tree, the inherited archiving and
// the loading overlay of ADR-048 all work here without being written twice.
//
// ⚠️ No delete button anywhere, for a product or a folder. Neither table has
// an RLS delete policy, so a delete comes back with zero rows rather than an
// error — success, as far as the client can tell. Archiving is the only act,
// and stock_movements holds product_id with ON DELETE RESTRICT anyway, so
// anything ever moved could never have been removed.
// ⚠️ The catalogue arrives as a prop rather than being read here. It used to
// call useProductCatalog itself, which gave this tab its own copy of the list —
// so a product created here never appeared on the document screens until the
// page was reloaded, and the most ordinary path in the module (new item arrives
// → create the product → go and receive it) ended with it missing.
export default function ProductsBrowser({ salonId, suppliers, catalogue, balances, storages }) {
  const { t } = useTranslation(['products', 'common'])
  const { categories, products, loading, error, reload } = catalogue

  // Shown after archiving a product that still has stock. Not a confirmation —
  // see toggleProductArchived for why it asks nothing.
  const [archiveNotice, setArchiveNotice] = useState(null)

  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [search, setSearch] = useState('')
  const [dialog, setDialog] = useState(null)              // { product }
  const [categoryDialog, setCategoryDialog] = useState(null) // { category }
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  // Off by default, and it hides rather than reveals — the inverse of the
  // reference's "Archive" box, deliberately.
  //
  // Archiving is undone from this screen and there is no delete button here at
  // all, so hiding archived rows by default would make the box the only route
  // back for anything taken out of circulation. lib/categoryVisibility.js
  // already writes the rule down: a folder you cannot see is a folder you
  // cannot restore. The services screen shows archived rows always; this now
  // matches it unless somebody deliberately asks for quiet, and when they do,
  // it applies to both panes rather than to one of them.
  const [hideArchived, setHideArchived] = useState(false)

  // The hiding rule is in lib/productTree.js, not spelled out here: it thins
  // the flat list before the walk so archiving stays inherited, and that is a
  // claim worth a test rather than a reading.
  const tree = useMemo(
    () => buildProductTree(categories, products, { hideArchived }),
    [categories, products, hideArchived]
  )
  const byId = useMemo(() => indexCategoriesById(categories), [categories])

  // A selection that survived the folder leaving the tree points at something
  // nobody can see: the right pane would keep listing its products while the
  // left pane shows nothing selected, and in step 3 the toolbar buttons would
  // edit and archive a folder that is not on screen. The same ADR-048 shape —
  // state naming what is no longer drawn — coming in through a filter.
  //
  // Derived rather than cleared. Hiding is a view filter, not a destructive
  // act, so unticking the box puts the person back where they were instead of
  // making them find the folder again. Nothing is written, so nothing can be
  // written wrongly.
  const visibleSelectedId = treeContains(tree, selectedCategoryId) ? selectedCategoryId : null

  // ⚠️ NO FOLDER CHOSEN MEANS EVERY PRODUCT, not an empty table.
  //
  // This returned [] until somebody clicked a folder, while the search box was
  // drawn the whole time — so a person looking for a product whose folder they
  // did not know, which is the only reason to search, was told «ما في نتائج»
  // about a product that exists. Not silent: a confident wrong answer.
  //
  // And the folder now includes its subfolders, by the SAME walk the counting
  // sheet and the archive dialog use. It filtered on direct children alone, so
  // «شعر» meant one set here and another set there — one question with two
  // answers, which is the class the storage lens closed one stage ago.
  const rows = useMemo(
    () => catalogueRows({
      products, categories, categoryId: visibleSelectedId, search, hideArchived,
    }),
    [products, categories, visibleSelectedId, search, hideArchived]
  )

  // Runs of rows, each carrying its folder so the table can head it. Grouping,
  // not ranking: what matters is that a folder's products are adjacent.
  const groups = useMemo(() => catalogueGroups(rows, categories), [rows, categories])

  function selectCategory(id) {
    setSelectedCategoryId(id)
    setSelectedProductId(null)
  }

  const selectedCategory = visibleSelectedId ? byId[visibleSelectedId] : null
  const selectedProduct = rows.find((p) => p.id === selectedProductId) || null
  // Its own flag, not the resolved state: a folder hidden only by an archived
  // parent is not restorable from here — you put the parent back and it comes
  // with it — so the button follows what this row says about itself.
  const selectedIsArchived = selectedCategory?.is_active === false

  async function toggleProductArchived() {
    if (!selectedProduct) return
    const archiving = selectedProduct.is_active !== false
    setBusy(true)
    setActionError('')
    const { ok, error: writeError } = await setProductArchived(selectedProduct.id, archiving)
    setBusy(false)
    if (!ok) {
      setActionError(writeError
        ? dbErrorSentence(writeError, t, 'ProductsBrowser.archiveProduct')
        : t('products:archiveDialog.failedMessage'))
      return
    }

    // ⚠️ Explains, does not block, and asks nothing.
    //
    // Nothing stops a product with stock from being archived (measured: only
    // trg_freeze_consignment_after_use exists on products), and nothing should
    // — an archived STORAGE is unreachable so only the database can save it,
    // while an archived PRODUCT is merely filtered and the screen can. Making
    // somebody write off three remaining bottles of a discontinued line is
    // friction that buys nothing, because "archived" means "stop buying this",
    // not "the shelf is empty".
    //
    // What was missing was knowledge, not a guard. So this appears AFTER the
    // act, with no question and no second button: the action is not
    // destructive and is undone by the button that is still under the cursor.
    // Only ignorance of what happens next was worth fixing.
    const stillStocked = archiving ? stockedStorages({ balances, productId: selectedProduct.id }) : []
    setArchiveNotice(stillStocked.length > 0
      ? { product: selectedProduct, storages: stillStocked }
      : null)

    reload()
  }

  async function confirmArchiveCategory() {
    if (!archiveTarget) return
    setBusy(true)
    setActionError('')
    const { ok, error: writeError } = await setProductCategoryArchived(
      archiveTarget.id, archiveTarget.is_active !== false
    )
    setBusy(false)
    if (!ok) {
      setActionError(writeError
        ? dbErrorSentence(writeError, t, 'ProductsBrowser.archiveCategory')
        : t('products:archiveDialog.failedMessage'))
      return
    }
    setArchiveTarget(null)
    reload()
  }

  // How many products an archive takes with it, at any depth. "23 products" is
  // the part somebody needs to hear before agreeing.
  const affectedCount = archiveTarget
    ? (() => {
        const ids = descendantIds(archiveTarget, categories)
        return (products || []).filter((p) => ids.has(p.category_id)).length
      })()
    : 0

  const money = (value) =>
    value === null || value === undefined
      ? <span className="text-muted-foreground">—</span>
      : t('products:priceShort', { price: Number(value).toLocaleString('ar') })

  return (
    <>
      {/* Above the browser, never instead of it. Swapping the element out on
          failure is the ADR-048 mistake with a different trigger: a refresh
          that fails after somebody picked a folder would throw the folder,
          the open branches and the search away on its way to saying so. */}
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            {t('products:loadFailedTitle')}
          </span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'ProductsBrowser.load')}
          </span>
          <span className="text-xs text-muted-foreground">{t('products:loadFailedHint')}</span>
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      <TwoPaneBrowser
        loading={loading}
        tree={tree}
        isArchived={(root) => isCategoryArchived(root, byId)}
        archivedLabel={t('products:archivedBadge')}
        selectedCategoryId={visibleSelectedId}
        onSelectCategory={selectCategory}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('products:searchPlaceholder')}
        // A catalogue that starts at zero folders needs to say so. The services
        // screen never did — it opened onto a seeded tree — so an empty white
        // pane here would read as a screen that failed to load.
        treeEmpty={
          <div className="flex flex-col gap-1 p-4 text-center text-sm text-muted-foreground">
            <span>{t('products:noCategoriesTitle')}</span>
            <span className="text-xs">{t('products:noCategoriesHint')}</span>
          </div>
        }
        treeToolbar={
          <>
            <ToolButton
              icon={Plus}
              label={t('products:categoryToolbar.add')}
              onClick={() => setCategoryDialog({ category: null })}
            />
            <ToolButton
              icon={Pencil}
              label={t('products:categoryToolbar.edit')}
              disabled={!selectedCategory}
              onClick={() => setCategoryDialog({ category: selectedCategory })}
            />
            <ToolButton
              icon={Archive}
              label={t(selectedIsArchived
                ? 'products:categoryToolbar.restore'
                : 'products:categoryToolbar.archive')}
              disabled={!selectedCategory}
              onClick={() => setArchiveTarget(selectedCategory)}
            />
          </>
        }
        itemsToolbar={
          <>
            <ToolButton
              icon={Plus}
              label={t('products:productToolbar.add')}
              disabled={!visibleSelectedId}
              onClick={() => setDialog({ product: null })}
            />
            <ToolButton
              icon={Pencil}
              label={t('products:productToolbar.edit')}
              disabled={!selectedProduct}
              onClick={() => setDialog({ product: selectedProduct })}
            />
            {/* No confirmation, unlike a folder: this takes one product off the
                list and the same press puts it back. */}
            <ToolButton
              icon={Archive}
              label={t(selectedProduct && selectedProduct.is_active === false
                ? 'products:productToolbar.restore'
                : 'products:productToolbar.archive')}
              disabled={!selectedProduct || busy}
              onClick={toggleProductArchived}
            />

            <label className="flex cursor-pointer items-center gap-2 px-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary"
                checked={hideArchived}
                onChange={(e) => setHideArchived(e.target.checked)}
              />
              {t('products:hideArchived')}
            </label>
          </>
        }
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th className="w-24 px-3 py-2 text-start font-medium">{t('products:columns.abbreviation')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('products:columns.name')}</th>
              <th className="w-28 px-3 py-2 text-start font-medium">{t('products:columns.inContainer')}</th>
              <th className="w-28 px-3 py-2 text-start font-medium">{t('products:columns.purchasePrice')}</th>
              <th className="w-28 px-3 py-2 text-start font-medium">{t('products:columns.retailPrice')}</th>
            </tr>
          </thead>
          {/* No "Remaining" columns yet, in packages or in units. A balance is
              the sum of stock movements and there are none — so the honest
              answer today is "unknown", and a column of zeros would say
              "nothing left" instead. They arrive with the movements. */}
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.categoryId || 'none'}>
                {/* ⚠️ A heading per run, including when there is only one. The
                    table spans folders now, so a row with no folder above it is
                    a row whose folder the reader has to remember from the tree —
                    the very thing the tree stopped being the only answer to. And
                    a product whose folder is unknown keeps its row and says so
                    rather than vanishing. */}
                <tr className="bg-muted/40">
                  <td colSpan={5} className="px-3 py-1 text-xs font-medium text-muted-foreground">
                    {group.category ? group.category.name : t('products:noCategoryGroup')}
                  </td>
                </tr>
                {group.products.map((p) => (
              <tr
                key={p.id}
                onClick={() => setSelectedProductId(p.id)}
                className={`cursor-pointer border-b border-border/60 ${
                  selectedProductId === p.id ? 'bg-primary/10' : 'hover:bg-muted/60'
                }`}
              >
                <td className="px-3 py-1.5 text-muted-foreground">{p.abbreviation || '—'}</td>
                <td className="px-3 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className={p.is_active === false ? 'text-muted-foreground line-through' : ''}>
                      {p.name}
                    </span>
                    {p.kind === 'set' && <Badge variant="outline">{t('products:setBadge')}</Badge>}
                    {p.is_active === false && <Badge variant="outline">{t('products:archivedBadge')}</Badge>}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground">
                  {t('products:inContainerValue', {
                    count: Number(p.units_per_package),
                    unit: t(`products:units.${p.base_unit}`),
                  })}
                </td>
                <td className="px-3 py-1.5">{money(p.nominal_purchase_price)}</td>
                <td className="px-3 py-1.5">{money(p.package_price)}</td>
              </tr>
                ))}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  {search.trim() ? t('common:noResults') : t('products:emptyCatalogue')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TwoPaneBrowser>

      {actionError && <div className="text-sm text-destructive">{actionError}</div>}

      {/* ⚠️ An explanation, not a question. No second button, because the act
          is not destructive and the button that undoes it is still where the
          cursor left it. What was missing was never a guard — it was knowing
          that the goods stay on the shelf, stay countable by the stocktake,
          and stay on the balance screen until they run out. */}
      {archiveNotice && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-medium">
            {t('products:archiveNotice.title', { name: archiveNotice.product.name })}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {archiveNotice.storages.map((row) => (
              <Badge key={row.storage_id} variant="outline">
                {t('products:archiveNotice.atStorage', {
                  storage: (storages || []).find((s) => s.id === row.storage_id)?.name || '—',
                  unit: t(`products:units.${archiveNotice.product.base_unit || 'pcs'}`),
                  n: Number(row.balance_base).toLocaleString('ar', { maximumFractionDigits: 3 }),
                })}
              </Badge>
            ))}
          </div>
          <span className="text-muted-foreground">{t('products:archiveNotice.explain')}</span>
          <Button
            type="button" variant="outline" size="sm" className="self-start"
            onClick={() => setArchiveNotice(null)}
          >
            {t('products:archiveNotice.dismiss')}
          </Button>
        </div>
      )}

      <ProductFormDialog
        open={!!dialog}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        product={dialog?.product}
        categoryId={visibleSelectedId}
        categories={categories}
        products={products}
        suppliers={suppliers}
        salonId={salonId}
        onSaved={reload}
      />

      <ProductCategoryFormDialog
        open={!!categoryDialog}
        onOpenChange={(open) => { if (!open) setCategoryDialog(null) }}
        category={categoryDialog?.category}
        categories={categories}
        defaultParentId={categoryDialog?.category ? null : visibleSelectedId}
        salonId={salonId}
        onSaved={reload}
      />

      {/* Archiving a folder is asked about rather than done. It reaches
          further than this screen, and the count says how far. */}
      <Dialog open={!!archiveTarget} onOpenChange={(o) => { if (!o) { setArchiveTarget(null); setActionError('') } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t(archiveTarget?.is_active === false
                ? 'products:archiveDialog.restoreTitle'
                : 'products:archiveDialog.archiveTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            <p className="font-medium">{archiveTarget?.name}</p>
            <p className="text-muted-foreground">
              {t(archiveTarget?.is_active === false
                ? 'products:archiveDialog.restoreMessage'
                : 'products:archiveDialog.archiveMessage', { count: affectedCount })}
            </p>
            {actionError && <div className="text-destructive">{actionError}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setArchiveTarget(null); setActionError('') }}>
              {t('common:discard')}
            </Button>
            <Button disabled={busy} onClick={confirmArchiveCategory}>
              {busy ? t('common:saving') : t('common:done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
