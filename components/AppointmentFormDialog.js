import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import ClientPickerDialog from './ClientPickerDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { availableWindowForDate, isWithinWindow } from '../lib/employeeAvailability'
import { resolveBookingStart } from '../lib/appointmentGrid'
import { servicesForRole } from '../lib/roleServiceFilter'
import { serviceUsesResources, orderedUnitsForService, availableUnitsFor, conflictKind } from '../lib/resourceAllocation'

function toDateInputValue(date) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toTimeInputValue(date) {
  const d = new Date(date)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AppointmentFormDialog({ open, onOpenChange, salonId, initialEmployeeId, initialStartTime, employees, services, categories, roleBusinessTypes, schedulesByEmployee, resources, resourceUnits, serviceResources, onSaved }) {
  const { t } = useTranslation(['appointments', 'common'])

  const [client, setClient] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [serviceId, setServiceId] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [isWaiting, setIsWaiting] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(null)

  const activeServices = (services || []).filter((s) => s.is_active)
  const selectedEmployee = (employees || []).find((e) => e.id === employeeId)
  const visibleServices = servicesForRole(selectedEmployee?.role, activeServices, categories, roleBusinessTypes)

  function handleEmployeeChange(newEmployeeId) {
    setEmployeeId(newEmployeeId)
    const newEmployee = (employees || []).find((e) => e.id === newEmployeeId)
    const newVisible = servicesForRole(newEmployee?.role, activeServices, categories, roleBusinessTypes)
    if (serviceId && !newVisible.some((s) => s.id === serviceId)) {
      setServiceId('')
    }
  }

  useEffect(() => {
    if (!open) return
    setError('')
    setClient(null)
    setServiceId('')
    setNote('')
    setIsWaiting(false)
    setRemaining(null)
    setEmployeeId(initialEmployeeId || '')
    setDate(initialStartTime ? toDateInputValue(initialStartTime) : '')
    setTime(initialStartTime ? toTimeInputValue(initialStartTime) : '')
  }, [open, initialEmployeeId, initialStartTime])

  const selectedService = activeServices.find((s) => s.id === serviceId)
  const computedEndTime = selectedService && date && time
    ? new Date(new Date(`${date}T${time}:00`).getTime() + selectedService.duration_minutes * 60000)
    : null

  // Candidate rows for a window. The filter here only narrows what gets
  // fetched — whether a row actually occupies the window is decided by
  // availableUnitsFor, so the half-open rule lives in one tested place
  // rather than being duplicated in query syntax.
  async function loadUnitAppointments(start, end) {
    const { data, error: queryError } = await supabase
      .from('appointments')
      .select('resource_unit_id, start_time, end_time, status')
      .in('status', ['booked', 'completed'])
      .not('resource_unit_id', 'is', null)
      .lt('start_time', end.toISOString())
      .gt('end_time', start.toISOString())
    if (queryError) return { error: queryError }
    return { rows: data || [] }
  }

  // "X remaining" for the exact window being booked — recomputed whenever
  // the service or the time changes, and only for services that actually
  // use resources.
  useEffect(() => {
    let cancelled = false

    async function computeRemaining() {
      if (isWaiting || !selectedService || !date || !time || !serviceUsesResources(serviceId, serviceResources)) {
        setRemaining(null)
        return
      }
      // Same resolved window the save will use, so the count reflects what
      // actually gets booked rather than the slot boundary on screen.
      const start = resolveBookingStart(new Date(`${date}T${time}:00`), new Date())
      if (!start) {
        setRemaining(null)
        return
      }
      const end = new Date(start.getTime() + selectedService.duration_minutes * 60000)
      const ordered = orderedUnitsForService(serviceId, serviceResources, resources, resourceUnits)
      const { rows, error: queryError } = await loadUnitAppointments(start, end)
      if (cancelled || queryError) return
      setRemaining({ free: availableUnitsFor(ordered, rows, start, end).length, total: ordered.length })
    }

    computeRemaining()
    return () => { cancelled = true }
  }, [serviceId, date, time, isWaiting, serviceResources, resources, resourceUnits])

  async function handleSave() {
    setError('')

    if (!client) {
      setError(t('appointments:formDialog.clientRequiredError'))
      return
    }
    if (!serviceId) {
      setError(t('appointments:formDialog.serviceRequiredError'))
      return
    }

    if (isWaiting) {
      setSaving(true)
      const { data, error: saveError } = await supabase
        .from('appointments')
        .insert([{
          salon_id: salonId,
          client_id: client.id,
          service_id: serviceId,
          employee_id: null,
          start_time: null,
          end_time: null,
          status: 'waiting',
          note: note.trim() || null,
        }])
        .select()
      setSaving(false)
      if (saveError) {
        setError(saveError.message)
        return
      }
      if (!data || data.length === 0) {
        setError(t('appointments:formDialog.noRowsError'))
        return
      }
      onSaved()
      onOpenChange(false)
      return
    }

    if (!employeeId) {
      setError(t('appointments:formDialog.employeeRequiredError'))
      return
    }
    if (!date || !time) {
      setError(t('appointments:formDialog.dateTimeRequiredError'))
      return
    }

    // Resolve against the clock as it is right now, not as it was when the
    // dialog opened — a booking that sat unsaved for a few minutes should
    // record when it actually starts. Everything below checks the resolved
    // window, so a service that no longer fits before closing is caught.
    const start = resolveBookingStart(new Date(`${date}T${time}:00`), new Date())
    if (!start) {
      setError(t('appointments:formDialog.pastTimeError'))
      return
    }
    const end = new Date(start.getTime() + selectedService.duration_minutes * 60000)

    const scheduleEntry = (schedulesByEmployee || {})[employeeId]
    const window = availableWindowForDate(scheduleEntry?.schedule, scheduleEntry?.slots, new Date(`${date}T00:00:00`))
    if (!isWithinWindow(window, toTimeInputValue(start), toTimeInputValue(end))) {
      setError(t('appointments:formDialog.outsideScheduleError'))
      return
    }

    setSaving(true)

    const { data: conflicts, error: conflictCheckError } = await supabase
      .from('appointments')
      .select('id')
      .eq('employee_id', employeeId)
      .in('status', ['booked', 'completed'])
      .lt('start_time', end.toISOString())
      .gt('end_time', start.toISOString())

    if (conflictCheckError) {
      setSaving(false)
      setError(conflictCheckError.message)
      return
    }
    if (conflicts && conflicts.length > 0) {
      setSaving(false)
      setError(t('appointments:formDialog.conflictError'))
      return
    }

    const basePayload = {
      salon_id: salonId,
      client_id: client.id,
      service_id: serviceId,
      employee_id: employeeId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: 'booked',
      note: note.trim() || null,
    }

    // Services with no linked resource book straight through; the rest have
    // to claim one free unit first.
    let candidateUnits = [null]
    if (serviceUsesResources(serviceId, serviceResources)) {
      const ordered = orderedUnitsForService(serviceId, serviceResources, resources, resourceUnits)
      const { rows, error: occupiedError } = await loadUnitAppointments(start, end)
      if (occupiedError) {
        setSaving(false)
        setError(occupiedError.message)
        return
      }
      candidateUnits = availableUnitsFor(ordered, rows, start, end)
      if (candidateUnits.length === 0) {
        setSaving(false)
        setError(t('appointments:formDialog.allResourcesBusyError'))
        return
      }
    }

    // The scan above can go stale between reading and writing, so a unit
    // that looked free may be taken by the time we insert. The exclusion
    // constraint catches that, and we simply move on to the next unit
    // rather than rejecting a booking that another unit could still take.
    // Only after every candidate is genuinely gone do we give up.
    let saved = null
    let lastError = null

    for (const unit of candidateUnits) {
      const { data, error: saveError } = await supabase
        .from('appointments')
        .insert([{ ...basePayload, resource_unit_id: unit ? unit.id : null }])
        .select()

      if (!saveError) {
        if (!data || data.length === 0) {
          setSaving(false)
          setError(t('appointments:formDialog.noRowsError'))
          return
        }
        saved = data
        break
      }

      lastError = saveError
      const kind = conflictKind(saveError)
      if (kind === 'resource') continue // this unit just got taken — try the next
      if (kind === 'employee') {
        setSaving(false)
        setError(t('appointments:formDialog.conflictError'))
        return
      }
      setSaving(false)
      setError(saveError.message)
      return
    }

    setSaving(false)

    if (!saved) {
      setError(
        conflictKind(lastError) === 'resource'
          ? t('appointments:formDialog.allResourcesBusyError')
          : t('appointments:formDialog.noRowsError')
      )
      return
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('appointments:formDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('appointments:formDialog.clientLabel')}</Label>
              <Button type="button" variant="outline" className="justify-start" onClick={() => setPickerOpen(true)}>
                {client ? `${client.first_name} ${client.last_name}` : t('appointments:formDialog.chooseClientButton')}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('appointments:formDialog.serviceLabel')}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">{t('appointments:formDialog.selectPlaceholder')}</option>
                {visibleServices.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.duration_minutes} {t('appointments:formDialog.minutesShort')}</option>
                ))}
              </select>
              {selectedEmployee && visibleServices.length === 0 && (
                <div className="text-sm text-muted-foreground">{t('appointments:formDialog.noServicesForRoleHint')}</div>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="accent-primary" checked={isWaiting} onChange={(e) => setIsWaiting(e.target.checked)} />
              {t('appointments:formDialog.waitingToggleLabel')}
            </label>

            {!isWaiting && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>{t('appointments:formDialog.employeeLabel')}</Label>
                  <select
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                    value={employeeId}
                    onChange={(e) => handleEmployeeChange(e.target.value)}
                  >
                    <option value="">{t('appointments:formDialog.selectPlaceholder')}</option>
                    {(employees || []).map((emp) => (
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

                {computedEndTime && (
                  <div className="text-sm text-muted-foreground">
                    {t('appointments:formDialog.endsAtText', { time: toTimeInputValue(computedEndTime) })}
                  </div>
                )}

                {remaining && (
                  <div
                    className={
                      remaining.free === 0
                        ? 'rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive'
                        : 'rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground'
                    }
                  >
                    {remaining.free === 0
                      ? t('appointments:formDialog.allResourcesBusyError')
                      : t('appointments:formDialog.resourcesRemainingText', { free: remaining.free, total: remaining.total })}
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>{t('appointments:formDialog.noteLabel')}</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>

          {error && <div className="text-sm text-destructive">{error}</div>}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? t('common:saving') : t('common:save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientPickerDialog
        open={pickerOpen}
        title={t('appointments:formDialog.pickerTitle')}
        onOpenChange={setPickerOpen}
        onPick={(c) => { setClient(c); setPickerOpen(false) }}
      />
    </>
  )
}
