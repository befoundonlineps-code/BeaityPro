import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { postStockDocument, transferStock } from '../lib/stockIO'
import {
  validateStockDocument, documentTotals, stockDocumentPayload, storageChoices, docForm,
} from '../lib/stockDocumentForm'
import { today, maxDocumentDate } from '../lib/documentDate'
import { hasSupplier, duplicateDocNumber } from '../lib/documentFilters'
import {
  DISCOUNT_KINDS, PAYMENT_METHODS, TRANSPORT_PAID_TO,
  lineDisplay, supplierBalanceEffect, isOnAccount,
} from '../lib/documentMoney'
import { supplierChoices } from '../lib/supplierForm'
import { baseUnitsFor } from '../lib/stockDocument'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const UOMS = ['package', 'portion', 'unit']

// ⚠️ enteredUnitPrice, not unitCost. The box holds what the invoice says;
// unit_cost is what the goods END UP costing once the line discount, the
// document discount and the freight have landed on them. Two different
// numbers, and neither can be recovered from the other.
const emptyRow = () => ({
  productId: '', enteredQuantity: '', enteredUom: 'package',
  enteredUnitPrice: '', lineDiscountKind: 'percent', lineDiscountValue: '',
  // ⚠️ Blank, never 0. The whole module treats an untouched box as a statement
  // nobody made, and a stored zero here would say "a bonus of nothing" — which
  // is a different row from "no bonus" for anybody counting free goods.
  bonusQuantity: '',
})

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// The stock documents: goods arriving, goods leaving, goods moving.
//
// One screen for four of them, because they differ in three facts — a supplier,
// a price, a second storage — and are identical in everything else. Which facts
// each one carries is decided in lib/stockDocumentForm.js so it can be tested;
// this file reads that answer and draws accordingly.
//
// These are the writes that go through an RPC rather than the client, for the
// reason written in CLAUDE.md: nobody reads a movement, they read a balance
// computed from movements, so half a document leaves a number that is wrong,
// believable and permanent.
//
// One document at a time, with no list of past ones. The reference has "List of
// invoices" as its own window needing paging, filters and a reversal action;
// half of it bolted on here would be the half that looks finished.
export default function StockDocumentScreen({
  docType, storages, suppliers, products, documents, loading, onPosted,
}) {
  const { t } = useTranslation(['products', 'common'])
  const form = docForm(docType)

  const [storageId, setStorageId] = useState('')
  const [toStorageId, setToStorageId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [supplierDocNumber, setSupplierDocNumber] = useState('')
  // ⚠️ Was `new Date().toISOString().slice(0, 10)`, which is UTC. East of
  // Greenwich that is yesterday for the first hours of every day — so a supply
  // entered at 1am in Palestine was dated the day before, silently and looking
  // entirely ordinary in the list. `today()` reads the local calendar.
  const [docDate, setDocDate] = useState(() => today())
  const [note, setNote] = useState('')

  // The document's money. Blank throughout is the ordinary document.
  const [discountKind, setDiscountKind] = useState('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [transportAmount, setTransportAmount] = useState('')
  const [transportPaidTo, setTransportPaidTo] = useState('supplier')
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [rows, setRows] = useState(() => [emptyRow()])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [posted, setPosted] = useState(false)

  // Sets cannot be moved: a set is assembled from things that were bought,
  // never stocked itself, and a movement against one would be a balance of
  // something that does not sit on a shelf.
  const productChoices = useMemo(
    () => (products || []).filter((p) => p.kind !== 'set' && p.is_active !== false),
    [products]
  )
  const productsById = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.id, p])),
    [products]
  )

  // One object, handed to the totals, the validator and the payload alike.
  // The ladder drawn below and the cost that gets stamped must be one
  // computation: unit_cost is permanent, so a disagreement would be too.
  const money = {
    discountKind, discountValue, transportAmount, transportPaidTo,
    paidAmount, paymentMethod,
  }

  const { lineCount, total, ladder } = documentTotals(docType, rows, money)

  // ⚠️ A RETURN IS THE MIRROR OF A SUPPLY, in two ways the screen must say.
  // Its cost comes from the storage average and not from these boxes, so a
  // discount here changes only what the supplier gives back. And the money
  // travels toward us, so "paid" is "received" and the balance goes
  // negative — the supplier owes us.
  const isReturn = docType === 'return_to_supplier'
  const balance = ladder && hasSupplier(docType)
    ? supplierBalanceEffect({
      docType,
      gross: ladder.gross,
      lineDiscounts: ladder.lineDiscounts,
      documentDiscount: ladder.documentDiscount,
      transport: ladder.transport,
      transportPaidTo,
      settledAmount: paidAmount,
    })
    : null

  const cash = (value) => Number(value).toLocaleString('ar', { maximumFractionDigits: 2 })

  function setRowAt(index, patch) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setPosted(false)
  }

  // What the product form calls the nominal purchase price, shown beside the
  // cost box rather than typed into it.
  //
  // ⚠️ The column is documented as this document's default and is deliberately
  // not used as one: nothing records whether that number is per package or per
  // base unit, and the two differ by the packaging factor. In the box it would
  // be written into a document and stamped onto every issue that follows.
  // Beside it, a person reads it and decides — which moves the ambiguity onto a
  // human rather than removing it, and that is recorded as item 31.
  function nominalHint(row) {
    const product = productsById[row.productId]
    if (!product || product.nominal_purchase_price == null) return undefined
    return t('products:docs.nominalHint', {
      price: Number(product.nominal_purchase_price).toLocaleString('ar'),
    })
  }

  // ⚠️ THE SENTENCE THAT STOPS "300" BEING READ AS THE PRICE OF SEVEN. The
  // quantity box says 7, the price box says 50, and the line net says 300 —
  // three numbers that do not multiply together, which is exactly right and looks
  // exactly wrong. So the row says which of the seven were charged for.
  //
  // Only when a bonus was actually typed: an explanation of an absent thing is
  // noise on every ordinary line.
  function bonusHint(row) {
    const received = Number(row.enteredQuantity)
    const bonus = Number(row.bonusQuantity)
    if (!(bonus > 0) || !(received > 0) || bonus > received) return undefined
    return t('products:docs.bonusHint', { paid: received - bonus, received })
  }

  // Which units this product can be entered in. A portion needs
  // units_per_portion, and offering it without one offers a choice the line
  // builder is going to refuse.
  function uomsFor(row) {
    const product = productsById[row.productId]
    if (!product) return UOMS
    return UOMS.filter((uom) => baseUnitsFor(product, uom) !== null)
  }

  async function handlePost() {
    setPosted(false)

    const { payload, error: buildError } = stockDocumentPayload(
      docType,
      { storageId, toStorageId, supplierId, supplierDocNumber, docDate, note, rows, ...money },
      productsById
    )
    if (buildError) {
      setError(t(buildError))
      return
    }

    setError('')
    setSaving(true)

    // Two storages means a different function, not a flag on the same one.
    const { ok, error: postError } = form.twoStorages
      ? await transferStock(payload)
      : await postStockDocument(payload)

    setSaving(false)

    if (!ok) {
      setError(postError
        ? dbErrorSentence(postError, t, `StockDocumentScreen.${docType}`)
        : t('products:stock.noRowsError'))
      return
    }

    // The document is written and cannot be edited — a movement is a record,
    // not a draft. So the lines empty rather than staying filled and inviting a
    // second identical posting. The header stays: the next write-off is usually
    // from the same storage on the same day.
    setPosted(true)
    setRows([emptyRow()])
    setNote('')
    // The money belongs to the document that was just written, not to the
    // next one. Leaving a discount behind would apply it again in silence.
    setDiscountValue('')
    setTransportAmount('')
    setPaidAmount('')
    if (onPosted) onPosted()
  }

  const validationKey = validateStockDocument(docType, {
    storageId, toStorageId, supplierId, docDate,
  })

  // ⚠️ A WARNING, NEVER A REFUSAL. The person is standing at the delivery with
  // the supplier's paper in front of them; if the real number were refused they
  // would type an invented one to get past the box, and the field that exists
  // to match two pieces of paper would hold a fiction. So it names the document
  // that already carries it and leaves the decision where the paper is.
  const duplicate = duplicateDocNumber({
    documents, supplierId, docNumber: supplierDocNumber,
  })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t(`products:docs.${docType}.hint`)}</p>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t(form.twoStorages ? 'products:docs.fromStorageLabel' : 'products:docs.storageLabel')}>
          <select className={FIELD} value={storageId}
            onChange={(e) => { setStorageId(e.target.value); setPosted(false) }}>
            <option value="">{t('products:docs.storageNone')}</option>
            {storageChoices(storages, storageId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
              </option>
            ))}
          </select>
        </Field>

        {form.twoStorages && (
          <Field label={t('products:docs.toStorageLabel')}>
            <select className={FIELD} value={toStorageId}
              onChange={(e) => { setToStorageId(e.target.value); setPosted(false) }}>
              <option value="">{t('products:docs.storageNone')}</option>
              {/* The source is left out of the destination list rather than
                  offered and then refused. The database raises
                  transfer_same_storage either way — measured — but a choice
                  that was always going to fail should not be on the list. */}
              {storageChoices(storages, toStorageId)
                .filter((s) => s.id !== storageId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
                  </option>
                ))}
            </select>
          </Field>
        )}

        {form.supplier !== 'none' && (
          <Field
            label={t('products:docs.supplierLabel')}
            hint={supplierChoices(suppliers, supplierId).length === 0
              ? t('products:docs.supplierEmptyHint')
              : undefined}
          >
            <select className={FIELD} value={supplierId}
              onChange={(e) => { setSupplierId(e.target.value); setPosted(false) }}>
              <option value="">{t('products:docs.supplierNone')}</option>
              {supplierChoices(suppliers, supplierId).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {/* ⚠️ Only where there is a counterparty outside the salon, which is
            the same two types the supplier filter applies to — they are one
            fact seen twice. A transfer moves between our own storages and has
            no invoice to copy a number from. */}
        {hasSupplier(docType) && (
          <Field
            label={t('products:docs.supplierDocNumberLabel')}
            hint={duplicate
              ? t('products:docs.supplierDocNumberDuplicateHint', {
                date: String(duplicate.doc_date || '').slice(0, 10),
              })
              : t('products:docs.supplierDocNumberHint')}
          >
            {/* Never auto-filled: suggesting the next number would invent a
                reference in a ledger we cannot see. Blank means "no paper",
                and blank is sent as null rather than ''. */}
            <Input value={supplierDocNumber}
              onChange={(e) => { setSupplierDocNumber(e.target.value); setPosted(false) }} />
          </Field>
        )}

        <Field label={t('products:docs.dateLabel')}>
          {/* ⚠️ `max` AND the validation, not either alone. The attribute makes
              the picker refuse to walk past today, which is the kind way; but
              it is a hint the browser may not honour and a typed or pasted
              value can walk straight through it. The sentence beside the field
              is the guard — see documentDateError. */}
          <Input type="date" value={docDate} max={maxDocumentDate()}
            onChange={(e) => { setDocDate(e.target.value); setPosted(false) }} />
        </Field>

        <Field label={t('products:docs.noteLabel')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('products:docs.linesTitle')}</h3>
          <span className="text-sm text-muted-foreground">
            {/* No money for a document that has no prices: an issue's cost is
                the average at that instant, which only the function knows, and
                "0 ₪" would be a claim about it. */}
            {total === null
              ? t('products:docs.summaryLinesOnly', { lines: lineCount })
              : t('products:docs.summary', {
                  lines: lineCount,
                  total: total.toLocaleString('ar', { maximumFractionDigits: 2 }),
                })}
          </span>
        </div>

        {rows.map((row, index) => (
          // ⚠️ ONE SLOT PER CELL, and the count moves with the flags — four
          // always, three more where there is money, one more where goods
          // arrive. It was written as a fixed five while the row had seven:
          // grid silently invents implicit columns for the surplus and sizes
          // them by content, so it LOOKS drawn while the widths nobody wrote
          // are the ones in charge. A template shorter than its row is not an
          // error anywhere; it is only ever visible to a reader.
          <div key={index}
            className={`grid grid-cols-1 items-end gap-2 ${
              form.stampsCost
                // Eight: the bonus column only exists where goods arrive.
                ? 'sm:grid-cols-[1.5fr_0.7fr_0.7fr_0.8fr_0.9fr_1.2fr_1.1fr_auto]'
                : form.money
                  ? 'sm:grid-cols-[1.6fr_0.7fr_0.9fr_0.9fr_1.3fr_1.1fr_auto]'
                  : 'sm:grid-cols-[2fr_1fr_1fr_auto]'
            }`}>
            <Field label={index === 0 ? t('products:docs.productLabel') : undefined}>
              <select className={FIELD} value={row.productId}
                onChange={(e) => setRowAt(index, { productId: e.target.value })}>
                <option value="">{t('products:docs.productNone')}</option>
                {productChoices
                  .filter((p) => p.id === row.productId || !rows.some((r) => r.productId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </Field>

            <Field label={index === 0 ? t('products:docs.quantityLabel') : undefined}>
              <Input type="number" min="0" step="0.001" value={row.enteredQuantity}
                onChange={(e) => setRowAt(index, { enteredQuantity: e.target.value })} />
            </Field>

            {/* ⚠️ NEXT TO THE QUANTITY, because it is a PART of it and not an
                addition to it. Adjacency says "of which"; a box further along
                the row would read as "and also". The label carries the same
                word — «منها مجّاني» — so the two readings cannot diverge.

                Only where goods arrive: free goods come in, they do not go
                out. A return crediting less than was sent is a document
                discount, which the ladder below already has. */}
            {form.stampsCost && (
              <Field
                label={index === 0 ? t('products:docs.bonusLabel') : undefined}
                hint={bonusHint(row)}
              >
                <Input type="number" min="0" step="0.001" value={row.bonusQuantity}
                  onChange={(e) => setRowAt(index, { bonusQuantity: e.target.value })} />
              </Field>
            )}

            <Field label={index === 0 ? t('products:docs.uomLabel') : undefined}>
              <select className={FIELD} value={row.enteredUom}
                onChange={(e) => setRowAt(index, { enteredUom: e.target.value })}>
                {uomsFor(row).map((uom) => (
                  <option key={uom} value={uom}>{t(`products:docs.uom_${uom}`)}</option>
                ))}
              </select>
            </Field>

            {form.money && (
              <>
                {/* ⚠️ The label names the unit it is priced in, derived from
                    this row's own UoM. "تكلفة الوحدة" named no unit while the
                    quantity two centimetres away named both — item 35. */}
                <Field
                  label={index === 0
                    ? t(`products:docs.priceFor_${row.enteredUom || 'package'}`)
                    : undefined}
                  hint={nominalHint(row)}
                >
                  <Input type="number" min="0" step="0.01" value={row.enteredUnitPrice}
                    onChange={(e) => setRowAt(index, { enteredUnitPrice: e.target.value })} />
                </Field>

                <Field label={index === 0 ? t('products:docs.lineDiscountLabel') : undefined}>
                  <div className="flex gap-1">
                    <Input type="number" min="0" step="0.01" className="w-20"
                      value={row.lineDiscountValue}
                      onChange={(e) => setRowAt(index, { lineDiscountValue: e.target.value })} />
                    <select className={FIELD + ' w-16'} value={row.lineDiscountKind}
                      onChange={(e) => setRowAt(index, { lineDiscountKind: e.target.value })}>
                      {DISCOUNT_KINDS.map((k) => (
                        <option key={k} value={k}>{t(`products:docs.discountKind_${k}`)}</option>
                      ))}
                    </select>
                  </div>
                </Field>

                {/* ⚠️ COMPUTED, never typed, and never stored either: a third
                    saved number is a third thing that can disagree with the
                    two it came from.

                    Two figures rather than one, because a percentage comes off
                    the PRICE and a fixed amount comes off the LINE — so a
                    single number called "the price after discount" would be
                    right in one case and wrong in the other. */}
                {/* ⚠️ NOTHING IS SHOWN WHILE THE LINE IS REFUSED, and that is
                    the point rather than tidiness. A bonus of 8 on 7 gives a
                    net of −50 and a per-unit of −7.14 — two figures that are
                    arithmetically honest about an input the document will not
                    accept, sitting on screen looking like results. The owner
                    watched them appear with nothing to explain them.

                    And a negative net is not a display problem: it is this
                    line's WEIGHT in the split, so it drags the other lines'
                    shares of the discount and the freight with it. The figure
                    is withheld because the document it describes cannot
                    exist. */}
                <Field label={index === 0 ? t('products:docs.lineNetLabel') : undefined}>
                  <div className="flex h-8 flex-col justify-center">
                    <span className="text-sm font-medium">
                      {lineDisplay(row).net === null ? '—' : `${cash(lineDisplay(row).net)} ₪`}
                    </span>
                    {lineDisplay(row).perUnit !== null && (
                      <span className="text-[11px] text-muted-foreground">
                        {t(`products:docs.netPerUnit_${row.enteredUom || 'package'}`, {
                          price: cash(lineDisplay(row).perUnit),
                        })}
                      </span>
                    )}
                  </div>
                </Field>
              </>
            )}

            <Button
              type="button" variant="outline" size="icon" className="size-8"
              title={t('products:docs.rowRemove')}
              disabled={rows.length === 1}
              onClick={() => { setRows((prev) => prev.filter((_, i) => i !== index)); setPosted(false) }}
            >
              <Trash2 className="size-3.5" />
            </Button>

            {/* ⚠️ AT THE ROW, WHILE TYPING, and not only at the save. The
                save-time refusal stays — it is the layer that actually protects
                the ledger, and it must, because a row can be made invalid by a
                path no keystroke passes through. This one exists so the reader
                is never looking at a number nobody will accept without being
                told which box made it so.

                Full width rather than inside a cell: the sentence is about the
                line, and both sentences it can carry name two boxes at once
                (the bonus against the quantity, the discount against the
                line).

                ⚠️ And only once the row has produced a figure. Typing the
                bonus before the quantity leaves the two nothing to be compared
                against, and a half-filled row that argues with itself teaches
                people to ignore the colour. lineNet is null exactly then, and
                the save-time refusal still covers it — which is the layer that
                has to. */}
            {lineDisplay(row).error && (
              <p className="col-span-full text-xs text-destructive">
                {t(lineDisplay(row).error)}
              </p>
            )}
          </div>
        ))}

        <Button
          type="button" variant="outline" size="sm" className="self-start"
          onClick={() => { setRows((prev) => [...prev, emptyRow()]); setPosted(false) }}
        >
          <Plus className="size-3.5" />
          {t('products:docs.rowAdd')}
        </Button>
      </div>


      {/* ⚠️ A LADDER, NOT A TOTAL. Every rung is named because the third one
          is the figure a refusal talks about: "the discount is bigger than
          the total" is unhelpful when four different totals are on screen.
          It is also the number the split divides by, so the check and the
          arithmetic are visibly the same quantity. */}
      {ladder && (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <h3 className="text-sm font-semibold">{t('products:docs.moneyTitle')}</h3>

          {isReturn && (
            <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
              {t('products:docs.returnMoneyNotice')}
            </p>
          )}

          <dl className="flex flex-col gap-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('products:docs.ladderGross')}</dt>
              <dd>{cash(ladder.gross)} ₪</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('products:docs.ladderLineDiscounts')}</dt>
              <dd>− {cash(ladder.lineDiscounts)} ₪</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-1 font-medium">
              <dt>{t('products:docs.ladderBase')}</dt>
              <dd>{cash(ladder.gross - ladder.lineDiscounts)} ₪</dd>
            </div>

            <div className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-muted-foreground">
                {t('products:docs.ladderDocumentDiscount')}
                <Input type="number" min="0" step="0.01" className="h-7 w-20"
                  value={discountValue}
                  onChange={(e) => { setDiscountValue(e.target.value); setPosted(false) }} />
                <select className={FIELD + ' h-7 w-16'} value={discountKind}
                  onChange={(e) => setDiscountKind(e.target.value)}>
                  {DISCOUNT_KINDS.map((k) => (
                    <option key={k} value={k}>{t(`products:docs.discountKind_${k}`)}</option>
                  ))}
                </select>
              </dt>
              <dd>− {cash(ladder.documentDiscount)} ₪</dd>
            </div>

            <div className="flex items-center justify-between gap-4">
              <dt className="flex flex-wrap items-center gap-2 text-muted-foreground">
                {t('products:docs.ladderTransport')}
                <Input type="number" min="0" step="0.01" className="h-7 w-20"
                  value={transportAmount}
                  onChange={(e) => { setTransportAmount(e.target.value); setPosted(false) }} />
                <select className={FIELD + ' h-7 w-32'} value={transportPaidTo}
                  onChange={(e) => setTransportPaidTo(e.target.value)}>
                  {TRANSPORT_PAID_TO.map((k) => (
                    <option key={k} value={k}>{t(`products:docs.transportPaidTo_${k}`)}</option>
                  ))}
                </select>
              </dt>
              <dd>+ {cash(ladder.transport)} ₪</dd>
            </div>

            <div className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
              <dt>{t(isReturn ? 'products:docs.ladderNetReturn' : 'products:docs.ladderNet')}</dt>
              <dd>{cash(ladder.net)} ₪</dd>
            </div>
          </dl>

          {/* ⚠️ "على الحساب" IS A BUTTON HERE AND NOT A VALUE THERE. Choosing
              it stores zero and no method, so a part-cash part-deferred
              document stays describable — which one four-valued column could
              not do. */}
          {hasSupplier(docType) && (
            <div className="flex flex-col gap-2 border-t border-border pt-2">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {t(isReturn ? 'products:docs.receivedNowLabel' : 'products:docs.paidNowLabel')}
                  <Input type="number" min="0" step="0.01" className="h-8 w-28"
                    value={paidAmount}
                    onChange={(e) => { setPaidAmount(e.target.value); setPosted(false) }} />
                </label>

                {Number(paidAmount) > 0 && (
                  <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {t('products:docs.paymentMethodLabel')}
                    <select className={FIELD + ' h-8 w-32'} value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}>
                      {PAYMENT_METHODS.map((k) => (
                        <option key={k} value={k}>{t(`products:docs.paymentMethod_${k}`)}</option>
                      ))}
                    </select>
                  </label>
                )}

                <Button type="button" variant="outline" size="sm"
                  onClick={() => { setPaidAmount(''); setPosted(false) }}>
                  {t('products:docs.wholeOnAccount')}
                </Button>
              </div>

              {balance !== null && (
                <p className="text-sm">
                  {isOnAccount(balance)
                    ? t(balance > 0 ? 'products:docs.owedToSupplier' : 'products:docs.owedBySupplier',
                      { paid: cash(paidAmount || 0), rest: cash(Math.abs(balance)) })
                    : t('products:docs.settled')}
                </p>
              )}

              {/* ⚠️ A figure that excludes something says what it excluded.
                  Freight paid to a carrier is a real cost and is owed to
                  nobody we track, so it is in unit_cost and not in this. */}
              {transportPaidTo === 'carrier' && Number(transportAmount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('products:docs.carrierNotInBalance')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {posted && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{t(`products:docs.${docType}.posted`)}</span>
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <Button disabled={saving || loading || !!validationKey} onClick={handlePost}>
          {saving ? t('common:saving') : t(`products:docs.${docType}.postButton`)}
        </Button>
        {/* The button says what is missing rather than sitting greyed out with
            no reason — a disabled control that will not say why is a dead end. */}
        {validationKey && (
          <span className="text-xs text-muted-foreground">{t(validationKey)}</span>
        )}
      </div>
    </div>
  )
}
