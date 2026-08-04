import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { rpcErrorKey } from '../lib/rpcErrors'
import { postStockDocument } from '../lib/stockIO'
import {
  validateSupplyDocument, supplyTotals, supplyDocumentPayload, storageChoices,
} from '../lib/supplyForm'
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

// The supply document: goods arriving from a supplier into a storage.
//
// The first screen in this module that writes a movement rather than a
// definition, so it is the first one whose write goes through an RPC — the
// balance is derived from these rows, and half a document leaves a number that
// is wrong, believable and permanent. Everything it decides before sending is
// in lib/supplyForm.js and lib/stockDocument.js, where it can be tested.
//
// One document at a time, with no list of past ones. The reference has "List of
// invoices" as its own window and it needs paging, filters and a reversal
// action; a half of it bolted here would be the part that looks finished.
export default function SupplyDocumentScreen({
  storages, suppliers, products, loading, salonId, onPosted,
}) {
  const { t } = useTranslation(['products', 'common'])

  const [storageId, setStorageId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [rows, setRows] = useState(() => [emptyRow()])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [postedId, setPostedId] = useState(null)

  // Sets cannot be supplied: a set is assembled from things that were bought,
  // never bought itself, and a movement against one would be a balance of
  // something that does not sit on a shelf.
  const productChoices = useMemo(
    () => (products || []).filter((p) => p.kind !== 'set' && p.is_active !== false),
    [products]
  )
  const productsById = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.id, p])),
    [products]
  )

  const { lineCount, total } = supplyTotals(rows)

  function setRowAt(index, patch) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setPostedId(null)
  }

  // What the product form calls the nominal purchase price, shown beside the
  // cost box rather than typed into it.
  //
  // ⚠️ The column is documented as "the supply document's default", and it is
  // not used as one here on purpose: nothing records whether that number is per
  // package or per base unit, and the two differ by the packaging factor. Put
  // into the box it would be written into a document and stamped onto every
  // issue that follows. Shown beside it, a person reads it and decides — the
  // number is offered without an assumption being spent.
  function nominalHint(row) {
    const product = productsById[row.productId]
    if (!product || product.nominal_purchase_price == null) return undefined
    return t('products:supply.nominalHint', {
      price: Number(product.nominal_purchase_price).toLocaleString('ar'),
    })
  }

  // Which units this product can actually be entered in. A portion needs
  // units_per_portion, and offering it without one is offering a choice
  // stockLine is going to refuse.
  function uomsFor(row) {
    const product = productsById[row.productId]
    if (!product) return UOMS
    return UOMS.filter((uom) => baseUnitsFor(product, uom) !== null)
  }

  async function handlePost() {
    setPostedId(null)

    const { payload, error: buildError } = supplyDocumentPayload(
      { storageId, supplierId, docDate, note, rows }, productsById
    )
    if (buildError) {
      setError(t(buildError))
      return
    }

    setError('')
    setSaving(true)

    const { ok, error: postError, documentId } = await postStockDocument(payload)

    setSaving(false)

    if (!ok) {
      setError(postError
        ? t(rpcErrorKey(postError))
        : t('products:stock.noRowsError'))
      return
    }

    // The document is written and cannot be edited — a movement is a record,
    // not a draft. So the form empties rather than staying filled and inviting
    // a second identical posting.
    setPostedId(documentId)
    setRows([emptyRow()])
    setNote('')
    if (onPosted) onPosted()
  }

  const validationKey = validateSupplyDocument({ storageId, supplierId, docDate })

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('products:supply.hint')}</p>

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('products:supply.storageLabel')}>
          <select className={FIELD} value={storageId}
            onChange={(e) => { setStorageId(e.target.value); setPostedId(null) }}>
            <option value="">{t('products:supply.storageNone')}</option>
            {storageChoices(storages, storageId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label={t('products:supply.supplierLabel')}
          hint={supplierChoices(suppliers, supplierId).length === 0
            ? t('products:supply.supplierEmptyHint')
            : undefined}
        >
          <select className={FIELD} value={supplierId}
            onChange={(e) => { setSupplierId(e.target.value); setPostedId(null) }}>
            <option value="">{t('products:supply.supplierNone')}</option>
            {supplierChoices(suppliers, supplierId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t('products:supply.dateLabel')}>
          <Input type="date" value={docDate}
            onChange={(e) => { setDocDate(e.target.value); setPostedId(null) }} />
        </Field>

        <Field label={t('products:supply.noteLabel')}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t('products:supply.linesTitle')}</h3>
          <span className="text-sm text-muted-foreground">
            {t('products:supply.summary', {
              lines: lineCount,
              total: total.toLocaleString('ar', { maximumFractionDigits: 2 }),
            })}
          </span>
        </div>

        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <Field label={index === 0 ? t('products:supply.productLabel') : undefined}>
              <select className={FIELD} value={row.productId}
                onChange={(e) => setRowAt(index, { productId: e.target.value })}>
                <option value="">{t('products:supply.productNone')}</option>
                {productChoices
                  .filter((p) => p.id === row.productId || !rows.some((r) => r.productId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </Field>

            <Field label={index === 0 ? t('products:supply.quantityLabel') : undefined}>
              <Input type="number" min="0" step="0.001" value={row.enteredQuantity}
                onChange={(e) => setRowAt(index, { enteredQuantity: e.target.value })} />
            </Field>

            <Field label={index === 0 ? t('products:supply.uomLabel') : undefined}>
              <select className={FIELD} value={row.enteredUom}
                onChange={(e) => setRowAt(index, { enteredUom: e.target.value })}>
                {uomsFor(row).map((uom) => (
                  <option key={uom} value={uom}>{t(`products:supply.uom_${uom}`)}</option>
                ))}
              </select>
            </Field>

            <Field
              label={index === 0 ? t('products:supply.unitCostLabel') : undefined}
              hint={nominalHint(row)}
            >
              <Input type="number" min="0" step="0.01" value={row.unitCost}
                onChange={(e) => setRowAt(index, { unitCost: e.target.value })} />
            </Field>

            <Button
              type="button" variant="outline" size="icon" className="size-8"
              title={t('products:supply.rowRemove')}
              disabled={rows.length === 1}
              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}

        <Button
          type="button" variant="outline" size="sm" className="self-start"
          onClick={() => setRows((prev) => [...prev, emptyRow()])}
        >
          <Plus className="size-3.5" />
          {t('products:supply.rowAdd')}
        </Button>
      </div>

      {postedId && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-3 text-sm">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span>{t('products:supply.postedMessage')}</span>
        </div>
      )}

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="flex items-center gap-2">
        <Button disabled={saving || loading || !!validationKey} onClick={handlePost}>
          {saving ? t('common:saving') : t('products:supply.postButton')}
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
