import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import { availableWindowsForDate } from '../lib/employeeAvailability'
import { serviceUsesResources, orderedUnitsForService } from '../lib/resourceAllocation'
import { resolvePlacementWindow, evaluatePlacement, isServiceAllowedForRole } from '../lib/bookingPlacement'
import { loadOccupancy, attemptOnEachUnit } from '../lib/placementIO'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const PLACEMENT_ERROR_KEYS = {
  roleMismatch: 'appointments:formDialog.roleMismatchError',
  conflict: 'appointments:formDialog.conflictError',
  resourcesBusy: 'appointments:formDialog.allResourcesBusyError',
}

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
  schedulesByEmployee, exceptionsByEmployee,
  resources, resourceUnits, serviceResources,
  onDone,
}) {
  const { t } = useTranslation(['appointments', 'common'])

  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [outsideSchedule, setOutsideSchedule] = useState(null)

  useEffect(() => {
    if (!open || !appointment) return
    setError('')
    setOutsideSchedule(null)
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

    const placement = resolvePlacementWindow(new Date(`${date}T${time}:00`), service, new Date())
    if (!placement) {
      setError(t('appointments:formDialog.pastTimeError'))
      return
    }
    const { start, end } = placement

    setSaving(true)

    const { employeeRows, unitRows, error: loadError } = await loadOccupancy({ employeeId, start, end })
    if (loadError) {
      setSaving(false)
      setError(loadError.message)
      return
    }

    const scheduleEntry = (schedulesByEmployee || {})[employeeId]
    const plan = evaluatePlacement({
      start,
      end,
      windows: availableWindowsForDate(
        scheduleEntry?.schedule,
        scheduleEntry?.slots,
        (exceptionsByEmployee || {})[employeeId],
        new Date(`${date}T00:00:00`)
      ),
      roleAllowed: isServiceAllowedForRole(selectedEmployee?.role, service, services, categories, roleBusinessTypes),
      employeeAppointments: employeeRows,
      excludeAppointmentId: appointment.id,
      orderedUnits: serviceUsesResources(service.id, serviceResources)
        ? orderedUnitsForService(service.id, serviceResources, resources, resourceUnits)
        : [],
      unitAppointments: unitRows,
    })

    if (!plan.ok) {
      setSaving(false)
      setError(t(PLACEMENT_ERROR_KEYS[plan.reason]))
      return
    }

    if (plan.outsideSchedule && !asPending) {
      setSaving(false)
      setOutsideSchedule({ employeeName: selectedEmployee?.name || '' })
      return
    }
    setOutsideSchedule(null)

    const { data, error: saveError, kind, exhausted } = await attemptOnEachUnit(
      plan.candidateUnits,
      (unit) => supabase.rpc('reschedule_appointment', {
        p_appointment_id: appointment.id,
        p_new_start: start.toISOString(),
        p_new_end: end.toISOString(),
        p_new_employee_id: employeeId,
        p_provisional: plan.outsideSchedule,
        p_resource_unit_id: unit ? unit.id : null,
      })
    )

    setSaving(false)

    if (saveError) {
      if (exhausted) setError(t('appointments:formDialog.allResourcesBusyError'))
      else if (kind === 'employee') setError(t('appointments:formDialog.conflictError'))
      else if (saveError.message?.includes('appointment_not_reschedulable')) setError(t('appointments:rescheduleDialog.notReschedulableError'))
      else setError(saveError.message)
      return
    }
    if (!data) {
      setError(t('appointments:rescheduleDialog.noRowsError'))
      return
    }

    onDone()
    onOpenChange(false)
  }

  return (
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
              <Button disabled={saving} onClick={() => handleSave(true)}>
                {saving ? t('common:saving') : t('appointments:formDialog.bookProvisionallyButton')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
              <Button disabled={saving} onClick={() => handleSave(false)}>
                {saving ? t('common:saving') : t('appointments:rescheduleDialog.saveButton')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
