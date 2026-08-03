import { useState, useMemo, useEffect, Fragment } from 'react'
import { useTranslation } from 'next-i18next'
import { reportDbError } from '../lib/dbErrors'
import { saveServicePrices } from '../lib/servicePricingIO'
import {
  PRICING_COLUMNS,
  buildPricingMatrix,
  filterPricingMatrix,
  changedPrices,
} from '../lib/servicePricingMatrix'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// One editable cell per service, in the column of the role that performs it.
//
// The other six are drawn and left dead. That is the whole point of the
// screen: a service has one price, and the grid says who charges it rather
// than offering seven prices to fill in. Cells are not inputs at all when
// they are not the one — a disabled input still invites a click.
function PriceCell({ isTheColumn, value, onChange }) {
  if (!isTheColumn) return <td className="border border-border bg-muted/40" />

  return (
    <td className="border border-border p-0">
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full bg-transparent px-2 text-center text-sm tabular-nums outline-none focus:bg-primary/5"
      />
    </td>
  )
}

export default function SetPricesDialog({ open, onOpenChange, categories, services, onSaved }) {
  const { t } = useTranslation(['services', 'employees', 'common'])
  const [search, setSearch] = useState('')
  const [edits, setEdits] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Every open starts from what is stored. Carrying edits across a close
  // would show numbers that are not in the database as though they were.
  useEffect(() => {
    if (!open) return
    setSearch('')
    setEdits({})
    setError('')
  }, [open])

  const matrix = useMemo(
    () => buildPricingMatrix({ categories, services }),
    [categories, services]
  )
  const shown = useMemo(() => filterPricingMatrix(matrix, search), [matrix, search])

  const pending = changedPrices(matrix, edits)

  async function handleSave() {
    if (pending.length === 0) {
      onOpenChange(false)
      return
    }
    setSaving(true)
    setError('')

    const { error: saveError } = await saveServicePrices(pending)
    if (saveError) {
      setSaving(false)
      setError(t(reportDbError(saveError, 'SetPricesDialog.save')))
      // Whatever got through stays written; reloading shows the caller which
      // rows moved rather than leaving the dialog claiming none did.
      onSaved()
      return
    }

    setSaving(false)
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* flex column, not the grid DialogContent defaults to: a grid row
          sizes to its content, and this table is hundreds of rows tall — the
          footer would sit below the clip with nothing to scroll. */}
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[calc(100%-2rem)] lg:max-w-[1300px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('services:setPrices.title')}</DialogTitle>
        </DialogHeader>

        <div className="flex shrink-0 flex-col gap-2">
          {/* Shape only for now, by agreement — a bulk rise across a whole
              catalogue is its own decision about rounding and scope. */}
          <Button variant="outline" className="w-full" disabled>
            {t('services:setPrices.increaseButton')}
          </Button>
          <Input
            placeholder={t('services:setPrices.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr>
                <th className="border border-border px-2 py-1.5 text-start font-medium">
                  {t('services:setPrices.nameColumn')}
                </th>
                {PRICING_COLUMNS.map((role) => (
                  <th
                    key={role}
                    className="w-28 border border-border px-2 py-1.5 text-center text-xs font-medium"
                  >
                    {t(`employees:roles.${role}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((group) => (
                // Fragment by name, not <>: a keyed group needs somewhere to
                // put the key, and the shorthand has nowhere.
                <Fragment key={group.root.id}>
                  {/* The root category's own colour, the same one the tree
                      draws it with, so a heading here and a folder there are
                      recognisably the same thing. */}
                  <tr style={{ background: `${group.root.color || '#94a3b8'}22` }}>
                    <td
                      className="border border-border px-2 py-1.5 font-medium"
                      colSpan={PRICING_COLUMNS.length + 1}
                    >
                      {group.root.name}
                    </td>
                  </tr>
                  {group.rows.map(({ service, role }) => (
                    <tr key={service.id} className="hover:bg-muted/40">
                      <td className="border border-border px-2 py-1">
                        <span className="block truncate">{service.name}</span>
                      </td>
                      {PRICING_COLUMNS.map((column) => (
                        <PriceCell
                          key={column}
                          isTheColumn={column === role}
                          value={
                            Object.prototype.hasOwnProperty.call(edits, service.id)
                              ? edits[service.id]
                              : String(service.price ?? '')
                          }
                          onChange={(next) => setEdits((prev) => ({ ...prev, [service.id]: next }))}
                        />
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>

          {shown.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {search.trim() ? t('common:noResults') : t('services:setPrices.emptyHint')}
            </div>
          )}
        </div>

        {error && <div className="shrink-0 text-sm text-destructive">{error}</div>}

        <DialogFooter className="shrink-0">
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving
              ? t('common:saving')
              : t('services:setPrices.saveButton', { count: pending.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
