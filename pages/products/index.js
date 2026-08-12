import { useState } from 'react'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import {
  ClipboardList, PackagePlus, ArrowLeftRight, PackageMinus, Undo2,
  ClipboardCheck, ListChecks, ScrollText, Truck, Boxes,
} from 'lucide-react'
import AuthGate from '../../components/AuthGate'
import RefTopBar from '../../components/ref/RefTopBar'
import RefToolbar, { RefToolButton, RefStorageBox } from '../../components/ref/RefToolbar'
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
import {
  TOOLBAR_OPERATIONS, OPERATION_LABEL_KEY,
  productsOperationFromQuery, operationBlocked,
} from '../../lib/productsOperations'
import { currentLens, lensChoices, lensMayWiden, ALL_STORAGES } from '../../lib/storageLens'
import { useStocktakeSession } from '../../hooks/useStocktakeSession'
import { useStocktakeCoverage } from '../../hooks/useStocktakeCoverage'

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common', 'login', 'products', 'employees', 'settings', 'topBar'])),
    },
  }
}

// The icon each operation wears in the band. Kept beside the page rather than
// in lib/, because an icon is a drawing and lib/ holds decisions — and the
// operation table there has to stay readable by a test that has no React.
const OPERATION_ICON = {
  orders: ClipboardList,
  supply: PackagePlus,
  transfer: ArrowLeftRight,
  write_off: PackageMinus,
  return_to_supplier: Undo2,
  stocktake: ClipboardCheck,
  coverage: ListChecks,
  documents: ScrollText,
  suppliers: Truck,
  balances: Boxes,
}

// How wide each operation opens. The reference sizes every window to what is in
// it: the storages list is narrow, a supply document is as wide as its grid.
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
        <div className="flex h-screen flex-col bg-white">
          <RefTopBar userEmail={session.user.email} onLogout={logout} />

          <RefToolbar>
            <RefStorageBox
              label={t('products:lens.label')}
              editLabel={t('products:refShell.editStorages')}
              onEditStorages={() => openOperation('storages')}
            >
              <select
                className="h-6 w-56 border border-[var(--rule)] bg-white px-1 text-xs outline-none focus:border-[var(--chrome)]"
                value={lensId}
                onChange={(e) => setChosenStorage(e.target.value)}
              >
                {/* ⚠️ Only where widening answers the screen's question. The
                    catalogue and the document list can be asked of the whole
                    salon; a stocktake and a supply cannot — and those are
                    refused from the band rather than resolved quietly. */}
                {lensMayWiden('catalog') && (
                  <option value={ALL_STORAGES}>{t('products:columns.allStorages')}</option>
                )}
                {lensChoices(directories.storages, lensId).length === 0 && (
                  <option value="">{t('products:docs.storageNone')}</option>
                )}
                {lensChoices(directories.storages, lensId).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
                  </option>
                ))}
              </select>
            </RefStorageBox>

            {TOOLBAR_OPERATIONS.map((item) => {
              // 🔴 GREYED WHILE THE LENS IS WIDE, and not because the screen
              // would break — because it would NOT. currentLens resolves «all»
              // to the first live storage on any view that may not widen, so
              // pressing this from a catalogue showing every storage would open
              // a count of a shelf nobody chose. Nothing errors.
              //
              // ⚠️ Greyed rather than hidden: a button that vanishes reads as a
              // missing feature, one that greys says «not from here» — and the
              // picker that ungreys it is in the same band.
              //
              // ✅ And the reference does exactly this: choosing «All storages»
              // greys six of its ten buttons in the same band.
              const blocked = operationBlocked(item, lensId)
              return (
                <RefToolButton
                  key={item}
                  icon={OPERATION_ICON[item]}
                  label={t(`products:secondaryItems.${OPERATION_LABEL_KEY[item]}`)}
                  active={op === item}
                  disabled={blocked}
                  blockedTitle={t('products:lens.pickStorageFirst')}
                  onClick={() => openOperation(item)}
                />
              )
            })}
          </RefToolbar>

          {/* ── The catalogue is the screen, permanently ────────────────
              Not a tab any more. Every operation opens over it and it stays
              readable underneath, which is the reference's own arrangement:
              in its invoices screenshot the tree and the grid headings are
              still legible behind the window. */}
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
          />

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
        </div>
      )}
    </AuthGate>
  )
}
