import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { planReschedule, commitReschedule, rescheduleErrorKey, RESCHEDULE_ERROR_KEYS } from '../lib/rescheduleFlow'
import { dbErrorSentence } from '../lib/dbErrors'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

function hhmm(value) {
  const d = new Date(value)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// The confirmation a drag lands in. Unlike RescheduleDialog it asks for
// nothing — the gesture already said where the booking should go, and
// putting a form in front of it would undo the point of dragging.
//
// The move is evaluated as soon as this opens rather than on confirm, so a
// drop onto a column whose role can't perform the service, or onto a slot
// somebody else holds, says so immediately instead of after a click that
// was never going to work.
export default function RescheduleConfirmDialog({
  open, onOpenChange, target,
  employees, services, categories, roleBusinessTypes,
  schedulesByEmployee, exceptionsByEmployee, absencesByEmployee, dayHoursByEmployee,
  resources, resourceUnits, serviceResources,
  rescheduleReasons,
  fromEmployee, clientName, service,
  onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])
  const [checking, setChecking] = useState(false)
  const [evaluated, setEvaluated] = useState(null) // { plan, start, end, employee }
  const [reasonId, setReasonId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const activeReasons = (rescheduleReasons || []).filter((r) => r.is_active)

  useEffect(() => {
    let cancelled = false
    if (!open || !target || !service) return

    setError('')
    setEvaluated(null)
    setReasonId('')
    setChecking(true)

    planReschedule({
      appointment: target.appointment,
      service,
      employeeId: target.employeeId,
      requestedStart: target.start,
      employees, services, categories, roleBusinessTypes,
      schedulesByEmployee, exceptionsByEmployee, absencesByEmployee, dayHoursByEmployee,
      resources, resourceUnits, serviceResources,
    }).then((result) => {
      if (cancelled) return
      setChecking(false)
      if (result.error) {
        setError(dbErrorSentence(result.error, t, 'rescheduleAppointment.drag'))
        return
      }
      setEvaluated(result)
      if (!result.plan.ok) setError(t(RESCHEDULE_ERROR_KEYS[result.plan.reason]))
    })

    return () => { cancelled = true }
  }, [open, target])

  if (!target || !service) return null

  const plan = evaluated?.plan
  const canProceed = !!plan?.ok

  async function handleConfirm() {
    setError('')
    setSaving(true)
    const result = await commitReschedule({
      appointment: target.appointment,
      employeeId: target.employeeId,
      start: evaluated.start,
      end: evaluated.end,
      plan,
      rescheduleReasonId: reasonId,
    })
    setSaving(false)

    const errorKey = rescheduleErrorKey(result)
    if (errorKey) {
      setError(t(errorKey))
      return
    }
    if (result.error) {
      setError(dbErrorSentence(result.error, t, 'rescheduleAppointment.drag'))
      return
    }

    onDone()
    onOpenChange(false)
  }

  const toEmployee = evaluated?.employee
  const movedEmployee = fromEmployee && toEmployee && fromEmployee.id !== toEmployee.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('appointments:dropConfirm.title')}</DialogTitle>
        </DialogHeader>

        <div className="text-sm">
          <div className="font-medium">{clientName}</div>
          <div className="text-muted-foreground">{service.name}</div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">{t('appointments:dropConfirm.fromLabel')}</span>
            <span className="font-medium">{hhmm(target.appointment.start_time)}</span>
            {movedEmployee && <span className="text-xs text-muted-foreground">{fromEmployee.name}</span>}
          </div>
          <ArrowLeft className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          <div className="flex flex-col text-end">
            <span className="text-xs text-muted-foreground">{t('appointments:dropConfirm.toLabel')}</span>
            <span className="font-medium">{hhmm(target.start)}</span>
            {movedEmployee && <span className="text-xs text-muted-foreground">{toEmployee.name}</span>}
          </div>
        </div>

        {checking && <div className="text-sm text-muted-foreground">{t('common:loading')}</div>}

        {/* The one extra control the drag path adds — a required reason,
            not a form. The manage-reasons pencil lives only in the full
            "reschedule" dialog, so this stays a single line. */}
        {canProceed && (
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value)}
          >
            <option value="">{t('appointments:rescheduleDialog.reasonPlaceholder')}</option>
            {activeReasons.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        )}

        {plan?.ok && plan.outsideSchedule && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {t('appointments:formDialog.outsideScheduleWarning', { name: toEmployee?.name || '' })}
          </div>
        )}

        {error && <div className="text-sm text-destructive">{error}</div>}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            {t('appointments:formDialog.backButton')}
          </Button>
          {canProceed && (
            <Button disabled={saving || checking || !reasonId} onClick={handleConfirm}>
              {saving
                ? t('common:saving')
                : plan.outsideSchedule
                ? t('appointments:formDialog.bookProvisionallyButton')
                : t('appointments:dropConfirm.confirmButton')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
