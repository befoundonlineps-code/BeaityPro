import { useState, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Trash2, Pencil, CheckCircle2 } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { orderPayload, orderRowsFromLines, orderTotal } from '../lib/productOrder'
import { createProductOrder, updateProductOrder, deleteProductOrder } from '../lib/productOrderIO'
import { today, maxDocumentDate } from '../lib/documentDate'
import { supplierChoices } from '../lib/supplierForm'
import { emptyDocumentRow } from '../lib/stockDocumentForm'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const UOMS = ['package', 'portion', 'unit']

// The goods order: a list of what we mean to buy, from whom.
//
// ⚠️ NO STORAGE ON THIS SCREEN, and its absence is the design rather than an
// omission. An order is placed with a supplier, not into a shelf — where the
// goods land is decided when they arrive, on the supply. Putting a storage here
// would be a field nobody could act on, and a second answer to a question the
// lens already owns.
//
// ⚠️ AND NO STATE, NO OUTSTANDING QUANTITY, NO RECONCILIATION. The owner
// settled it: «الطلبية قالب مساعدة، لا التزام كمية». The same order may fill
// two supplies, or none. Everything a fuller design would add exists to answer
// "was this honoured", and nobody is asking.
//
// One screen holding a list and an editor, rather than two. The list is short
// by nature — orders are made and used within a week — and a person who edits
// one wants to see the rest immediately afterwards.
export default function ProductOrderScreen({
  salonId, orders, lines, suppliers, products, loading, error, reload,
}) {
  const { t } = useTranslation(['products', 'common'])

  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState(null)
  const [notice, setNotice] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(null)

  const productsById = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.id, p])), [products]
  )
  const suppliersById = useMemo(
    () => Object.fromEntries((suppliers || []).map((s) => [s.id, s])), [suppliers]
  )

  // ⚠️ Grouped once, here, rather than filtered inside every row. A filter per
  // row is a walk of the whole list per order, which is invisible at ten orders
  // and is the shape that gets noticed at a thousand.
  const linesByOrder = useMemo(() => {
    const grouped = {}
    for (const line of lines || []) {
      if (!grouped[line.order_id]) grouped[line.order_id] = []
      grouped[line.order_id].push(line)
    }
    return grouped
  }, [lines])

  function startNew() {
    setFailure(null)
    setNotice('')
    setEditing({ id: null, supplierId: '', orderDate: today(), note: '', rows: [emptyDocumentRow()] })
  }

  function startEdit(order) {
    setFailure(null)
    setNotice('')
    setEditing({
      id: order.id,
      supplierId: order.supplier_id || '',
      orderDate: order.order_date || today(),
      note: order.note || '',
      // ⚠️ The same translation the supply screen's pre-fill uses. Two ways of
      // turning stored lines into editable rows would be two answers to one
      // question (ADR-053), and this is the one place they could differ
      // invisibly — an editor that drops a field simply saves without it.
      rows: orderRowsFromLines(linesByOrder[order.id] || []),
    })
  }

  const setRow = (index, patch) => setEditing((prev) => ({
    ...prev,
    rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
  }))

  async function save() {
    const { payload, error: validation } = orderPayload(editing, productsById)
    if (validation) { setFailure({ key: validation }); return }

    setSaving(true)
    setFailure(null)
    const result = editing.id
      ? await updateProductOrder({ id: editing.id, ...payload, salonId })
      : await createProductOrder({ ...payload, salonId })
    setSaving(false)

    if (!result.ok) {
      // ⚠️ Three different sentences, because three different things happened.
      // "Could not save" while an order WAS saved sends somebody to make it
      // again; "the lines are gone" is the one a person has to be told rather
      // than discover.
      setFailure({
        key: result.linesLost ? 'products:orders.linesLostError' : 'products:orders.saveFailed',
        error: result.error,
        orphaned: result.orphaned,
      })
      if (result.orphaned || result.linesLost) reload()
      return
    }

    setEditing(null)
    setNotice(t('products:orders.savedNotice'))
    reload()
  }

  async function remove(id) {
    setConfirmingDelete(null)
    setSaving(true)
    const result = await deleteProductOrder(id)
    setSaving(false)
    if (!result.ok) { setFailure({ key: 'products:orders.deleteFailed', error: result.error }); return }
    reload()
  }

  if (loading) return <p className="text-sm text-muted-foreground">{t('common:loading')}</p>

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <p className="font-medium">{t('products:orders.loadFailedTitle')}</p>
        <p className="mt-1 text-muted-foreground">{dbErrorSentence(error, t)}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={reload}>
          {t('products:retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{t('products:orders.title')}</h2>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{t('products:orders.hint')}</p>
        </div>
        {!editing && (
          <Button type="button" onClick={startNew}>
            <Plus className="size-4" />
            {t('products:orders.newButton')}
          </Button>
        )}
      </div>

      {notice && (
        <p className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-sm">
          <CheckCircle2 className="size-4 text-primary" />
          {notice}
        </p>
      )}

      {failure && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p>{t(failure.key)}</p>
          {failure.error && <p className="mt-1 text-muted-foreground">{dbErrorSentence(failure.error, t)}</p>}
          {failure.orphaned && (
            <p className="mt-1 text-muted-foreground">{t('products:orders.orphanedHint')}</p>
          )}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('products:orders.supplierLabel')}</Label>
              <select
                className={FIELD}
                value={editing.supplierId}
                onChange={(e) => setEditing({ ...editing, supplierId: e.target.value })}
              >
                <option value="">{t('products:docs.supplierNone')}</option>
                {supplierChoices(suppliers, editing.supplierId).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.is_active === false ? t('products:archivedOption', { name: s.name }) : s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('products:orders.dateLabel')}</Label>
              <Input
                type="date"
                // The same bound the five document writers share. A day, not an
                // instant, so every hour of today passes and tomorrow does not.
                max={maxDocumentDate()}
                value={editing.orderDate}
                onChange={(e) => setEditing({ ...editing, orderDate: e.target.value })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('products:orders.noteLabel')}</Label>
              <Input
                value={editing.note}
                placeholder={t('products:orders.notePlaceholder')}
                onChange={(e) => setEditing({ ...editing, note: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t('products:orders.linesTitle')}</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditing({ ...editing, rows: [...editing.rows, emptyDocumentRow()] })}
              >
                <Plus className="size-4" />
                {t('products:orders.addLine')}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-2 text-start">{t('products:orders.productColumn')}</th>
                    <th className="w-28 p-2 text-start">{t('products:orders.quantityColumn')}</th>
                    <th className="w-32 p-2 text-start">{t('products:orders.uomColumn')}</th>
                    <th className="w-32 p-2 text-start">{t('products:orders.priceColumn')}</th>
                    <th className="w-12 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {editing.rows.map((row, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <tr key={index} className="border-b border-border/60">
                      <td className="p-2">
                        <select
                          className={FIELD}
                          value={row.productId}
                          onChange={(e) => setRow(index, { productId: e.target.value })}
                        >
                          <option value="">{t('products:orders.productNone')}</option>
                          {(products || []).map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.enteredQuantity}
                          onChange={(e) => setRow(index, { enteredQuantity: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <select
                          className={FIELD}
                          value={row.enteredUom}
                          onChange={(e) => setRow(index, { enteredUom: e.target.value })}
                        >
                          {/* The same keys the document screens use. A second
                              set of labels for the same three frames is how
                              "بالعبوة" becomes two different words. */}
                          {UOMS.map((uom) => (
                            <option key={uom} value={uom}>{t(`products:docs.uom_${uom}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        {/* ⚠️ Optional here and required on a supply. An order is
                            often written before a price is agreed — and an empty
                            box carried across arrives empty, so the supply
                            refuses it rather than stamping a zero cost for good
                            (ADR-051). */}
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={row.enteredUnitPrice}
                          onChange={(e) => setRow(index, { enteredUnitPrice: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          title={t('products:orders.removeLine')}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                          onClick={() => setEditing({
                            ...editing, rows: editing.rows.filter((_, i) => i !== index),
                          })}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" onClick={save} disabled={saving}>
              {t('products:orders.saveButton')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {t('products:orders.cancelButton')}
            </Button>
          </div>
        </div>
      ) : (orders || []).length === 0 ? (
        <div className="rounded-md border border-border p-6 text-center">
          <p className="text-sm font-medium">{t('products:orders.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('products:orders.emptyHint')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-2 text-start">{t('products:orders.dateColumn')}</th>
                <th className="p-2 text-start">{t('products:orders.supplierColumn')}</th>
                <th className="p-2 text-start">{t('products:orders.linesColumn')}</th>
                <th className="p-2 text-start">{t('products:orders.totalColumn')}</th>
                <th className="p-2 text-start">{t('products:orders.noteLabel')}</th>
                <th className="w-24 p-2" />
              </tr>
            </thead>
            <tbody>
              {(orders || []).map((order) => {
                const own = linesByOrder[order.id] || []
                const totals = orderTotal(own)
                const supplier = suppliersById[order.supplier_id]
                return (
                  <tr key={order.id} className="border-b border-border/60">
                    <td className="p-2">{order.order_date}</td>
                    <td className="p-2">{supplier ? supplier.name : '—'}</td>
                    <td className="p-2">{t('products:orders.linesValue', { count: totals.lineCount })}</td>
                    <td className="p-2">
                      {/* ⚠️ Three sentences and not one number. "Nobody has
                          agreed prices" is not the statement "it costs nothing",
                          and a partly priced order has to say which part. */}
                      {totals.total === null
                        ? t('products:orders.totalUnpriced')
                        : t('products:orders.totalPartial', {
                          total: totals.total,
                          priced: totals.pricedLines,
                          count: totals.lineCount,
                        })}
                    </td>
                    <td className="p-2 text-muted-foreground">{order.note || '—'}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title={t('products:orders.editButton')}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                          onClick={() => startEdit(order)}
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          title={t('products:orders.deleteButton')}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                          onClick={() => setConfirmingDelete(order.id)}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ⚠️ ASKED, AND BY THE SCREEN, BECAUSE THE DATABASE WILL NOT. The policy
          allows deleting any order of the salon including one a supply was
          filled from — and with no from_order_id, nothing can even tell that it
          was. There is nowhere else left to put the question. */}
      {confirmingDelete !== null && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="font-medium">{t('products:orders.deleteTitle')}</p>
          <p className="mt-1 text-muted-foreground">{t('products:orders.deleteBody')}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="destructive" onClick={() => remove(confirmingDelete)}>
              {t('products:orders.deleteConfirm')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmingDelete(null)}>
              {t('products:orders.deleteCancel')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

