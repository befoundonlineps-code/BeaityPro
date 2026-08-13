import { Fragment, useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, Plus, Pencil, Archive, Search } from 'lucide-react'
import RefTwoPane, { RefPaneButton } from './ref/RefTwoPane'
import { RefTable, RefHead, RefTh, RefRow, RefTd, RefGroupRow, RefFillerRow, RefTag } from './ref/RefGrid'
import ProductFormDialog from './ProductFormDialog'
import ProductCategoryFormDialog from './ProductCategoryFormDialog'
import { buildProductTree, countProducts } from '../lib/productTree'
import { treeContains } from '../lib/categoryTree'
import { isCategoryArchived, descendantIds } from '../lib/categoryVisibility'
import { catalogueRows, catalogueGroups } from '../lib/catalogueView'
import { foldersForStorage, isUnassignedFolder } from '../lib/folderStorageScope'
import { canCreateFolder } from '../lib/folderStorageInherit'
import { indexCategoriesById } from '../lib/categoryTypes'
import { dbErrorSentence } from '../lib/dbErrors'
import { stockedStorages, BALANCE_STATE } from '../lib/balanceView'
import { catalogueBalanceRows, otherStorageTotals } from '../lib/catalogueBalance'
import { ALL_STORAGES } from '../lib/storageLens'
import { packageFraction, showsPackageFrame } from '../lib/catalogueFrames'
import { setProductArchived, setProductCategoryArchived } from '../lib/productAdminIO'
import RefModal, { RefActionButton, RefCancelButton } from './ref/RefModal'

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

// ── The balance cell ──────────────────────────────────────────────────────
//
// One cell, and three states rather than two.
//
// ⚠️ «ما تحرّك بعد» is NOT «0», and both cases are live in this database —
// «بلسم 250 مل» has no movement at all and «سيروم علاجي 100 مل» has two live
// movements and a balance of exactly zero. Drawing both as 0 tells the second
// story about the first: "it ran out" about something that was never supplied.
// balanceView.js decides which is which; this only draws it.
//
// ⚠️ And no dash, ever. The movements are the ledger now, so zero is an ANSWER
// and not an absence — a dash would put them back on the same footing.
//
// 🔴 FOUR STATES, NOT THREE — AND THE FOURTH WAS A LIE BEFORE THIS ARGUMENT
// EXISTED. The seed that makes every product read «ما تحرّك بعد» when no
// balance rows are present is TRUE for a salon that has moved nothing, and
// FALSE for a page whose balances are still in flight. Both were drawn the
// same way.
//
// ⚠️ And it is false in the REASSURING direction, which is the worse one: the
// data is on its way, the screen says "never moved", and the reader takes that
// for "nothing in stock" and walks off. The blank cell it replaced was merely
// useless; this would be wrong.
//
// ⚠️ AND IT IS REACHABLE, measured rather than assumed: the page passes
// `balances.balances` — the array alone — and useProductBalances starts at
// `useState([])` with `loading: true`. The catalogue tab has no gate on it
// (the balances view does, pages/products/index.js). So the first paint of
// every session hits this.
//
//   loading  the fetch is out and nothing can be said yet
//   error    it failed, and the column must say so rather than say "zero"
//   loaded   the three real states balanceView decides between
//
// The rest of the screen does not wait: the catalogue is readable without a
// balance, so only the column holds.
function balanceCell(row, product, t, { loading, error }) {
  if (error) {
    return (
      <span className="text-muted-foreground" title={t('products:columns.balanceUnavailableHint')}>
        {t('products:columns.balanceUnavailable')}
      </span>
    )
  }
  if (loading) return <span className="text-muted-foreground">{t('products:columns.balanceLoading')}</span>
  if (!row) return null
  if (row.balanceState === BALANCE_STATE.NEVER_MOVED) {
    return (
      <span className="text-muted-foreground" title={t('products:balances.neverMovedHint')}>
        {t('products:balances.neverMoved')}
      </span>
    )
  }

  const base = Number(row.balanceBase)
  const unit = t(`products:units.${product.base_unit}`)
  const inBase = t('products:balances.inBase', { unit, n: base })

  // ⚠️ Grey, not red, for zero — and negative is the one that earns colour.
  // Zero is an ordinary answer; a negative balance is the ledger disagreeing
  // with itself, which is the only state here nobody can explain away.
  const tone = base < 0 ? 'text-destructive' : base === 0 ? 'text-muted-foreground' : ''

  if (!showsPackageFrame(product)) return <span className={tone}>{inBase}</span>

  const packages = packageFraction(base, product.units_per_package)
  return (
    <span className={tone}>
      {packages === null ? inBase : `${t('products:columns.inPackages', { n: packages })} · ${inBase}`}
    </span>
  )
}

