import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { postStockDocument, transferStock } from '../lib/stockIO'
import {
  validateStockDocument, documentTotals, stockDocumentPayload, storageChoices, docForm,
} from '../lib/stockDocumentForm'
import { today, maxDocumentDate } from '../lib/documentDate'
import { supplierChoices } from '../lib/supplierForm'
import { baseUnitsFor } from '../lib/stockDocument'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const UOMS = ['package', 'portion', 'unit']

const emptyRow = () => ({ productId: '', enteredQuantity: '', enteredUom: 'package', unitCost: '' })

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
  docType, storages, suppliers, products, loading, onPosted,
}) {
  const { t } = useTranslation(['products', 'common'])
  const form = docForm(docType)

  const [storageId, setStorageId] = useState('')
  const [toStorageId, setToStorageId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  // ⚠️ Was `new Date().toISOString().slice(0, 10)`, which is UTC. East of
  // Greenwich that is yesterday for the first hours of every day — so a supply
  // entered at 1am in Palestine was dated the day before, silently and looking
  // entirely ordinary in the list. `today()` reads the local calendar.
  const [docDate, setDocDate] = useState(() => today())
  const [note, setNote] = useState('')
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

  const { lineCount, total } = documentTotals(docType, rows)

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
      docType, { storageId, toStorageId, supplierId, docDate, note, rows }, productsById
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
    if (onPosted) onPosted()
  }

  const validationKey = validateStockDocument(docType, {
    storageId, toStorageId, supplierId, docDate,
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
          <div key={index}
            className={`grid grid-cols-1 items-end gap-2 ${
              form.cost ? 'sm:grid-cols-[2fr_1fr_1fr_1fr_auto]' : 'sm:grid-cols-[2fr_1fr_1fr_auto]'
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

            <Field label={index === 0 ? t('products:docs.uomLabel') : undefined}>
              <select className={FIELD} value={row.enteredUom}
                onChange={(e) => setRowAt(index, { enteredUom: e.target.value })}>
                {uomsFor(row).map((uom) => (
                  <option key={uom} value={uom}>{t(`products:docs.uom_${uom}`)}</option>
                ))}
              </select>
            </Field>

            {form.cost && (
              <Field
                label={index === 0 ? t('products:docs.unitCostLabel') : undefined}
                hint={nominalHint(row)}
              >
                <Input type="number" min="0" step="0.01" value={row.unitCost}
                  onChange={(e) => setRowAt(index, { unitCost: e.target.value })} />
              </Field>
            )}

            <Button
              type="button" variant="outline" size="icon" className="size-8"
              title={t('products:docs.rowRemove')}
              disabled={rows.length === 1}
              onClick={() => { setRows((prev) => prev.filter((_, i) => i !== index)); setPosted(false) }}
            >
              <Trash2 className="size-3.5" />
            </Button>
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
