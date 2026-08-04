import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Pencil, TriangleAlert } from 'lucide-react'
import { classifyBulkRelease, releaseWindow } from '../lib/bulkRelease'
import { loadReleaseCandidates, markEmployeeAbsent, clearEmployeeAbsence } from '../lib/bulkReleaseIO'
import { reportDbError } from '../lib/dbErrors'
import { reportRpcError } from '../lib/rpcErrors'
import ReleasePreviewList from './ReleasePreviewList'
import ReasonManagerDialog from './ReasonManagerDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

// One professional's standing on one day, reached by clicking their column
// header — the calendar itself is the entry point, so nothing has to be
// picked twice: the header knows whose column it is, and the calendar knows
// which day is on screen.
//
// It replaced a standalone three-stage dialog that asked for the employee,
// the date range and the reason before it would show anything. That dialog
// was correct and nobody wanted to use it. This one asks a single question —
// is she in today? — and only unfolds when the answer is no.
export default function EmployeeDayDialog({
  open, onOpenChange, employee, dateISO, absence,
  absenceReasons, absenceReasonsLoading, reloadAbsenceReasons, salonId,
  clientsById, servicesById, employeesById, onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])

  const [mode, setMode] = useState('view') // 'view' | 'marking'
  const [reasonId, setReasonId] = useState('')
  const [reasonManagerOpen, setReasonManagerOpen] = useState(false)
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeReasons = useMemo(
    () => (absenceReasons || []).filter((r) => r.is_active),
    [absenceReasons]
  )

  useEffect(() => {
    if (!open) return
    setMode('view')
    setReasonId('')
    setPlan(null)
    setBusy(false)
    setError('')
  }, [open, employee?.id, dateISO])

  if (!employee) return null

  const reasonName = absence
    ? (absenceReasons || []).find((r) => r.id === absence.absence_reason_id)?.name || ''
    : ''

  // Unticking is where the work is: the bookings have to be looked at before
  // anything is promised, so the list loads the moment the box comes off.
  async function handleUntick() {
    setError('')
    setMode('marking')
    setBusy(true)
    const { from, to } = releaseWindow(dateISO, dateISO)
    const { rows, error: loadError } = await loadReleaseCandidates({
      target: { kind: 'employee', employeeId: employee.id },
      from,
      to,
    })
    setBusy(false)
    if (loadError) {
      setError(t(reportDbError(loadError, 'loadReleaseCandidates')))
      return
    }
    setPlan(classifyBulkRelease({
      appointments: rows,
      target: { kind: 'employee', employeeId: employee.id },
      cutoff: new Date(),
    }))
  }

  async function handleConfirm() {
    if (!reasonId) return
    setError('')
    setBusy(true)
    const { from, to } = releaseWindow(dateISO, dateISO)
    const { error: rpcError } = await markEmployeeAbsent({
      employeeId: employee.id,
      dateISO,
      absenceReasonId: reasonId,
      from,
      to,
    })
    setBusy(false)

    if (rpcError) {
      // appointment_not_cancellable means something different here than in the
      // actions dialog: somebody is releasing a whole day, and a booking that
      // moved underneath them is stale news rather than a refusal.
      setError(t(reportRpcError(rpcError, 'markEmployeeAbsent', {
        appointment_not_cancellable: 'appointments:dayStatus.staleError',
      })))
      return
    }

    onDone()
    onOpenChange(false)
  }

  // Clearing the record reopens the day. It is not an undo, and the notice
  // beside it says as much before it is clicked rather than after.
  async function handleClear() {
    setError('')
    setBusy(true)
    const { error: deleteError } = await clearEmployeeAbsence({ employeeId: employee.id, dateISO })
    setBusy(false)
    if (deleteError) {
      setError(t(reportDbError(deleteError, 'clearEmployeeAbsence')))
      return
    }
    onDone()
    onOpenChange(false)
  }

  const working = mode === 'view' && !absence

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('appointments:dayStatus.employeeTitle', { name: employee.name })}</DialogTitle>
          </DialogHeader>

          {/* The single question. Ticked means in today; unticking it is what
              opens everything below. */}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="accent-primary"
              checked={working}
              disabled={busy || mode === 'marking'}
              onChange={(e) => { if (!e.target.checked) handleUntick() }}
            />
            {t('appointments:dayStatus.workingTodayLabel')}
          </label>

          {mode === 'view' && absence && (
            <>
              <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
                {t('appointments:dayStatus.currentlyAbsent', { reason: reasonName })}
              </div>
              <p className="text-sm text-muted-foreground">{t('appointments:dayStatus.clearHint')}</p>
            </>
          )}

          {mode === 'marking' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('appointments:dayStatus.absenceReasonLabel')}</Label>
                <div className="flex items-center gap-2">
                  <select
                    className={SELECT_CLASS}
                    value={reasonId}
                    onChange={(e) => setReasonId(e.target.value)}
                    autoFocus
                  >
                    <option value="">{t('appointments:dayStatus.absenceReasonPlaceholder')}</option>
                    {activeReasons.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title={t('appointments:dayStatus.manageReasonsTitle')}
                    onClick={() => setReasonManagerOpen(true)}
                  >
                    <Pencil />
                  </Button>
                </div>
              </div>

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

              {/* A tickbox looks symmetrical and this action is not. The
                  bookings below are cancelled outright: ticking the box again
                  reopens the day but brings nobody back. Said here, before
                  the button, because afterwards there is nothing to say. */}
              {plan && plan.toCancel.length + plan.toRemove.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{t('appointments:dayStatus.noUndoWarning')}</span>
                </div>
              )}
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter>
            {mode === 'marking' ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => { setMode('view'); setPlan(null); setError('') }}>
                  {t('appointments:dayStatus.backButton')}
                </Button>
                <Button variant="destructive" disabled={busy || !reasonId} onClick={handleConfirm}>
                  {busy ? t('common:saving') : t('appointments:dayStatus.confirmAbsentButton')}
                </Button>
              </>
            ) : absence ? (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:done')}</Button>
                <Button disabled={busy} onClick={handleClear}>
                  {busy ? t('common:saving') : t('appointments:dayStatus.clearAbsenceButton')}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:done')}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReasonManagerDialog
        open={reasonManagerOpen}
        onOpenChange={setReasonManagerOpen}
        reasons={absenceReasons}
        loading={absenceReasonsLoading}
        onChanged={reloadAbsenceReasons}
        salonId={salonId}
        table="absence_reasons"
        i18nPrefix="absenceReasonManager"
      />
    </>
  )
}
