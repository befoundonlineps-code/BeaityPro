import { renderToStaticMarkup } from 'react-dom/server'
import StockDocumentScreen from './StockDocumentScreen'
import { DOC_TYPES, docForm } from '../lib/stockDocumentForm'

// ⚠️ THE FIRST TEST OF THE WIRING, AND IT EXISTS BECAUSE THE WIRING IS WHERE
// THE FAULT WAS. Every check in this project sat at the library layer: the
// money arithmetic was tested for a return, the balance direction was tested
// for a return, and the return screen still drew none of it — because what
// decides whether a box appears is a flag read inside JSX, and no test had ever
// read JSX. A layer with no tests is not a layer with no decisions.
//
// Static markup, not a browser. No hydration, no jsdom, no new dependency: the
// question is which elements the component CHOOSES to emit for a given doc
// type, and the server renderer answers exactly that. What it cannot answer —
// whether the result is legible, whether the columns line up — is the owner's
// eye, and this test does not pretend otherwise.
jest.mock('next-i18next', () => ({
  // The key, returned as itself. Assertions then read as the names in the
  // translation files, and no Arabic enters a test — the same rule the screens
  // follow.
  useTranslation: () => ({ t: (key) => key }),
}))

const PROPS = {
  storages: [{ id: 'st1', name: 'المستودع' }],
  suppliers: [{ id: 'sup1', name: 'المورّد' }],
  products: [{ id: 'p1', name: 'شامبو', base_unit: 'ml', units_per_package: 250 }],
  documents: [],
  loading: false,
  onPosted: () => {},
}

const render = (docType) => renderToStaticMarkup(
  <StockDocumentScreen docType={docType} {...PROPS} />,
)

// The three things this round added, named by the key each one draws.
const MONEY_MARKS = [
  'products:docs.lineDiscountLabel',   // the line's discount
  'products:docs.lineNetLabel',        // the line's computed net
  'products:docs.ladderBase',          // the rung the refusal talks about
  'products:docs.ladderDocumentDiscount',
  'products:docs.ladderTransport',
]

describe('which documents draw money', () => {
  // ⚠️ THE RULE, NOT THE LIST. Asserted over DOC_TYPES against the flag, so a
  // fifth document type is covered the day it is added. A list of two names
  // here would have been just as green while the return screen was empty.
  it.each(DOC_TYPES)('%s draws the money section exactly when it has money', (docType) => {
    const html = render(docType)
    for (const mark of MONEY_MARKS) {
      expect(html.includes(mark)).toBe(docForm(docType).money)
    }
  })

  it.each(DOC_TYPES)('%s offers a payment box exactly when it has a counterparty', (docType) => {
    const html = render(docType)
    const paid = html.includes('products:docs.paidNowLabel')
      || html.includes('products:docs.receivedNowLabel')
    expect(paid).toBe(docForm(docType).supplier !== 'none')
  })
})

describe('the return says how it differs, on the screen and not only in a comment', () => {
  it('names the money as received, never as paid', () => {
    // The column is shared with a supply and the direction is not. A return
    // screen that says "المدفوع الآن" is asking for the opposite of what it
    // will record.
    const html = render('return_to_supplier')
    expect(html).toContain('products:docs.receivedNowLabel')
    expect(html).not.toContain('products:docs.paidNowLabel')
  })

  it('carries the notice that these boxes do not set the cost', () => {
    // The one sentence that stops a real misreading: the discount here changes
    // what the supplier gives back, while the goods leave at the storage
    // average. Without it the screen looks like a supply with a minus sign.
    expect(render('return_to_supplier')).toContain('products:docs.returnMoneyNotice')
  })

  it('names the total as a refund and not as a cost', () => {
    const html = render('return_to_supplier')
    expect(html).toContain('products:docs.ladderNetReturn')
    expect(html).not.toContain('products:docs.ladderNet"')
  })

  it('and a supply says none of those three', () => {
    // Asserted in both directions, because a label that appears everywhere
    // distinguishes nothing.
    const html = render('supply')
    expect(html).toContain('products:docs.paidNowLabel')
    expect(html).not.toContain('products:docs.receivedNowLabel')
    expect(html).not.toContain('products:docs.returnMoneyNotice')
  })
})

