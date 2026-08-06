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
  it('declares one column per cell on a priced row', () => {
    const html = render('supply')
    const template = html.match(/sm:grid-cols-\[([^\]]+)\]/)
    expect(template).not.toBeNull()
    expect(template[1].split('_')).toHaveLength(7)
  })

  it('declares one column per cell on an unpriced row', () => {
    const template = render('write_off').match(/sm:grid-cols-\[([^\]]+)\]/)
    expect(template[1].split('_')).toHaveLength(4)
  })
})
