import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { TriangleAlert } from 'lucide-react'
import { classifyBulkRelease, releaseWindow } from '../lib/bulkRelease'
import { loadReleaseCandidates, markResourceUnitsOut, clearResourceUnitOutages } from '../lib/bulkReleaseIO'
import { reportDbError } from '../lib/dbErrors'
import ReleasePreviewList from './ReleasePreviewList'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// One resource's standing on one day. The simpler twin of the employee
// dialog: a machine is working or it is not — it does not take leave, and it
// does not go on training, so there is no reason list to choose from.
//
// Units get a tickbox each rather than the resource getting one. A room with
// three beds where one broke still has two working beds, and clearing all
// three would cancel sessions that could have gone ahead. Capacity one — the
// common case — renders as a single tickbox and reads exactly like the
// employee dialog.
export default function ResourceDayDialog({
  open, onOpenChange, resource, units, outagesByUnit, dateISO,
  clientsById, servicesById, employeesById, onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])

  const [mode, setMode] = useState('view') // 'view' | 'marking'
  const [pendingUnitIds, setPendingUnitIds] = useState([])
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resourceUnits = useMemo(
    () => (units || []).filter((u) => u.resource_id === resource?.id).sort((a, b) => a.unit_index - b.unit_index),
    [units, resource?.id]
  )

  const isOut = (unitId) =>
    ((outagesByUnit || {})[unitId] || []).some((o) => o.outage_date === dateISO)

  useEffect(() => {
    if (!open) return
    setMode('view')
    setPendingUnitIds([])
    setPlan(null)
    setBusy(false)
    setError('')
  }, [open, resource?.id, dateISO])

  if (!resource) return null

  async function handleUntick(unitId) {
    const next = [...pendingUnitIds, unitId]
    setPendingUnitIds(next)
    setError('')
    setMode('marking')
    setBusy(true)
    const { from, to } = releaseWindow(dateISO, dateISO)
    const target = { kind: 'resourceUnits', unitIds: next }
    const { rows, error: loadError } = await loadReleaseCandidates({ target, from, to })
    setBusy(false)
    if (loadError) {
      setError(t(reportDbError(loadError, 'loadReleaseCandidates')))
      return
    }
    setPlan(classifyBulkRelease({ appointments: rows, target, cutoff: new Date() }))
  }

  async function handleConfirm() {
    if (pendingUnitIds.length === 0) return
    setError('')
    setBusy(true)
    const { from, to } = releaseWindow(dateISO, dateISO)
    const { error: rpcError } = await markResourceUnitsOut({
      unitIds: pendingUnitIds,
      dateISO,
      from,
      to,
    })
    setBusy(false)

    if (rpcError) {
      const message = rpcError.message || ''
      setError(
        message.includes('resource_unit_already_out')
          ? t('appointments:dayStatus.alreadyOutError')
          : message.includes('missing_system_cancellation_reason')
          ? t('appointments:dayStatus.missingSystemReasonError')
          : message.includes('appointment_not_cancellable')
          ? t('appointments:dayStatus.staleError')
          : t(reportDbError(rpcError, 'markResourceUnitsOut'))
      )
      return
    }

    onDone()
    onOpenChange(false)
  }

  async function handleClear(unitId) {
    setError('')
    setBusy(true)
    const { error: deleteError } = await clearResourceUnitOutages({ unitIds: [unitId], dateISO })
    setBusy(false)
    if (deleteError) {
      setError(t(reportDbError(deleteError, 'clearResourceUnitOutages')))
      return
    }
    onDone()
  }

  const affectedCount = plan ? plan.toCancel.length + plan.toRemove.length : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('appointments:dayStatus.resourceTitle', { name: resource.name })}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          {resourceUnits.map((u) => {
            const out = isOut(u.id)
            const pending = pendingUnitIds.includes(u.id)
            return (
              <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={!out && !pending}
                    disabled={busy || out}
                    onChange={(e) => { if (!e.target.checked) handleUntick(u.id) }}
                  />
                  {t('appointments:resourceDialog.unitLabel', { index: u.unit_index })}
                </label>
                {out && (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => handleClear(u.id)}>
                    {t('appointments:dayStatus.clearOutageButton')}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        {mode === 'marking' && (
          <>
            {busy && !plan ? (
              <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
            ) : (
              <ReleasePreviewList
                plan={plan}
                clientsById={clientsById}
                servicesById={servicesById}
                employeesById={employeesById}
              />
            )}

            {affectedCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>{t('appointments:dayStatus.noUndoWarning')}</span>
              </div>
            )}
          </>
        )}

        {error && <div className="text-sm text-destructive">{error}</div>}

        <DialogFooter>
          {mode === 'marking' ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => { setMode('view'); setPendingUnitIds([]); setPlan(null); setError('') }}
              >
                {t('appointments:dayStatus.backButton')}
              </Button>
              <Button variant="destructive" disabled={busy} onClick={handleConfirm}>
                {busy ? t('common:saving') : t('appointments:dayStatus.confirmOutButton')}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:done')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
