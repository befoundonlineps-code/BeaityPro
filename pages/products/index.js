import { useState } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import AuthGate from '../../components/AuthGate'
import AppShell from '../../components/AppShell'
import ProductsSecondaryBar from '../../components/ProductsSecondaryBar'
import ProvisionalPaletteBadge from '../../components/ref/ProvisionalPaletteBadge'
import RefStorageBox from '../../components/ref/RefStorageBox'
import RefModal from '../../components/ref/RefModal'
import ProductsBrowser from '../../components/ProductsBrowser'
import StoragesManager from '../../components/StoragesManager'
import SuppliersManager from '../../components/SuppliersManager'
import StockDocumentScreen from '../../components/StockDocumentScreen'
import StockDocumentsList from '../../components/StockDocumentsList'
import StorageBalances from '../../components/StorageBalances'
import StocktakeScreen from '../../components/StocktakeScreen'
import ProductOrderScreen from '../../components/ProductOrderScreen'
import StocktakeCoverage from '../../components/StocktakeCoverage'
import { useInventoryDirectories } from '../../hooks/useInventoryDirectories'
import { useProductCatalog } from '../../hooks/useProductCatalog'
import { useEmployees } from '../../hooks/useEmployees'
import { useStockDocuments } from '../../hooks/useStockDocuments'
import { useProductBalances } from '../../hooks/useProductBalances'
import { useProductOrders } from '../../hooks/useProductOrders'
import { productsQuery, isDocumentView } from '../../lib/productsView'
import { OPERATION_LABEL_KEY, productsOperationFromQuery } from '../../lib/productsOperations'
import { currentLens, lensChoices, lensMayWiden } from '../../lib/storageLens'
import { useStocktakeSession } from '../../hooks/useStocktakeSession'
import { useStocktakeCoverage } from '../../hooks/useStocktakeCoverage'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'products', 'employees', 'settings', 'topBar'])),
    },
  }
}

// How wide each operation opens. Each window is sized to what is in it: the
// storages list is narrow, a supply document is as wide as its grid.
const OPERATION_WIDTH = {
  storages: 'max-w-[720px]',
  suppliers: 'max-w-[820px]',
  coverage: 'max-w-[1000px]',
}

