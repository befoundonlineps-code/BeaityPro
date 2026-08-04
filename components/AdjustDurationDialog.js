import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { resolveAdjustedEnd, planDurationAdjustment } from '../lib/durationAdjustment'
import { evaluatePlacement, combineGroupPlacement } from '../lib/bookingPlacement'
import { loadGroupOccupancy } from '../lib/placementIO'
import { dbErrorSentence } from '../lib/dbErrors'
import AdjustmentReasonManagerDialog from './AdjustmentReasonManagerDialog'
import TimeRange from './TimeRange'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

function hhmm(value) {
  const d = new Date(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Records when a running session actually ended: later than planned, or cut
// short by a power cut, a broken device, someone taken ill.
//
// The old rows are never edited. adjust_appointment_duration turns each of
// them into an `adjusted` history entry and creates fresh ones ending at the
// real time — so "planned an hour, ran half an hour, because the power went"
// stays answerable forever, and the half hour that did happen is not erased
// the way cancelling would erase it.
export default function AdjustDurationDialog({
  open, onOpenChange, appointment, service, clientName, groupMembers,
  adjustmentReasons, adjustmentReasonsLoading, reloadAdjustmentReasons, salonId,
  onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])

  const [timeValue, setTimeValue] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [reasonManagerOpen, setReasonManagerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeReasons = (adjustmentReasons || []).filter((r) => r.is_active)

  useEffect(() => {
    if (!open || !appointment) return
    setError('')
    setReasonId('')
    setTimeValue(hhmm(appointment.end_time))
  }, [open, appointment])

  if (!appointment) return null

  const start = new Date(appointment.start_time)
  const currentEnd = new Date(appointment.end_time)
  const newEnd = resolveAdjustedEnd(start, currentEnd, timeValue)
  const plan = planDurationAdjustment({ start, currentEnd, newEnd })

  async function handleSave() {
    setError('')

    if (!plan.ok) {
      setError(t(`appointments:adjustDialog.${plan.reason}Error`))
      return
    }
    if (!reasonId) {
      setError(t('appointments:adjustDialog.reasonRequiredError'))
      return
    }

    setSaving(true)

    // Shortening hands time back and cannot collide with anything, so it
    // skips the round-trip entirely. Extending reaches into time nobody
    // cleared, so every participant is checked — the same evaluatePlacement
    // any booking goes through.
    if (plan.needsAvailabilityCheck) {
      const employeeIds = [appointment.employee_id, ...(groupMembers || []).map((m) => m.employee_id)]
      const { rowsByEmployee, unitRows, error: loadError } = await loadGroupOccupancy({
        employeeIds,
        start,
        end: newEnd,
      })
      if (loadError) {
        setSaving(false)
        setError(dbErrorSentence(loadError, t, 'adjustDuration.loadOccupancy'))
        return
      }

      const rows = [appointment, ...(groupMembers || [])]
      const entries = rows.map((row, index) => ({
        key: row.employee_id,
        employeeName: row.employeeName || '',
        isPrimary: index === 0,
        plan: evaluatePlacement({
          start,
          end: newEnd,
          // Deliberately empty: the shift window is not a question here. The
          // employee is physically mid-session, so asking "hold this
          // provisionally?" about time already being worked is nonsense.
          // outsideSchedule is computed and then ignored.
          windows: [],
          // Unchanged employee on an unchanged service — already settled
          // when the booking was made.
          roleAllowed: true,
          employeeAppointments: rowsByEmployee[row.employee_id] || [],
          excludeAppointmentId: row.id,
          // Only the unit this session is already in. A client lying in
          // room 2 cannot be moved to room 3 because the extension clashed,
          // so a busy unit is a refusal, never a retry on another one.
          orderedUnits: row.resource_unit_id ? [{ id: row.resource_unit_id }] : [],
          unitAppointments: unitRows,
        }),
      }))

      const group = combineGroupPlacement(entries)
      if (!group.ok) {
        setSaving(false)
        setError(
          group.reason === 'resourcesBusy'
            ? t('appointments:adjustDialog.resourceBusyError')
            : group.failed.employeeName
            ? t('appointments:adjustDialog.conflictError', { name: group.failed.employeeName })
            : t('appointments:adjustDialog.conflictGenericError')
        )
        return
      }
    }

    const { data, error: rpcError } = await supabase.rpc('adjust_appointment_duration', {
      p_appointment_id: appointment.id,
      p_new_end: newEnd.toISOString(),
      p_adjustment_reason_id: reasonId,
    })

    setSaving(false)

    if (rpcError) {
      if (rpcError.code === '23P01') {
        // The pre-check went stale between reading and writing — the
        // exclusion constraint is the real guarantee, as everywhere else.
        // Checked before the raised codes because this one is a SQLSTATE, and
        // it wants wording of its own rather than dbErrors' generic clash.
        setError(t('appointments:adjustDialog.conflictGenericError'))
      } else {
        setError(dbErrorSentence(rpcError, t, 'adjustAppointmentDuration'))
      }
      return
    }
    if (!data) {
      setError(t('appointments:adjustDialog.noRowsError'))
      return
    }

    onDone()
    onOpenChange(false)
  }

  const originalMinutes = Math.round((currentEnd - start) / 60000)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('appointments:adjustDialog.title')}</DialogTitle>
          </DialogHeader>

          <dl className="flex flex-col gap-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted-foreground">{t('appointments:adjustDialog.clientLabel')}</dt>
              <dd className="font-medium">{clientName}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted-foreground">{t('appointments:adjustDialog.serviceLabel')}</dt>
              <dd className="font-medium">{service?.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted-foreground">{t('appointments:adjustDialog.plannedLabel')}</dt>
              <dd className="font-medium">
                {/* The range only. The minute count beside it is an Arabic
                    phrase and keeps the page's own direction. */}
                <TimeRange start={start} end={currentEnd} />
                <span className="ms-1 text-muted-foreground">
                  ({t('appointments:adjustDialog.minutesText', { count: originalMinutes })})
                </span>
              </dd>
            </div>
          </dl>

          <div className="flex flex-col gap-1.5">
            <Label>{t('appointments:adjustDialog.actualEndLabel')}</Label>
            <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} />
            {plan.ok && (
              <div className="text-sm text-muted-foreground">
                {t(`appointments:adjustDialog.${plan.direction}Hint`, { count: plan.minutes })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('appointments:adjustDialog.reasonLabel')}</Label>
            <div className="flex items-center gap-2">
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
              >
                <option value="">{t('appointments:adjustDialog.reasonPlaceholder')}</option>
                {activeReasons.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title={t('appointments:adjustmentReasonManager.title')}
                onClick={() => setReasonManagerOpen(true)}
              >
                <Pencil />
              </Button>
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              {t('common:discard')}
            </Button>
            <Button disabled={saving || !plan.ok || !reasonId} onClick={handleSave}>
              {saving ? t('common:saving') : t('appointments:adjustDialog.saveButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdjustmentReasonManagerDialog
        open={reasonManagerOpen}
        onOpenChange={setReasonManagerOpen}
        reasons={adjustmentReasons}
        loading={adjustmentReasonsLoading}
        onChanged={reloadAdjustmentReasons}
        salonId={salonId}
      />
    </>
  )
}
