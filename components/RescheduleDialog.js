import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { isServiceAllowedForRole } from '../lib/bookingPlacement'
import { planReschedule, commitReschedule, rescheduleErrorKey, RESCHEDULE_ERROR_KEYS } from '../lib/rescheduleFlow'
import { reportDbError } from '../lib/dbErrors'
import RescheduleReasonManagerDialog from './RescheduleReasonManagerDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

function toDateInputValue(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeInputValue(date) {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Moves a booked or provisional appointment to a new date, time and
// (optionally) employee, keeping the client and service fixed — changing
// the service is a different booking, not a reschedule. The old row is
// never edited in place: reschedule_appointment turns it into a
// `rescheduled` history entry and creates a fresh one, atomically.
//
// This shares its placement rules with the calendar's own booking dialog
// through lib/bookingPlacement — the only difference is that the moved
// appointment must be excluded from its own conflict and resource checks,
// since it is still sitting in its old slot at the moment this runs.
export default function RescheduleDialog({
  open, onOpenChange, appointment, service, clientName,
  employees, services, categories, roleBusinessTypes,
  schedulesByEmployee, exceptionsByEmployee, absencesByEmployee,
  resources, resourceUnits, serviceResources,
  rescheduleReasons, rescheduleReasonsLoading, reloadRescheduleReasons, salonId,
  onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])

  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reasonId, setReasonId] = useState('')
  const [reasonManagerOpen, setReasonManagerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [outsideSchedule, setOutsideSchedule] = useState(null)

  const activeReasons = (rescheduleReasons || []).filter((r) => r.is_active)

  useEffect(() => {
    if (!open || !appointment) return
    setError('')
    setOutsideSchedule(null)
    setReasonId('')
    setEmployeeId(appointment.employee_id || '')
    setDate(toDateInputValue(appointment.start_time))
    setTime(toTimeInputValue(appointment.start_time))
  }, [open, appointment])

  useEffect(() => { setOutsideSchedule(null) }, [employeeId, date, time])

  if (!appointment || !service) return null

  // Only employees whose role actually covers this service — the service
  // itself cannot change here, so there is no point offering a choice that
  // evaluatePlacement would just refuse.
  const eligibleEmployees = (employees || []).filter((e) =>
    isServiceAllowedForRole(e.role, service, services, categories, roleBusinessTypes)
  )
  const selectedEmployee = eligibleEmployees.find((e) => e.id === employeeId)

  async function handleSave(asPending = false) {
    setError('')

    if (!employeeId) {
      setError(t('appointments:formDialog.employeeRequiredError'))
      return
    }
    if (!date || !time) {
      setError(t('appointments:formDialog.dateTimeRequiredError'))
      return
    }
    if (!reasonId) {
      setError(t('appointments:rescheduleDialog.reasonRequiredError'))
      return
    }

    setSaving(true)

    const { plan, start, end, error: planError } = await planReschedule({
      appointment,
      service,
      employeeId,
      requestedStart: new Date(`${date}T${time}:00`),
      employees, services, categories, roleBusinessTypes,
      schedulesByEmployee, exceptionsByEmployee, absencesByEmployee,
      resources, resourceUnits, serviceResources,
    })

    if (planError) {
      setSaving(false)
      setError(t(reportDbError(planError, 'reschedule.plan')))
      return
    }
    if (!plan.ok) {
      setSaving(false)
      setError(t(RESCHEDULE_ERROR_KEYS[plan.reason]))
      return
    }
    if (plan.outsideSchedule && !asPending) {
      setSaving(false)
      setOutsideSchedule({ employeeName: selectedEmployee?.name || '' })
      return
    }
    setOutsideSchedule(null)

    const result = await commitReschedule({ appointment, employeeId, start, end, plan, rescheduleReasonId: reasonId })
    setSaving(false)

    const errorKey = rescheduleErrorKey(result)
    if (errorKey) {
      setError(t(errorKey))
      return
    }
    if (result.error) {
      setError(t(reportDbError(result.error, 'rescheduleAppointment')))
      return
    }

    onDone()
    onOpenChange(false)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('appointments:rescheduleDialog.title')}</DialogTitle>
        </DialogHeader>

        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">{t('appointments:rescheduleDialog.clientLabel')}</dt>
            <dd className="font-medium">{clientName}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">{t('appointments:rescheduleDialog.serviceLabel')}</dt>
            <dd className="font-medium">{service.name}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-1.5">
          <Label>{t('appointments:formDialog.employeeLabel')}</Label>
          <select
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">{t('appointments:formDialog.selectPlaceholder')}</option>
            {eligibleEmployees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>{t('appointments:formDialog.dateLabel')}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('appointments:formDialog.timeLabel')}</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t('appointments:rescheduleDialog.reasonLabel')}</Label>
          <div className="flex items-center gap-2">
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
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title={t('appointments:rescheduleReasonManager.title')}
              onClick={() => setReasonManagerOpen(true)}
            >
              <Pencil />
            </Button>
          </div>
        </div>

        {outsideSchedule && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {t('appointments:formDialog.outsideScheduleWarning', { name: outsideSchedule.employeeName })}
          </div>
        )}

        {error && <div className="text-sm text-destructive">{error}</div>}

        <DialogFooter>
          {outsideSchedule ? (
            <>
              <Button variant="outline" disabled={saving} onClick={() => setOutsideSchedule(null)}>
                {t('appointments:formDialog.backButton')}
              </Button>
              <Button disabled={saving || !reasonId} onClick={() => handleSave(true)}>
                {saving ? t('common:saving') : t('appointments:formDialog.bookProvisionallyButton')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
              <Button disabled={saving || !reasonId} onClick={() => handleSave(false)}>
                {saving ? t('common:saving') : t('appointments:rescheduleDialog.saveButton')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <RescheduleReasonManagerDialog
      open={reasonManagerOpen}
      onOpenChange={setReasonManagerOpen}
      reasons={rescheduleReasons}
      loading={rescheduleReasonsLoading}
      onChanged={reloadRescheduleReasons}
      salonId={salonId}
    />
    </>
  )
}