describe('the row template matches the row', () => {
  // ⚠️ A grid whose template names fewer columns than the row has children is
  // an error nothing reports: the surplus lands in implicit columns sized by
  // content, so it draws, and only a reader ever notices. This round shipped
  // exactly that — five slots for seven cells — on the screen that "looked
  // right".
  // ⚠️ THE ARITHMETIC, not two numbers. It was written as "7 here, 4 there" and
  // stage 4b made it 8 on a supply — so a correct change failed a test that had
  // to be edited by hand, which is the moment somebody edits it to whatever the
  // code now emits and the guard stops guarding. Stated as a sum of the flags,
  // it re-derives itself and only fails when a cell really has no column.
  it.each(DOC_TYPES)('%s declares one grid column per cell it renders', (docType) => {
    const form = docForm(docType)
    const expected = 4                          // product, quantity, uom, remove
      + (form.money ? 3 : 0)                    // price, discount, net
      + (form.stampsCost ? 1 : 0)               // of which free
    const template = render(docType).match(/sm:grid-cols-\[([^\]]+)\]/)
    expect(template).not.toBeNull()
    expect(template[1].split('_')).toHaveLength(expected)
  })
})

describe('the bonus column belongs to arriving goods only', () => {
  it.each(DOC_TYPES)('%s offers a bonus box exactly when it stamps a cost', (docType) => {
    // Same rule the payload enforces and the function refuses, asserted here so
    // the three cannot drift: a screen offering a box that post_stock_document
    // rejects is a refusal nobody could have predicted from the form.
    expect(render(docType).includes('products:docs.bonusLabel'))
      .toBe(docForm(docType).stampsCost)
  })

  it('sits beside the quantity, not at the end of the row', () => {
    // It is a PART of the quantity. Adjacency says "of which"; a box further
    // along says "and also", and that reading inflates both stock and bill.
    const html = render('supply')
    const at = (key) => html.indexOf(key)
    expect(at('products:docs.quantityLabel')).toBeLessThan(at('products:docs.bonusLabel'))
    expect(at('products:docs.bonusLabel')).toBeLessThan(at('products:docs.uomLabel'))
  })
})

describe('a fresh row carries no refusal', () => {
  // The direction that decides whether the colour means anything. What a
  // REFUSED row shows is decided by lineDisplay and tested where it lives —
  // this screen cannot be typed into without hydration, and a test that
  // re-asserts documentMoney while looking like a screen test is worse than no
  // screen test.
  it.each(DOC_TYPES)('%s renders untouched with nothing in red', (docType) => {
    const html = render(docType)
    expect(html).not.toContain('products:money.')
  })
})

// ==========================================================================
// ⚠️ THE PRE-FILL IS A PER-VARIANT CLAIM ON A SHARED SCREEN, which is the shape
// that produced this file in the first place. One component draws four
// documents, so "the button is there" is four different statements — and the
// return screen proved that three of them can be false while the fourth is
// checked.
//
// Asserted over DOC_TYPES against the rule rather than against a list of names,
// so a fifth document type is covered the day it is added.
// ==========================================================================
const FILL_MARK = 'products:orders.fillFromOrder'

const ORDERS = [{ id: 'o1', supplier_id: 'sup1', order_date: '2020-01-01', note: null }]
const ORDER_LINES = [
  { id: 'l1', order_id: 'o1', product_id: 'p1', entered_quantity: 2, entered_uom: 'package', entered_unit_price: 100, sort_order: 0 },
]

const renderWithOrders = (docType, over = {}) => renderToStaticMarkup(
  <StockDocumentScreen docType={docType} {...PROPS} orders={ORDERS} orderLines={ORDER_LINES} {...over} />,
)

describe('filling a document from an order', () => {
  it.each(DOC_TYPES)('%s offers the pre-fill exactly when it is a supply', (docType) => {
    // An order is a request to BUY. There is nothing to fill a write-off, a
    // return or a transfer from, and a button that appears everywhere and works
    // in one place is read as broken in the other three.
    expect(renderWithOrders(docType).includes(FILL_MARK)).toBe(docType === 'supply')
  })

  it('offers it even when there are no orders yet', () => {
    // ⚠️ Hiding the button until an order exists would hide the feature from
    // everybody who has not used it. The empty case is answered INSIDE the
    // picker, in a sentence, which is a thing somebody can read.
    expect(renderWithOrders('supply', { orders: [], orderLines: [] }).includes(FILL_MARK)).toBe(true)
  })

  it('does not draw the picker or either question until it is asked for', () => {
    // The three states are exclusive, and the two dialogs are the ones that
    // would be alarming to find open on a fresh document.
    const html = renderWithOrders('supply')
    expect(html).not.toContain('products:orders.fillPickTitle')
    expect(html).not.toContain('products:orders.fillReplaceTitle')
    expect(html).not.toContain('products:orders.filledNotice')
  })
})
