import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, Undo2, ChevronDown, ChevronLeft } from 'lucide-react'
import { dbErrorSentence } from '../lib/dbErrors'
import { reverseStockDocument } from '../lib/stockIO'
import {
  sortDocuments, movementsOf, movementFrames, reversalState,
} from '../lib/stockDocumentList'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

// The documents that have been posted, newest first, and one thing to do with
// them: undo one.
//
// ⚠️ This is a condition of the module being usable, not a convenience. Without
// it a document posted wrongly is permanent and invisible, and somebody who
// cannot correct a mistake works around it — a fake issue to cancel it out,
// which corrupts the ledger, or a hand-edited row, which corrupts the principle
// the whole module rests on. Two documents were already posted with a zero cost
// before the screen that could undo them existed.
//
// Narrow on purpose: no paging, no filters, no search. Those arrive when the
// number of documents asks for them. Reversal was needed with the first wrong
// one.
export default function StockDocumentsList({
  documents, movements, products, storages, suppliers, loading, error, reload,
}) {
  const { t } = useTranslation(['products', 'common'])
  const [expanded, setExpanded] = useState(() => new Set())
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  const rows = sortDocuments(documents)
  const productsById = Object.fromEntries((products || []).map((p) => [p.id, p]))
  const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || '—'

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function confirmReverse() {
    if (!confirming) return
    setBusy(true)
    setActionError('')
    const { ok, error: rpcError } = await reverseStockDocument({ documentId: confirming.id })
    setBusy(false)
    if (!ok) {
      setActionError(rpcError
        ? dbErrorSentence(rpcError, t, 'StockDocumentsList.reverse')
        : t('products:stock.noRowsError'))
      return
    }
    setConfirming(null)
    reload()
  }

  // ⚠️ Unit first, number second — every quantity, everywhere.
  //
  // "5 عبوات" versus "5 عبوة" is a grammar branch we refuse to have, so the
  // number never governs the word after it (CLAUDE.md). And both frames are
  // shown because neither alone is honest: the person who typed 5 does not
  // recognise 75, and 5 cannot be added to a line entered in pieces.
  function quantityText(movement) {
    const product = productsById[movement.product_id]
    const f = movementFrames(movement, product)
    const baseText = t('products:documents.inBase', {
      unit: t(`products:units.${f.baseUnit || 'pcs'}`),
      n: f.base,
    })
    if (f.entered === null || f.sameFrame) return baseText
    return `${t('products:documents.inEntered', {
      uom: t(`products:docs.uom_${f.uom}`), n: f.entered,
    })} · ${baseText}`
  }

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">{t('products:loadFailedTitle')}</span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'StockDocumentsList.load')}
          </span>
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">{t('products:documents.hint')}</p>

      {actionError && <div className="text-sm text-destructive">{actionError}</div>}

      {rows.length === 0 ? (
        <div className="flex flex-col gap-1 py-10 text-center text-sm text-muted-foreground">
          <span>{t('products:documents.emptyTitle')}</span>
          <span className="text-xs">{t('products:documents.emptyHint')}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((doc) => {
            const lines = movementsOf(movements, doc.id)
            const state = reversalState(doc, documents)
            const isOpen = expanded.has(doc.id)

            return (
              <div key={doc.id} className="rounded-xl border border-border">
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                    onClick={() => toggle(doc.id)}
                  >
                    {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronLeft className="size-4 shrink-0" />}
                    <span className="font-medium">{t(`products:docs.${doc.doc_type}.title`)}</span>
                    <span className="text-sm text-muted-foreground">{doc.doc_date}</span>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      {doc.to_storage_id
                        ? t('products:documents.fromStorage', { name: nameOf(storages, doc.storage_id) })
                        : nameOf(storages, doc.storage_id)}
                    </Badge>
                    {doc.to_storage_id && (
                      <Badge variant="secondary">
                        {t('products:documents.toStorage', { name: nameOf(storages, doc.to_storage_id) })}
                      </Badge>
                    )}
                    {doc.supplier_id && <Badge variant="outline">{nameOf(suppliers, doc.supplier_id)}</Badge>}
                    <Badge variant="outline">
                      {t('products:documents.lineCount', { n: lines.length })}
                    </Badge>
                    {state.reason === 'alreadyReversed' && (
                      <Badge variant="outline">{t('products:documents.reversedBadge')}</Badge>
                    )}
                    {state.reason === 'isReversal' && (
                      <Badge variant="outline">{t('products:documents.isReversalBadge')}</Badge>
                    )}
                  </div>

                  {/* One action, and it is not offered twice: a document
                      already undone would swing the balance the other way. */}
                  <Button
                    type="button" variant="outline" size="sm"
                    disabled={!state.canReverse || busy}
                    onClick={() => { setConfirming(doc); setActionError('') }}
                  >
                    <Undo2 className="size-3.5" />
                    {t('products:documents.reverseButton')}
                  </Button>
                </div>

                {isOpen && (
                  <div className="border-t border-border/60 p-3">
                    {doc.note && (
                      <p className="mb-2 text-sm text-muted-foreground">{doc.note}</p>
                    )}
                    <table className="w-full text-sm">
                      <tbody>
                        {lines.map((m) => (
                          <tr key={m.id} className="border-b border-border/40 last:border-0">
                            <td className="py-1.5">{productsById[m.product_id]?.name || '—'}</td>
                            <td className="py-1.5 text-muted-foreground">
                              {nameOf(storages, m.storage_id)}
                            </td>
                            {/* ⚠️ Direction on every line, as a word. Without
                                it a write-off line reads exactly like a supply
                                line, and a reversal — whose lines are the
                                exact opposite of the document it undoes, shown
                                right beside it — reads as a copy of the
                                mistake rather than its correction. A word and
                                not a sign, because a minus inside an Arabic
                                line is a neutral character between two
                                directions. */}
                            <td className="py-1.5">
                              {movementFrames(m, productsById[m.product_id]).direction && (
                                <Badge
                                  variant={movementFrames(m, productsById[m.product_id]).direction === 'in'
                                    ? 'secondary' : 'outline'}
                                >
                                  {t(`products:documents.direction_${movementFrames(m, productsById[m.product_id]).direction}`)}
                                </Badge>
                              )}
                            </td>
                            <td className="py-1.5">{quantityText(m)}</td>
                            <td className="py-1.5 text-muted-foreground">
                              {/* A stamped cost of zero is a real number here,
                                  not a blank — and it is exactly what the two
                                  bad documents carry. */}
                              {m.unit_cost === null || m.unit_cost === undefined
                                ? '—'
                                : t('products:documents.unitCost', {
                                    price: Number(m.unit_cost).toLocaleString('ar', { maximumFractionDigits: 4 }),
                                  })}
                            </td>
                          </tr>
                        ))}
                        {lines.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-3 text-center text-muted-foreground">
                              {t('products:documents.noLines')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={!!confirming} onOpenChange={(o) => { if (!o) { setConfirming(null); setActionError('') } }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('products:documents.reverseTitle')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-2 text-sm">
            {/* The document is named, because "undo" with nothing beside it is
                a button somebody presses on the wrong row.
                ⚠️ Two elements, not one joined string. A date is a run of EN
                digits, and joining it to Arabic with a neutral dash is the
                shape lib/timeRangeDirection.test.js exists to stop — the dash
                takes the paragraph direction and the halves swap on screen
                while the DOM stays correct. Separate nodes have no pair to
                reorder. */}
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {confirming && <span>{t(`products:docs.${confirming.doc_type}.title`)}</span>}
              {confirming && <span className="text-muted-foreground">{confirming.doc_date}</span>}
            </p>
            <p className="text-muted-foreground">{t('products:documents.reverseMessage')}</p>
            {actionError && <div className="text-destructive">{actionError}</div>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirming(null); setActionError('') }}>
              {t('common:discard')}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmReverse}>
              {busy ? t('common:saving') : t('products:documents.reverseConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
