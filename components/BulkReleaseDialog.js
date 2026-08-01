import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { Pencil } from 'lucide-react'
import { classifyBulkRelease, releaseWindow } from '../lib/bulkRelease'
import { loadReleaseCandidates, commitBulkRelease } from '../lib/bulkReleaseIO'
import { reportDbError } from '../lib/dbErrors'
import CancellationReasonManagerDialog from './CancellationReasonManagerDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SELECT_CLASS =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

const ALL_UNITS = 'all'

function pad(n) {
  return String(n).padStart(2, '0')
}

// Day and time together: a range can span several days, so the time alone
// would not say which one a row belongs to.
function whenLabel(appointment) {
  const start = new Date(appointment.start_time)
  const end = new Date(appointment.end_time)
  return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} · ${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`
}

// Clearing a professional's day, or a machine's, in one go.
//
// It lives in its own dialog rather than on the calendar for two reasons:
// dragging a block already means "move this booking", so a drag-select on the
// same pixels would give one gesture two meanings; and an absence can run for
// several days, which a one-day grid cannot express at all.
//
// The preview is not a nicety. This is a destructive action reaching into
// days the receptionist is not looking at, and the two outcomes it produces
// are different enough that seeing them listed — apart — is what makes the
// confirm button safe to press.
export default function BulkReleaseDialog({
  open, onOpenChange, employees, resources, resourceUnits,
  clientsById, servicesById, employeesById,
  cancellationReasons, cancellationReasonsLoading, reloadCancellationReasons,
  salonId, initialDateISO, onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])

  const [mode, setMode] = useState('form') // 'form' | 'preview' | 'done'
  const [targetKind, setTargetKind] = useState('employee') // 'employee' | 'resource'
  const [employeeId, setEmployeeId] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [unitChoice, setUnitChoice] = useState(ALL_UNITS)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [reasonManagerOpen, setReasonManagerOpen] = useState(false)
  const [plan, setPlan] = useState(null)
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const activeReasons = useMemo(
    () => (cancellationReasons || []).filter((r) => r.is_active),
    [cancellationReasons]
  )

  useEffect(() => {
    if (!open) return
    setMode('form')
    setTargetKind('employee')
    setEmployeeId('')
    setResourceId('')
    setUnitChoice(ALL_UNITS)
    setFromDate(initialDateISO || '')
    setToDate(initialDateISO || '')
    setReasonId('')
    setPlan(null)
    setSummary(null)
    setError('')
  }, [open, initialDateISO])

  // The reason that fits what was picked, chosen by name against the two
  // seeded defaults. Renaming one only costs the preselection — the dropdown
  // still lists everything — so this degrades into a shrug rather than into a
  // wrong reason being recorded.
  useEffect(() => {
    const wanted = t(
      targetKind === 'employee'
        ? 'appointments:bulkRelease.defaultReasonEmployee'
        : 'appointments:bulkRelease.defaultReasonResource'
    )
    const match = activeReasons.find((r) => r.name === wanted)
    setReasonId(match ? match.id : '')
  }, [targetKind, activeReasons, t])

  // Any change to what is being released makes an existing preview stale, so
  // it has to be earned again rather than confirmed from memory.
  useEffect(() => {
    setPlan(null)
    if (mode === 'preview') setMode('form')
  }, [targetKind, employeeId, resourceId, unitChoice, fromDate, toDate])

  const unitsForResource = useMemo(
    () =>
      (resourceUnits || [])
        .filter((u) => u.resource_id === resourceId)
        .sort((a, b) => a.unit_index - b.unit_index),
    [resourceUnits, resourceId]
  )

  // One broken machine is one unit; "the whole resource" is simply every one
  // of its unit ids, so both take the same path through the function.
  function buildTarget() {
    if (targetKind === 'employee') {
      return employeeId ? { kind: 'employee', employeeId } : null
    }
    if (!resourceId) return null
    const unitIds =
      unitChoice === ALL_UNITS ? unitsForResource.map((u) => u.id) : [unitChoice]
    return unitIds.length > 0 ? { kind: 'resourceUnits', unitIds } : null
  }

  async function handlePreview() {
    setError('')
    const target = buildTarget()
    if (!target) {
      setError(t('appointments:bulkRelease.targetRequiredError'))
      return
    }
    const window = releaseWindow(fromDate, toDate)
    if (!window) {
      setError(t('appointments:bulkRelease.invalidRangeError'))
      return
    }

    setBusy(true)
    const { rows, error: loadError } = await loadReleaseCandidates({
      target,
      from: window.from,
      to: window.to,
    })
    setBusy(false)
    if (loadError) {
      setError(t(reportDbError(loadError, 'loadReleaseCandidates')))
      return
    }

    setPlan(classifyBulkRelease({ appointments: rows, target, cutoff: new Date() }))
    setMode('preview')
  }

  async function handleCommit() {
    if (!reasonId) return
    const target = buildTarget()
    const window = releaseWindow(fromDate, toDate)
    if (!target || !window) return

    setError('')
    setBusy(true)
    const { data, error: rpcError } = await commitBulkRelease({
      target,
      from: window.from,
      to: window.to,
      cancellationReasonId: reasonId,
    })
    setBusy(false)

    if (rpcError) {
      const message = rpcError.message || ''
      setError(
        message.includes('range_entirely_past')
          ? t('appointments:bulkRelease.rangePastError')
          : message.includes('appointment_not_cancellable') ||
            message.includes('participant_not_removable')
          ? t('appointments:bulkRelease.staleError')
          : t(reportDbError(rpcError, 'bulkReleaseToWaiting'))
      )
      return
    }

    setSummary(data)
    setMode('done')
    // The board changed underneath: cancelled sessions vanish, new waiting
    // entries appear, and shift exceptions went with the cancellations.
    onDone()
  }

  function clientName(id) {
    const c = clientsById[id]
    return c ? `${c.first_name} ${c.last_name || ''}`.trim() : '—'
  }

  function renderRows(rows, tone) {
    return rows.map((a) => (
      <div
        key={a.id}
        className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-xs"
        style={{
          borderInlineStartWidth: 3,
          borderInlineStartColor:
            tone === 'cancel' ? 'var(--color-destructive)' : 'var(--color-muted-foreground)',
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{clientName(a.client_id)}</span>
          <span className="ms-1.5 text-muted-foreground">
            {servicesById[a.service_id]?.name || '—'}
          </span>
        </span>
        <span className="shrink-0 text-muted-foreground">
          {employeesById[a.employee_id]?.name || '—'}
        </span>
        <span className="shrink-0 tabular-nums text-muted-foreground">{whenLabel(a)}</span>
      </div>
    ))
  }

  const nothingAffected = plan && plan.toCancel.length === 0 && plan.toRemove.length === 0

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {mode === 'done'
                ? t('appointments:bulkRelease.doneTitle')
                : t('appointments:bulkRelease.title')}
            </DialogTitle>
          </DialogHeader>

          {mode !== 'done' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t('appointments:bulkRelease.targetKindLabel')}</Label>
                <select
                  className={SELECT_CLASS}
                  value={targetKind}
                  onChange={(e) => setTargetKind(e.target.value)}
                >
                  <option value="employee">{t('appointments:bulkRelease.targetEmployee')}</option>
                  <option value="resource">{t('appointments:bulkRelease.targetResource')}</option>
                </select>
              </div>

              {targetKind === 'employee' ? (
                <div className="flex flex-col gap-1.5">
                  <Label>{t('appointments:bulkRelease.employeeLabel')}</Label>
                  <select
                    className={SELECT_CLASS}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                  >
                    <option value="">{t('appointments:bulkRelease.selectPlaceholder')}</option>
                    {(employees || []).map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('appointments:bulkRelease.resourceLabel')}</Label>
                    <select
                      className={SELECT_CLASS}
                      value={resourceId}
                      onChange={(e) => { setResourceId(e.target.value); setUnitChoice(ALL_UNITS) }}
                    >
                      <option value="">{t('appointments:bulkRelease.selectPlaceholder')}</option>
                      {(resources || []).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* A broken machine is one unit, not the whole resource —
                      cancelling all three when one of three broke would clear
                      bookings that can still go ahead. */}
                  <div className="flex flex-col gap-1.5">
                    <Label>{t('appointments:bulkRelease.unitLabel')}</Label>
                    <select
                      className={SELECT_CLASS}
                      value={unitChoice}
                      disabled={!resourceId}
                      onChange={(e) => setUnitChoice(e.target.value)}
                    >
                      <option value={ALL_UNITS}>{t('appointments:bulkRelease.wholeResourceOption')}</option>
                      {unitsForResource.map((u) => (
                        <option key={u.id} value={u.id}>
                          {t('appointments:resourceDialog.unitLabel', { index: u.unit_index })}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>{t('appointments:bulkRelease.fromLabel')}</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>{t('appointments:bulkRelease.toLabel')}</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>

              <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t('appointments:bulkRelease.pastNotice')}
              </div>
            </div>
          )}

          {mode === 'preview' && plan && (
            <div className="flex flex-col gap-3">
              {nothingAffected && (
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {t('appointments:bulkRelease.nothingAffected')}
                </div>
              )}

              {/* Two lists, never one. Losing the main professional sends the
                  client back to the queue and someone has to phone them;
                  losing an extra pair of hands changes nothing for the client
                  at all. A single merged list would hide which is which. */}
              {plan.toCancel.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-sm font-medium text-destructive">
                    {t('appointments:bulkRelease.willCancelHeading', { count: plan.toCancel.length })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('appointments:bulkRelease.willCancelHint')}
                  </p>
                  <div className="flex flex-col gap-1">{renderRows(plan.toCancel, 'cancel')}</div>
                </div>
              )}

              {plan.toRemove.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-sm font-medium">
                    {t('appointments:bulkRelease.willRemoveHeading', { count: plan.toRemove.length })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('appointments:bulkRelease.willRemoveHint')}
                  </p>
                  <div className="flex flex-col gap-1">{renderRows(plan.toRemove, 'remove')}</div>
                </div>
              )}

              {!nothingAffected && (
                <div className="flex flex-col gap-1.5">
                  <Label>{t('appointments:bulkRelease.reasonLabel')}</Label>
                  <div className="flex items-center gap-2">
                    <select
                      className={SELECT_CLASS}
                      value={reasonId}
                      onChange={(e) => setReasonId(e.target.value)}
                    >
                      <option value="">{t('appointments:bulkRelease.reasonPlaceholder')}</option>
                      {activeReasons.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      title={t('appointments:actionsDialog.cancelStep.manageReasonsTitle')}
                      onClick={() => setReasonManagerOpen(true)}
                    >
                      <Pencil />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'done' && summary && (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                {t('appointments:bulkRelease.doneSummary', {
                  cancelled: summary.cancelled_count,
                  removed: summary.removed_count,
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('appointments:bulkRelease.doneNextStep')}
              </p>
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter>
            {mode === 'done' ? (
              <Button onClick={() => onOpenChange(false)}>{t('common:done')}</Button>
            ) : mode === 'preview' ? (
              <>
                <Button variant="outline" disabled={busy} onClick={() => setMode('form')}>
                  {t('appointments:bulkRelease.backButton')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy || nothingAffected || !reasonId}
                  onClick={handleCommit}
                >
                  {busy ? t('common:saving') : t('appointments:bulkRelease.confirmButton')}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t('common:discard')}
                </Button>
                <Button disabled={busy} onClick={handlePreview}>
                  {busy ? t('common:loading') : t('appointments:bulkRelease.previewButton')}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CancellationReasonManagerDialog
        open={reasonManagerOpen}
        onOpenChange={setReasonManagerOpen}
        reasons={cancellationReasons}
        loading={cancellationReasonsLoading}
        onChanged={reloadCancellationReasons}
        salonId={salonId}
      />
    </>
  )
}