// ── «And how much is next door?» ──────────────────────────────────────────
//
// 🔴 THE COLUMN THE BALANCE COLUMN NEEDED. «Zero here» is half a sentence, and
// the missing half is what decides whether somebody orders more or walks to the
// next room. design/TOKENS.md wrote the rule down before there was anywhere to
// put it: the grey zero is calm precisely because what to do next is beside it.
//
// ⚠️ AN EMPTY CELL WHEN THERE IS NO ROW, NOT A ZERO. No entry means the product
// has no balance row in any other storage — nothing was measured about it
// elsewhere — and a 0 there would be a measurement that was never taken. A row
// that exists and sums to zero DOES print 0, because that one was taken.
//
// ⚠️ And the unit rides with the number, in the same frame the balance column
// uses. Two figures of the same thing in adjacent columns written two ways is
// how a reader learns to distrust both.
function elsewhereCell(total, product, t) {
  if (total === undefined || total === null) return null
  const unit = t(`products:units.${product.base_unit}`)
  return <span>{t('products:balances.inBase', { unit, n: Number(total) })}</span>
}

export default function ProductsBrowser({
  salonId, suppliers, catalogue, balances, storages,
  // ⚠️ Separate props rather than folded into `balances`, because the array is
  // already the shape three other screens take. And they default to "loaded",
  // which fails OPEN — a caller that forgets them gets the lie back. There is
  // one call site and lib/cataloguePickerScope.test.js reads it, which is the
  // cheap way to keep the one honest.
  balancesLoading = false, balancesError = null,
  // 🔴 THE LENS, AND THIS SCREEN DOES NOT OWN IT.
  //
  // It briefly did: a picker of its own, with its own useState. That is two
  // controls for one concept — set the page lens to تجريبي, come here, and this
  // said "all storages". One screen answering one question twice.
  //
  // ⇒ The lens moved up to the page, where it already was for six other views,
  // and this reads it. There is no local state to disagree with it, which is
  // the difference between a rule to remember and a shape that cannot come
  // apart. Guarded in lib/cataloguePickerScope.test.js.
  storageId = ALL_STORAGES,
  // The tree's root row says which storage the numbers below belong to, so it
  // needs the name rather than the id. Optional: the tests render without one
  // and get the bare «المنتجات».
  storageName = null,
  // What the screen opens on. See the state declarations below for why these
  // are props rather than always empty.
  initialCategoryId = null,
  initialSearch = '',
}) {
  const { t } = useTranslation(['products', 'common'])
  const { categories, products, loading, error, reload } = catalogue

  // Shown after archiving a product that still has stock. Not a confirmation —
  // see toggleProductArchived for why it asks nothing.
  const [archiveNotice, setArchiveNotice] = useState(null)

  // 🔴 THE FOLDER IS A SEAM NOW, NOT ONLY INTERNAL STATE — and the reason is a
  // guard that would otherwise have died with the rule change.
  //
  // «No folder chosen» used to mean every product, so a rendered page showed
  // the whole catalogue and components/ProductsBrowser.test.js could count it.
  // That test exists for a case the owner named himself: «nobody looking at a
  // long list can tell ALL from MOST». With the new rule the first render is
  // empty by design, and the selection is internal — so the only reachable
  // render had nothing to count and the guard had no case left.
  //
  // ⇒ The opening folder AND the opening search come in as props. They are not
  // test hooks: they are the same seam `?op=` uses, and «which folder» and
  // «what was typed» are exactly what a link to this screen would have to
  // carry. The page does not pass either yet, and saying so is the point — this
  // is a seam that exists before its caller.
  //
  // ⚠️ And two rather than one, because the states are not the same: a folder
  // narrows, a search widens to the storage. A render that can only reach the
  // first cannot check the row set that includes a product whose folder was
  // deleted — the row a grouping is likeliest to drop.
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [search, setSearch] = useState(initialSearch)
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

  // 🔴 THE FOLDERS THIS STORAGE SHOWS — AND EVERYTHING BELOW READS THIS LIST,
  // NOT `categories`.
  //
  // A folder belongs to a storage now (085). The tree narrows with the picker;
  // the BALANCE does not, and lib/treeVsBalanceScope.test.js asserts the two
  // apart — because the tempting next step, «so the balance should follow the
  // folder too», breaks nothing visible and quietly makes a product's number
  // mean something narrower than it says.
  //
  // ⚠️ Passed on to catalogueRows as well, so a folder from another storage
  // cannot be reached by a stale selection: catalogueScope fails closed on a
  // folder it cannot find.
  const visibleCategories = useMemo(
    () => foldersForStorage(categories, storageId),
    [categories, storageId]
  )

  // The hiding rule is in lib/productTree.js, not spelled out here: it thins
  // the flat list before the walk so archiving stays inherited, and that is a
  // claim worth a test rather than a reading.
  const tree = useMemo(
    () => buildProductTree(visibleCategories, products, { hideArchived }),
    [visibleCategories, products, hideArchived]
  )
  const byId = useMemo(() => indexCategoriesById(visibleCategories), [visibleCategories])

  // ⚠️ Keyed by product id and derived, never stored. Changing the storage
  // recomputes it; nothing has to be cleared, so nothing can be left behind
  // describing a storage that is no longer selected — the same reason
  // visibleSelectedId is derived rather than reset.
  // ⚠️ ONE CONVERSION OF THE SENTINEL, HERE, AND NOT INSIDE EITHER HELPER.
  // storageScope says «all» is the string 'all'; catalogueBalance says it is
  // null. Two sentinels for one idea, converted at the boundary — which is what
  // this line has always been. Naming it means the second reader below uses the
  // converted value rather than converting it again slightly differently.
  const lensOrNull = storageId === ALL_STORAGES ? null : storageId

  const balanceByProduct = useMemo(
    () => catalogueBalanceRows({ balances, products, storageId: lensOrNull }),
    [balances, products, lensOrNull]
  )

  // «And how much is next door?» — empty while the lens is already wide, which
  // is what makes the column disappear rather than fill with zeros.
  const elsewhereByProduct = useMemo(
    () => otherStorageTotals({ balances, storageId: lensOrNull }),
    [balances, lensOrNull]
  )

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

  // 🔴 NO FOLDER CHOSEN MEANS NO ROWS — AND THE COMMENT HERE USED TO SAY THE
  // EXACT OPPOSITE, CORRECTLY, ABOUT AN EARLIER RULE.
  //
  // It read: «NO FOLDER CHOSEN MEANS EVERY PRODUCT, not an empty table. This
  // returned [] until somebody clicked a folder, while the search box was drawn
  // the whole time — so a person looking for a product whose folder they did
  // not know, which is the only reason to search, was told ما في نتائج about a
  // product that exists. Not silent: a confident wrong answer.»
  //
  // Every word of that was true. The owner has since set the reference's rule —
  // the grid stays empty until a folder is picked — and the fault it caused is
  // closed by the OTHER half of the same decision rather than by this
  // behaviour: A SEARCH OVERRIDES THE EMPTY STATE and looks through the whole
  // storage. So the search box never lies, and it is `searchScope` below that
  // keeps that promise.
  //
  // ⚠️ And the empty state is SAID, not merely shown. A blank grid alone cannot
  // tell «no folder chosen» from «this folder is empty» — measured in the
  // reference, where the second screenshot's blank grid was only readable
  // because the toolbar showed nothing selected. Both panels are below.
  //
  // The folder includes its subfolders, by the SAME walk the counting sheet and
  // the archive dialog use.
  const searchScope = useMemo(
    // ⚠️ null on «all storages» — «do not narrow», which is a different
    // statement from «narrow to every id I could find»: a product whose folder
    // was deleted is in the first and not in the second. On one storage the set
    // IS the narrowing, and that is the point.
    () => (storageId === ALL_STORAGES ? null : new Set(visibleCategories.map((c) => c.id))),
    [storageId, visibleCategories]
  )

  const rows = useMemo(
    () => catalogueRows({
      products, categories: visibleCategories, categoryId: visibleSelectedId,
      search, hideArchived, searchScope,
    }),
    [products, visibleCategories, visibleSelectedId, search, hideArchived, searchScope]
  )

  // Runs of rows, each carrying its folder so the table can head it. Grouping,
  // not ranking: what matters is that a folder's products are adjacent.
  const groups = useMemo(() => catalogueGroups(rows, visibleCategories), [rows, visibleCategories])

  // The three states the grid can be in, named rather than inferred from
  // whether `rows` happens to be empty.
  // Whether a new folder could take a storage from where we are standing.
  // Read by the button and by the dialog through the same function.
  const canAddFolder = canCreateFolder({
    parent: visibleSelectedId ? byId[visibleSelectedId] : null,
    lensStorageId: storageId,
  })

  const searching = search.trim().length > 0
  const noFolderChosen = !visibleSelectedId && !searching

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

  // 🔴 THE LAST COLUMN CHANGES WITH THE LENS, AND THE REFERENCE DOES THIS TOO.
  //
  // On one storage it reads «المتبقّي هنا» and is followed by «بمستودعاتٍ
  // أخرى»; on «all storages» the second has no subject, so it goes and the
  // first becomes «المتبقّي بالكل». Measured in the reference: its own grid
  // ends with `Remaining · Units · In other storages` under one storage and
  // with `On all storages` alone under all of them.
  //
  // ⚠️ The heading naming the grain is not cosmetic here — it is the fix for
  // «28650 read as the product's balance when it was one storage's». The number
  // changes with a control the reader may not have looked at, so the column
  // says which question it answered.
  const wide = storageId === ALL_STORAGES
  const COLUMNS = wide ? 7 : 8

  return (
    <>
      {/* Above the browser, never instead of it. Swapping the element out on
          failure is the ADR-048 mistake with a different trigger: a refresh
          that fails after somebody picked a folder would throw the folder,
          the open branches and the search away on its way to saying so. */}
      {/* ⚠️ Flat and square, like everything else in this region. It used to be
          a rounded card with a shadcn button, which is the product's look
          outside here — and the content area is a complete replacement. */}
      {error && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--rule)] bg-destructive/5 px-3 py-1.5">
          <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
          <span className="text-xs font-semibold text-destructive">
            {t('products:loadFailedTitle')}
          </span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'ProductsBrowser.load')}
          </span>
          <span className="text-xs text-muted-foreground">{t('products:loadFailedHint')}</span>
          <button
            type="button"
            onClick={reload}
            className="ms-auto h-6 border border-[var(--rule)] bg-white px-2 text-xs hover:bg-black/5"
          >
            {t('products:retry')}
          </button>
        </div>
      )}

      <RefTwoPane
        loading={loading}
        tree={tree}
        isArchived={(root) => isCategoryArchived(root, byId)}
        archivedLabel={t('products:archivedBadge')}
        // ⚠️ The root row says «everything», and says which storage the numbers
        // under it belong to. The state existed and nothing on screen named it.
        rootLabel={
          wide
            ? t('products:refShell.rootAll')
            : storageName
              ? t('products:refShell.rootStorage', { name: storageName })
              : t('products:refShell.rootBare')
        }
        selectedCategoryId={visibleSelectedId}
        onSelectCategory={selectCategory}
        // A catalogue that starts at zero folders needs to say so. The services
        // screen never did — it opened onto a seeded tree — so an empty white
        // pane here would read as a screen that failed to load.
        isUnassigned={isUnassignedFolder}
        unassignedLabel={t('products:refShell.unassignedFolder')}
        // 🔴 TWO EMPTY TREES, NOT ONE — and telling them apart is the whole
        // point. «The salon has no folders at all» and «this storage has none
        // assigned to it» look identical as a blank pane, and the second is now
        // the ordinary state of a fresh storage. A blank that does not say
        // which one it is reads as a screen that failed to load.
        treeEmpty={
          <div className="flex flex-col gap-1 p-4 text-center text-xs text-muted-foreground">
            {(categories || []).length === 0 ? (
              <>
                <span>{t('products:noCategoriesTitle')}</span>
                <span>{t('products:noCategoriesHint')}</span>
              </>
            ) : (
              <>
                <span className="font-semibold">{t('products:refShell.noFoldersHere')}</span>
                <span>{t('products:refShell.noFoldersHereHint')}</span>
              </>
            )}
          </div>
        }
        treeToolbar={
          <>
            {/* 🔴 DISABLED WHEN THERE IS NO CONTEXT TO INHERIT FROM — and the
                condition is DERIVED from the same function the write uses, not
                stated a second time here. A separate rule on the button is the
                second list that drifts: it would forbid a case the write
                handles perfectly (a selected, assigned parent while the lens is
                wide) and one of the two would be corrected without the other.
                ⚠️ Greyed rather than hidden, and the title says what to do —
                the same rule the operations bar follows. */}
            <RefPaneButton
              icon={Plus}
              tone="text-green-600"
              label={t('products:categoryToolbar.add')}
              disabled={!canAddFolder}
              blockedTitle={t('products:categoryDialog.noStorageContext')}
              onClick={() => setCategoryDialog({ category: null })}
            />
            <RefPaneButton
              icon={Pencil}
              label={t('products:categoryToolbar.edit')}
              disabled={!selectedCategory}
              onClick={() => setCategoryDialog({ category: selectedCategory })}
            />
            <RefPaneButton
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
            <RefPaneButton
              icon={Plus}
              tone="text-green-600"
              label={t('products:productToolbar.add')}
              disabled={!visibleSelectedId}
              onClick={() => setDialog({ product: null })}
            />
            <RefPaneButton
              icon={Pencil}
              label={t('products:productToolbar.edit')}
              disabled={!selectedProduct}
              onClick={() => setDialog({ product: selectedProduct })}
            />
            {/* No confirmation, unlike a folder: this takes one product off the
                list and the same press puts it back. */}
            <RefPaneButton
              icon={Archive}
              label={t(selectedProduct && selectedProduct.is_active === false
                ? 'products:productToolbar.restore'
                : 'products:productToolbar.archive')}
              disabled={!selectedProduct || busy}
              onClick={toggleProductArchived}
            />

            {/* The search sits in this row in the reference, beside the buttons
                rather than floated to the far end. */}
            <span className="relative ms-2 flex items-center">
              <Search className="pointer-events-none absolute end-1.5 size-3 text-muted-foreground" />
              <input
                className="h-6 w-56 border border-[var(--rule)] px-1.5 pe-6 text-xs outline-none focus:border-[var(--chrome)]"
                placeholder={t('products:searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>

            <label className="flex cursor-pointer items-center gap-1.5 px-2 text-xs">
              <input
                type="checkbox"
                className="accent-[var(--chrome)]"
                checked={hideArchived}
                onChange={(e) => setHideArchived(e.target.checked)}
              />
              {t('products:hideArchived')}
            </label>

          </>
        }
      >
        <RefTable>
          <RefHead tone="list">
            <tr>
              <RefTh className="w-20">{t('products:columns.abbreviation')}</RefTh>
              <RefTh>{t('products:columns.name')}</RefTh>
              <RefTh className="w-20">{t('products:columns.inContainer')}</RefTh>
              {/* 🔴 A COLUMN OF ITS OWN, AND IT FIXES AN ARABIC FAULT RATHER
                  THAN ADDING A FIELD. This cell used to read «15 قطعة» — a
                  number followed by a singular noun, which is the exact shape
                  CLAUDE.md forbids («3 دقيقة» غلط) and which the count guard
                  missed because the noun arrives in a variable rather than
                  written out. Split into two columns the number stands alone
                  under a heading that says what it counts, and the unit stands
                  alone under its own. No agreement, so nothing to get wrong.
                  The reference had it this way; we did not, and it was not a
                  matter of taste. */}
              <RefTh className="w-20">{t('products:columns.unit')}</RefTh>
              <RefTh className="w-24">{t('products:columns.purchasePrice')}</RefTh>
              <RefTh className="w-24">{t('products:columns.retailPrice')}</RefTh>
              <RefTh className="w-44">
                {t(wide ? 'products:columns.remainingEverywhere' : 'products:columns.remainingHere')}
              </RefTh>
              {!wide && <RefTh className="w-32">{t('products:columns.inOtherStorages')}</RefTh>}
            </tr>
          </RefHead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.categoryId || 'none'}>
                {/* ⚠️ A heading per run, including when there is only one. The
                    table spans folders now, so a row with no folder above it is
                    a row whose folder the reader has to remember from the tree —
                    the very thing the tree stopped being the only answer to. And
                    a product whose folder is unknown keeps its row and says so
                    rather than vanishing. */}
                <RefGroupRow columns={COLUMNS}>
                  {group.category ? group.category.name : t('products:noCategoryGroup')}
                </RefGroupRow>
                {group.products.map((p) => (
                  <RefRow
                    key={p.id}
                    data-product-row={p.id}
                    selected={selectedProductId === p.id}
                    onClick={() => setSelectedProductId(p.id)}
                  >
                    <RefTd className="text-muted-foreground">{p.abbreviation || '—'}</RefTd>
                    <RefTd>
                      <span className="flex items-center gap-2">
                        <span className={p.is_active === false ? 'text-muted-foreground line-through' : ''}>
                          {p.name}
                        </span>
                        {/* ⚠️ Flat squares, not rounded pills. The pill is the
                            product's look and it does not live in here; the
                            information does, and it is the same information. */}
                        {p.kind === 'set' && <RefTag>{t('products:setBadge')}</RefTag>}
                        {p.is_active === false && <RefTag>{t('products:archivedBadge')}</RefTag>}
                      </span>
                    </RefTd>
                    <RefTd className="text-muted-foreground">{Number(p.units_per_package)}</RefTd>
                    <RefTd className="text-muted-foreground">{t(`products:units.${p.base_unit}`)}</RefTd>
                    <RefTd>{money(p.nominal_purchase_price)}</RefTd>
                    <RefTd>{money(p.package_price)}</RefTd>
                    <RefTd>
                      {balanceCell(balanceByProduct.get(p.id), p, t, { loading: balancesLoading, error: balancesError })}
                    </RefTd>
                    {!wide && (
                      <RefTd className="text-muted-foreground">
                        {elsewhereCell(elsewhereByProduct.get(p.id), p, t)}
                      </RefTd>
                    )}
                  </RefRow>
                ))}
              </Fragment>
            ))}
            {/* 🔴 THREE EMPTY STATES, NOT ONE — AND THE REFERENCE IS WHY.
                Its second screenshot shows folders present, none selected and a
                blank grid; the blank ALONE could not be told from «this folder
                is empty». What made it readable was the toolbar — nothing
                highlighted, Edit and Archive greyed. The same rule applies
                here, and louder: a blank grid with no sentence in it is a
                screen that looks broken.
                ⚠️ Same principle as the provisional-palette badge: a state the
                reader must know about is SAID on screen, not left to be
                inferred from an absence. */}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS} className="px-3 py-10 text-center">
                  {noFolderChosen ? (
                    <span className="flex flex-col gap-1" data-empty-state="pick-folder">
                      <span className="font-semibold">{t('products:pickFolder.title')}</span>
                      <span className="text-muted-foreground">{t('products:pickFolder.hint')}</span>
                    </span>
                  ) : searching ? (
                    <span className="text-muted-foreground" data-empty-state="no-results">
                      {t('common:noResults')}
                    </span>
                  ) : (
                    <span className="flex flex-col gap-1" data-empty-state="folder-empty">
                      <span className="font-semibold">{t('products:folderEmpty.title')}</span>
                      <span className="text-muted-foreground">{t('products:folderEmpty.hint')}</span>
                    </span>
                  )}
                </td>
              </tr>
            )}
            {/* Carries the column rules down through the empty area, so an
                empty grid reads as an empty grid rather than as a screen that
                did not load. */}
            <RefFillerRow columns={COLUMNS} />
          </tbody>
        </RefTable>
      </RefTwoPane>

      {actionError && <div className="px-3 py-1 text-xs text-destructive">{actionError}</div>}

      {/* ⚠️ An explanation, not a question. No second button, because the act
          is not destructive and the button that undoes it is still where the
          cursor left it. What was missing was never a guard — it was knowing
          that the goods stay on the shelf, stay countable by the stocktake,
          and stay on the balance screen until they run out. */}
      {archiveNotice && (
        <div className="flex shrink-0 flex-col gap-1.5 border-t border-[var(--rule)] bg-black/[0.03] px-3 py-2 text-xs">
          <span className="font-semibold">
            {t('products:archiveNotice.title', { name: archiveNotice.product.name })}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {archiveNotice.storages.map((row) => (
              <RefTag key={row.storage_id}>
                {t('products:archiveNotice.atStorage', {
                  storage: (storages || []).find((s) => s.id === row.storage_id)?.name || '—',
                  unit: t(`products:units.${archiveNotice.product.base_unit || 'pcs'}`),
                  n: Number(row.balance_base).toLocaleString('ar', { maximumFractionDigits: 3 }),
                })}
              </RefTag>
            ))}
          </div>
          <span className="text-muted-foreground">{t('products:archiveNotice.explain')}</span>
          <button
            type="button"
            onClick={() => setArchiveNotice(null)}
            className="h-6 self-start border border-[var(--rule)] bg-white px-2 text-xs hover:bg-black/5"
          >
            {t('products:archiveNotice.dismiss')}
          </button>
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
        lensStorageId={storageId}
        defaultParentId={categoryDialog?.category ? null : visibleSelectedId}
        salonId={salonId}
        onSaved={reload}
      />

      {/* Archiving a folder is asked about rather than done. It reaches
          further than this screen, and the count says how far.
          ⚠️ A RefModal like every other window opened from here — it was the
          product's rounded Dialog, which is a piece of the old look kept in the
          content area because it is small and rarely seen. Neither is a
          reason. */}
      <RefModal
        open={!!archiveTarget}
        onClose={() => { setArchiveTarget(null); setActionError('') }}
        width="max-w-[460px]"
        title={t(archiveTarget?.is_active === false
          ? 'products:archiveDialog.restoreTitle'
          : 'products:archiveDialog.archiveTitle')}
        footer={
          <>
            <RefCancelButton onClick={() => { setArchiveTarget(null); setActionError('') }}>
              {t('common:discard')}
            </RefCancelButton>
            <RefActionButton disabled={busy} onClick={confirmArchiveCategory}>
              {busy ? t('common:saving') : t('common:done')}
            </RefActionButton>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-xs">
          <p className="font-semibold">{archiveTarget?.name}</p>
          <p className="text-muted-foreground">
            {t(archiveTarget?.is_active === false
              ? 'products:archiveDialog.restoreMessage'
              : 'products:archiveDialog.archiveMessage', { count: affectedCount })}
          </p>
          {actionError && <div className="text-destructive">{actionError}</div>}
        </div>
      </RefModal>
    </>
  )
}