export default function ProductsPage() {
  const { t } = useTranslation(['products', 'common'])
  const router = useRouter()

  // 🔴 THE OPERATION IS IN THE URL, AND THAT IS THE WHOLE POINT OF THIS SHAPE.
  //
  // The tab used to live here for four measured reasons, all of them the
  // owner's: pressing «المنتجات» in the main menu did nothing because every tab
  // was the same address; the back button skipped the whole section instead of
  // stepping through it; no screen could be bookmarked or sent to anybody; and
  // a reload dropped you on the catalogue.
  //
  // Turning tabs into modals brings all four back if the modal is held in
  // component state — so it is not. `?op=supply` IS the open modal: back closes
  // it, forward reopens it, a reload lands on it, and the address can be sent.
  //
  // ⚠️ The reference cannot advise here. It is a Windows application with no
  // address bar and no back button, so «what happens on reload» is a question
  // its design never had to answer. This is the first place it is silent rather
  // than different, and the owner decided it.
  const op = productsOperationFromQuery(router.query.op)

  function openOperation(next) {
    router.push(
      { pathname: '/products', query: productsQuery('catalog', next ? { op: next } : {}) },
      undefined,
      // The page's data is already loaded; this opens a window, not a fetch.
      { shallow: true }
    )
  }

  // Read once here rather than inside each screen. The product window's
  // consignment dropdown needs the suppliers while standing on the catalogue,
  // so a hook called inside the suppliers screen would be a list the catalogue
  // could not see — and calling it in both places would be two fetches of the
  // same four tables on one page.
  const directories = useInventoryDirectories()
  const { employees } = useEmployees()

  // ⚠️ ONE ANSWER TO "WHICH STORAGE", for the whole module. Four screens each
  // held their own with three different defaults, and moving between them lost
  // the choice every time.
  const [chosenStorage, setChosenStorage] = useState('')

  // ⚠️ One catalogue for the whole page. ProductsBrowser used to call the hook
  // itself, so the tab that creates a product refreshed its own copy and the
  // document screens kept theirs — and the most ordinary path there is (goods
  // arrive with a new item → create the product → go and receive it) ended with
  // the product missing from the list.
  const catalogue = useProductCatalog()
  const stockDocuments = useStockDocuments()
  const balances = useProductBalances()
  // ⚠️ Read at the page and not inside the order screen, for the same reason
  // the catalogue is: the supply screen fills FROM these.
  const productOrders = useProductOrders()
  // Its own read: this asks what has happened across every storage, so it does
  // not follow the lens and must not reload when the lens moves.
  const coverage = useStocktakeCoverage()

  // 🔴 RESOLVED FOR THE BACKGROUND, ONCE — NOT PER OPERATION, AND THE REASON IS
  // NOT LAZINESS.
  //
  // currentLens takes the view because a view that may not widen turns «all»
  // back into one real storage. Passing the OPEN OPERATION here would make the
  // catalogue behind the modal change its numbers the moment a modal opened
  // over it: standing on «all storages» and pressing «الطلبيّات» would silently
  // renumber the grid underneath to the first live storage.
  //
  // ⚠️ And it is sound rather than merely convenient, because operationBlocked
  // closes the only gap: every operation that consumes a storage is refused
  // while the lens is wide, and the two that are not refused — the order sheet
  // and the document list — either take no storage at all or may widen. So
  // there is no reachable case where the operation wants a narrower lens than
  // the background is showing. lib/storageScopedOperations.test.js is what
  // keeps those two lists agreeing.
  const lensId = currentLens(directories.storages, chosenStorage, 'catalog')
  const lensStorage = (directories.storages || []).find((s) => s.id === lensId) || null

  // Keyed on the lens, so the sheet for each storage is read from its own
  // session. Switching back and forth costs a read and loses nothing.
  const stocktake = useStocktakeSession(lensId)

  const closeOperation = () => openOperation(null)

  return (
    <AuthGate>
      {({ session, salonId, logout }) => (
        // 🔴 BACK INSIDE AppShell, AND THE TWO BARS ARE THE PRODUCT'S OWN AGAIN.
        //
        // They were rebuilt in the reference's image — an orange tab strip and a
        // band of large icon buttons — and that widened the ask. What was asked
        // for is the reference's CONTENT AREA: the tree, the dense grid, the
        // modal per operation. The top bar and the operations bar keep the
        // existing design and stay identical on every screen in the product,
        // which is the whole reason somebody can move between sections without
        // relearning where things are.
        //
        // ⇒ Everything above the catalogue is what it was. Everything from the
        // catalogue down is converted. The line between them is exactly where
        // the owner drew it.
        //
        // ⚠️ AND THE SENTENCE ABOVE ONCE NAMED THE COMPONENT IN ANGLE BRACKETS,
        // WHICH BROKE A GUARD. lib/cataloguePickerScope.test.js finds the call
        // site by searching this file for that tag and reading the props after
        // it — so prose mentioning the tag became the first hit and the guard
        // read a paragraph of English as a list of props. Same rule as §2ب of
        // CLAUDE.md, arriving in JSX instead of PL/pgSQL: a comment must not
        // spell the identifier its own file's check is hunting for.
        <AppShell userEmail={session.user.email} onLogout={logout}>
          <div className="flex h-full min-h-0 flex-col">

            {/* 🔴 THE BREADCRUMB ROW THAT WAS HERE IS GONE, AND KEEPING IT WAS
                THE MISTAKE THE OWNER NAMED. «المنتجات / كتالوج المنتجات» with a
                rounded select on the other side survived the conversion because
                it sits high on the screen and looked like chrome. It is not:
                everything under the two bars is the content area, and the
                content area is a complete replacement with no piece of the old
                look kept for being minor.
                ⚠️ And the breadcrumb was redundant even on its own terms — the
                tree's root row says the same thing AND names the storage the
                numbers belong to, which the breadcrumb never did. */}
            <div data-content-area className="flex min-h-0 flex-1 flex-col">
              {/* 🔴 THE OPERATIONS BAR SITS BESIDE THE STORAGE BOX, NOT ABOVE
                  IT — the owner's correction, drawn on a screenshot.
                  «Where am I working» and «what can I do here» are one band in
                  the reference, and they were two rows here: the bar full-width
                  under the top bar, the box on a strip of its own with an empty
                  half. I had even reported that empty half as an open question.
                  It was not a question — it was the bar's place.
                  ⚠️ And the bar itself is untouched: same component, same
                  colours, same order. What moved is where it is put, which is
                  the page's business rather than the bar's. */}
              <div className="flex shrink-0 items-stretch border-b border-[var(--rule)] bg-white">
                <RefStorageBox
                  value={lensId}
                  onChange={setChosenStorage}
                  choices={lensChoices(directories.storages, lensId)}
                  mayWiden={lensMayWiden('catalog')}
                  allLabel={t('products:columns.allStorages')}
                  noneLabel={t('products:docs.storageNone')}
                  archivedLabel={(name) => t('products:archivedOption', { name })}
                  onEditStorages={() => openOperation('storages')}
                />
                <div className="flex min-w-0 flex-1 items-center">
                  <ProductsSecondaryBar op={op} onSelect={openOperation} lensStorageId={lensId} />
                </div>
                <div className="flex shrink-0 items-start p-1.5">
                  <ProvisionalPaletteBadge />
                </div>
              </div>

            {/* ── The catalogue is the screen, permanently ────────────────
                Not a tab any more. Every operation opens over it and it stays
                readable underneath: in the reference's invoices screenshot the
                tree and the grid headings are still legible behind the
                window. */}
            <ProductsBrowser
              salonId={salonId}
              suppliers={directories.suppliers}
              catalogue={catalogue}
              balances={balances.balances}
              balancesLoading={balances.loading}
              balancesError={balances.error}
              storageId={lensId}
              storageName={lensStorage?.name || null}
              storages={directories.storages}
              storageCategories={directories.storageCategories}
            />
            </div>
          </div>

          {/* ── The operations ─────────────────────────────────────────── */}
          <RefModal
            open={!!op}
            onClose={closeOperation}
            width={OPERATION_WIDTH[op] || 'max-w-[1100px]'}
            title={op ? t(`products:secondaryItems.${OPERATION_LABEL_KEY[op]}`) : ''}
          >
            {op === 'storages' && (
              <StoragesManager
                storages={directories.storages}
                responsibles={directories.responsibles}
                employees={employees}
                // التشكيلة، ومعها ما تحتاجه رسالةُ الرفض لتسمّي الأصناف. كلُّه
                // محمَّلٌ لهذه الصفحة أصلًا — فلا استعلامَ جديد.
                categories={catalogue.categories}
                products={catalogue.products}
                balances={balances.balances}
                storageCategories={directories.storageCategories}
                loading={directories.loading}
                error={directories.error}
                reload={directories.reload}
                salonId={salonId}
              />
            )}
            {op === 'orders' && (
              <ProductOrderScreen
                salonId={salonId}
                orders={productOrders.orders}
                lines={productOrders.lines}
                suppliers={directories.suppliers}
                products={catalogue.products}
                loading={productOrders.loading || catalogue.loading || directories.loading}
                error={productOrders.error || catalogue.error || directories.error}
                reload={productOrders.reload}
              />
            )}
            {isDocumentView(op) && (
              <StockDocumentScreen
                // Keyed on the doc type so switching documents starts a fresh
                // form. Without it React keeps the old state under the new
                // shape, and a supplier picked for a return would still be
                // sitting there on a write-off that has no supplier field.
                key={op}
                docType={op}
                storageId={lensId}
                storages={directories.storages}
                suppliers={directories.suppliers}
                products={catalogue.products}
                // For the duplicate-number warning: it looks for another
                // document of the same supplier carrying the same number.
                documents={stockDocuments.documents}
                orders={productOrders.orders}
                orderLines={productOrders.lines}
                loading={directories.loading || catalogue.loading}
                onPosted={() => { catalogue.reload(); stockDocuments.reload() }}
              />
            )}
            {op === 'stocktake' && (
              <StocktakeScreen
                // ⚠️ Keyed on the lens, so changing storage starts a fresh sheet
                // by REMOUNTING rather than by an effect clearing state after a
                // render. What remounts is the folder choice and the note; the
                // counts come from the session for that storage and are read
                // again, not thrown away.
                key={lensId}
                storageId={lensId}
                salonId={salonId}
                userId={session.user.id}
                stocktake={stocktake}
                balances={balances.balances}
                products={catalogue.products}
                categories={catalogue.categories}
                loading={balances.loading || catalogue.loading || directories.loading}
                // ⚠️ Either read failing fails the screen, and it matters more
                // here than anywhere: a counting sheet drawn from half a read
                // shows fewer products than exist, somebody counts what is in
                // front of them, and the products that never appeared are
                // untouched rather than wrong — so nothing looks amiss at all.
                error={balances.error || catalogue.error || directories.error}
                // ⚠️ THE COVERAGE READ RELOADS TOO. Posting a stocktake creates
                // the very rows the coverage report is about, and a report
                // opened beforehand kept saying the count had not happened.
                onPosted={() => { balances.reload(); stockDocuments.reload(); coverage.reload() }}
              />
            )}
            {op === 'coverage' && (
              <StocktakeCoverage
                sessions={coverage.sessions}
                counts={coverage.counts}
                documents={stockDocuments.documents}
                products={catalogue.products}
                storages={directories.storages}
                loading={coverage.loading || catalogue.loading || stockDocuments.loading}
                // ⚠️ Any of the three failing fails the screen. A coverage
                // report drawn from half a read says products were never
                // counted when they were.
                error={coverage.error || catalogue.error || stockDocuments.error}
                reload={coverage.reload}
              />
            )}
            {op === 'documents' && (
              <StockDocumentsList
                // The list starts from the lens and can widen past it, which is
                // the one screen where "all storages" is a real question.
                storageId={lensId}
                documents={stockDocuments.documents}
                movements={stockDocuments.movements}
                products={catalogue.products}
                storages={directories.storages}
                suppliers={directories.suppliers}
                loading={stockDocuments.loading || catalogue.loading}
                error={stockDocuments.error}
                reload={stockDocuments.reload}
              />
            )}
            {op === 'balances' && (
              <StorageBalances
                storageId={lensId}
                balances={balances.balances}
                products={catalogue.products}
                storages={directories.storages}
                loading={balances.loading || catalogue.loading || directories.loading}
                // ⚠️ Either read failing fails the screen. A balance list is
                // legitimately empty on a fresh salon, so half a read drawn as
                // "no stock recorded" would reassure rather than fail.
                error={balances.error || catalogue.error || directories.error}
                reload={() => { balances.reload(); catalogue.reload() }}
              />
            )}
            {op === 'suppliers' && (
              <SuppliersManager
                suppliers={directories.suppliers}
                contacts={directories.contacts}
                loading={directories.loading}
                error={directories.error}
                reload={directories.reload}
                salonId={salonId}
              />
            )}
          </RefModal>
        </AppShell>
      )}
    </AuthGate>
  )
}
