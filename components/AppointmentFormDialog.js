import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { supabase } from '../lib/supabaseClient'
import ClientPickerDialog from './ClientPickerDialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { availableWindowsForDate, isAbsentOn } from '../lib/employeeAvailability'
import { servicesForRole } from '../lib/roleServiceFilter'
import { serviceUsesResources, orderedUnitsForService, availableUnitsFor } from '../lib/resourceAllocation'
import { resolvePlacementWindow, evaluatePlacement, isServiceAllowedForRole, combineGroupPlacement } from '../lib/bookingPlacement'
import { loadOccupancy, loadGroupOccupancy, attemptOnEachUnit } from '../lib/placementIO'
import { reportDbError } from '../lib/dbErrors'
import { Plus, X } from 'lucide-react'

// Which message each refusal from the pure layer turns into.
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

// waitingAppointment turns this into conversion mode: the same dialog, but
// filling in a waiting-list entry that already exists rather than creating
// something new. The client is fixed (a different client would be somebody
// else's place in the queue), the service is not, and every placement rule
// runs exactly as it does for a fresh booking — only the final write
// differs, updating the row in place instead of inserting one.
export default function AppointmentFormDialog({ open, onOpenChange, salonId, initialEmployeeId, initialStartTime, waitingAppointment, employees, services, categories, roleBusinessTypes, schedulesByEmployee, exceptionsByEmployee, absencesByEmployee, dayHoursByEmployee, resources, resourceUnits, serviceResources, onSaved }) {
  const { t } = useTranslation(['appointments', 'employees', 'common'])

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
  // Set when the requested time falls outside the employee's shift. Booking
  // then isn't refused — the receptionist is asked whether to hold the slot
  // provisionally and get it approved later.
  const [outsideSchedule, setOutsideSchedule] = useState(null)
  // Extra professionals on the same session. Each becomes its own
  // appointment row sharing a group_id, so each one's time is protected by
  // the very same exclusion constraint the main professional's is.
  const [extraEmployeeIds, setExtraEmployeeIds] = useState([])

  const isConverting = !!waitingAppointment
  const activeServices = (services || []).filter((s) => s.is_active)
  const selectedEmployee = (employees || []).find((e) => e.id === employeeId)
  const selectedService = activeServices.find((s) => s.id === serviceId)
  const visibleServices = servicesForRole(selectedEmployee?.role, activeServices, categories, roleBusinessTypes)

  // Anyone whose role covers the chosen service, minus the people already on
  // it. is_assistant plays no part here: it hides a calendar column, it does
  // not limit who may work.
  const eligibleExtras = selectedService
    ? (employees || []).filter(
        (e) =>
          e.id !== employeeId &&
          isServiceAllowedForRole(e.role, selectedService, activeServices, categories, roleBusinessTypes)
      )
    : []

  function handleEmployeeChange(newEmployeeId) {
    setEmployeeId(newEmployeeId)
    const newEmployee = (employees || []).find((e) => e.id === newEmployeeId)
    const newVisible = servicesForRole(newEmployee?.role, activeServices, categories, roleBusinessTypes)
    if (serviceId && !newVisible.some((s) => s.id === serviceId)) {
      setServiceId('')
    }
    // Whoever just became the main professional can't also be an extra.
    setExtraEmployeeIds((prev) => prev.filter((id) => id !== newEmployeeId))
  }

  function handleServiceChange(newServiceId) {
    setServiceId(newServiceId)
    // A different service can mean a different set of qualified roles, so
    // anyone who no longer covers it drops off rather than failing on save.
    const newService = activeServices.find((s) => s.id === newServiceId)
    setExtraEmployeeIds((prev) =>
      prev.filter((id) => {
        const emp = (employees || []).find((e) => e.id === id)
        return newService && isServiceAllowedForRole(emp?.role, newService, activeServices, categories, roleBusinessTypes)
      })
    )
  }

  useEffect(() => {
    if (!open) return
    setError('')
    setRemaining(null)
    setOutsideSchedule(null)
    setExtraEmployeeIds([])
    setEmployeeId(initialEmployeeId || '')
    setDate(initialStartTime ? toDateInputValue(initialStartTime) : '')
    setTime(initialStartTime ? toTimeInputValue(initialStartTime) : '')

    // Converting carries the entry's own client, service and note across;
    // the waiting toggle is meaningless here, since this is the way *out*
    // of the waiting list.
    setClient(waitingAppointment ? waitingAppointment.client || null : null)
    setServiceId(waitingAppointment ? waitingAppointment.service_id || '' : '')
    setNote(waitingAppointment ? waitingAppointment.note || '' : '')
    setIsWaiting(false)
  }, [open, initialEmployeeId, initialStartTime, waitingAppointment])

  // The warning belongs to one specific employee/service/time combination.
  // Touching any of them makes it stale, so it goes away and has to be
  // earned again on the next save.
  useEffect(() => { setOutsideSchedule(null) }, [employeeId, serviceId, date, time, isWaiting, extraEmployeeIds])

  const computedEndTime = selectedService && date && time
    ? new Date(new Date(`${date}T${time}:00`).getTime() + selectedService.duration_minutes * 60000)
    : null

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
      const placement = resolvePlacementWindow(new Date(`${date}T${time}:00`), selectedService, new Date())
      if (!placement) {
        setRemaining(null)
        return
      }
      const { start, end } = placement
      const ordered = orderedUnitsForService(serviceId, serviceResources, resources, resourceUnits)
      const { unitRows, error: queryError } = await loadOccupancy({ employeeId: null, start, end })
      if (cancelled || queryError) return
      setRemaining({ free: availableUnitsFor(ordered, unitRows, start, end).length, total: ordered.length })
    }

    computeRemaining()
    return () => { cancelled = true }
  }, [serviceId, date, time, isWaiting, serviceResources, resources, resourceUnits])

  // asPending is set only by the "book provisionally" button, which the
  // receptionist reaches after being warned. It skips the shift check —
  // that check is the very thing she just answered — and nothing else.
  async function handleSave(asPending = false) {
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
      // A waiting entry is a group of one, exactly like a booked primary.
      // group_id is NOT NULL with no default — a column default cannot
      // reference the row's own id — so it has to be generated here, the
      // same way the booking path below does it.
      const waitingId = crypto.randomUUID()
      const { data, error: saveError } = await supabase
        .from('appointments')
        .insert([{
          id: waitingId,
          salon_id: salonId,
          client_id: client.id,
          service_id: serviceId,
          employee_id: null,
          start_time: null,
          end_time: null,
          status: 'waiting',
          note: note.trim() || null,
          group_id: waitingId,
          is_primary: true,
        }])
        .select()
      setSaving(false)
      if (saveError) {
        setError(t(reportDbError(saveError, 'createWaitingEntry')))
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
    const placement = resolvePlacementWindow(new Date(`${date}T${time}:00`), selectedService, new Date())
    if (!placement) {
      setError(t('appointments:formDialog.pastTimeError'))
      return
    }
    const { start, end } = placement

    setSaving(true)

    // A row left on the placeholder is simply not a participant yet.
    const participantIds = [employeeId, ...extraEmployeeIds.filter(Boolean)]

    // An absence is refused outright rather than turned into the
    // "book provisionally?" question the rest of this dialog asks. That
    // question means "she is outside her shift — shall we ask her to come
    // in?", and there is nobody to ask: she is not here today. The grid
    // already makes her cells inert, so this only catches the way in through
    // the employee dropdown.
    const absentId = participantIds.find((id) => isAbsentOn((absencesByEmployee || {})[id], start))
    if (absentId) {
      setSaving(false)
      setError(t('appointments:formDialog.absentEmployeeError', {
        name: (employees || []).find((e) => e.id === absentId)?.name || '',
      }))
      return
    }
    const { rowsByEmployee, unitRows, error: loadError } = await loadGroupOccupancy({
      employeeIds: participantIds,
      start,
      end,
    })
    if (loadError) {
      setSaving(false)
      setError(loadError.message)
      return
    }

    // Every participant goes through the very same evaluatePlacement as a
    // lone booking, once each. Only the main professional can claim a
    // resource unit — the room follows the client's session, not each pair
    // of hands in it — so the others are evaluated with no units at all.
    const dayStart = new Date(`${date}T00:00:00`)
    const entries = participantIds.map((id, index) => {
      const employee = (employees || []).find((e) => e.id === id)
      const scheduleEntry = (schedulesByEmployee || {})[id]
      const isPrimary = index === 0
      return {
        key: id,
        employeeName: employee?.name || '',
        isPrimary,
        plan: evaluatePlacement({
          start,
          end,
          windows: availableWindowsForDate(
            scheduleEntry?.schedule,
            scheduleEntry?.slots,
            (exceptionsByEmployee || {})[id],
            dayStart,
            (absencesByEmployee || {})[id],
            (dayHoursByEmployee || {})[id]
          ),
          roleAllowed: isServiceAllowedForRole(employee?.role, selectedService, activeServices, categories, roleBusinessTypes),
          employeeAppointments: rowsByEmployee[id] || [],
          orderedUnits: isPrimary && serviceUsesResources(serviceId, serviceResources)
            ? orderedUnitsForService(serviceId, serviceResources, resources, resourceUnits)
            : [],
          unitAppointments: unitRows,
        }),
      }
    })

    const group = combineGroupPlacement(entries)

    if (!group.ok) {
      setSaving(false)
      const { reason, failed } = group
      if (!failed.isPrimary && (reason === 'conflict' || reason === 'roleMismatch')) {
        // Name the person: with several on one session, "the employee is
        // busy" would leave the receptionist guessing which one.
        setError(t(`appointments:formDialog.participant.${reason}Error`, { name: failed.employeeName }))
      } else {
        setError(t(PLACEMENT_ERROR_KEYS[reason]))
      }
      return
    }

    // Outside the shift is a question, not a refusal — unless it has already
    // been asked and answered by the "book provisionally" button. A session
    // can be mixed: whoever is on shift books outright, whoever is not is
    // held pending approval.
    if (group.outsideKeys.length > 0 && !asPending) {
      setSaving(false)
      setOutsideSchedule({
        names: group.outsideKeys
          .map((id) => (employees || []).find((e) => e.id === id)?.name || '')
          .filter(Boolean)
          .join('، '),
      })
      return
    }
    setOutsideSchedule(null)

    const outside = new Set(group.outsideKeys)
    const statusFor = (id) => (outside.has(id) ? 'pending_approval' : 'booked')

    // Converting fills in a row that already exists, so it updates in place
    // rather than inserting: the entry keeps its id and its created_at, and
    // "how long did this client wait?" stays answerable afterwards. The
    // function refuses if the entry stopped being `waiting` in the
    // meantime, which is what stops two devices converting the same one.
    if (isConverting) {
      const { data, error: saveError, kind, exhausted } = await attemptOnEachUnit(
        entries[0].plan.candidateUnits,
        (unit) => supabase.rpc('convert_waiting_appointment', {
          p_appointment_id: waitingAppointment.id,
          p_employee_id: employeeId,
          p_service_id: serviceId,
          p_start: start.toISOString(),
          p_end: end.toISOString(),
          p_provisional: outside.has(employeeId),
          p_resource_unit_id: unit ? unit.id : null,
          p_participants: extraEmployeeIds.filter(Boolean).map((id) => ({
            employee_id: id,
            provisional: outside.has(id),
          })),
        })
      )

      setSaving(false)

      if (saveError) {
        if (exhausted) setError(t('appointments:formDialog.allResourcesBusyError'))
        else if (kind === 'employee') setError(t('appointments:formDialog.conflictError'))
        else if (saveError.message?.includes('appointment_not_waiting')) {
          setError(t('appointments:formDialog.notWaitingError'))
        } else setError(t(reportDbError(saveError, 'convertWaitingAppointment')))
        return
      }
      if (!data) {
        setError(t('appointments:formDialog.noRowsError'))
        return
      }

      onSaved()
      onOpenChange(false)
      return
    }

    // The main professional's row carries its own id as group_id, which is
    // what makes the composite foreign key work without deferral: it exists
    // the moment the row does, and the others point at a row already there.
    const groupId = crypto.randomUUID()

    const groupRows = participantIds.map((id, index) => ({
      id: index === 0 ? groupId : crypto.randomUUID(),
      salon_id: salonId,
      client_id: client.id,
      service_id: serviceId,
      employee_id: id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: statusFor(id),
      note: note.trim() || null,
      group_id: groupId,
      is_primary: index === 0,
    }))

    // One insert for the whole session. Several rows in a single insert are
    // atomic in Postgres by nature — they all land or none do — so creating
    // a group needs no database function of its own, unlike cancelling or
    // rescheduling which have to update and insert together.
    const { data, error: saveError, kind, exhausted } = await attemptOnEachUnit(
      entries[0].plan.candidateUnits,
      (unit) => supabase
        .from('appointments')
        .insert(groupRows.map((row) => ({ ...row, resource_unit_id: row.is_primary && unit ? unit.id : null })))
        .select()
    )

    setSaving(false)

    if (saveError) {
      if (exhausted) setError(t('appointments:formDialog.allResourcesBusyError'))
      else if (kind === 'employee') setError(t('appointments:formDialog.conflictError'))
      else setError(t(reportDbError(saveError, 'createBooking')))
      return
    }
    if (!data || data.length !== groupRows.length) {
      setError(t('appointments:formDialog.noRowsError'))
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
            <DialogTitle>
              {isConverting ? t('appointments:formDialog.convertTitle') : t('appointments:formDialog.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t('appointments:formDialog.clientLabel')}</Label>
              {/* Fixed while converting: a different client would be a
                  different person's place in the queue, not this one. */}
              {isConverting ? (
                <div className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium">
                  {client ? `${client.first_name} ${client.last_name || ''}`.trim() : ''}
                </div>
              ) : (
                <Button type="button" variant="outline" className="justify-start" onClick={() => setPickerOpen(true)}>
                  {client ? `${client.first_name} ${client.last_name}` : t('appointments:formDialog.chooseClientButton')}
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('appointments:formDialog.serviceLabel')}</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
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

            {/* Meaningless while converting: this is the way out of the
                waiting list, not into it. */}
            <label className={`flex items-center gap-2 text-sm font-medium ${isConverting ? 'hidden' : ''}`}>
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

                {/* Extra professionals on the same session. Each one becomes
                    its own appointment row, so each one's time is protected
                    by the same constraint as the main professional's — a
                    four-hands massage genuinely occupies both of them. */}
                {extraEmployeeIds.map((extraId, index) => (
                  <div key={index} className="flex flex-col gap-1.5">
                    <Label>{t('appointments:formDialog.extraEmployeeLabel', { number: index + 2 })}</Label>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
                        value={extraId}
                        onChange={(e) => setExtraEmployeeIds((prev) => prev.map((v, i) => (i === index ? e.target.value : v)))}
                      >
                        <option value="">{t('appointments:formDialog.selectPlaceholder')}</option>
                        {eligibleExtras
                          .filter((emp) => emp.id === extraId || !extraEmployeeIds.includes(emp.id))
                          .map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name}{emp.is_assistant ? ` — ${t('employees:formDialog.isAssistantLabel')}` : ''}
                            </option>
                          ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        title={t('appointments:formDialog.removeExtraEmployeeTitle')}
                        onClick={() => setExtraEmployeeIds((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <X />
                      </Button>
                    </div>
                  </div>
                ))}

                {selectedService && eligibleExtras.some((emp) => !extraEmployeeIds.includes(emp.id)) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => setExtraEmployeeIds((prev) => [...prev, ''])}
                  >
                    <Plus />
                    {t('appointments:formDialog.addProfessionalButton')}
                  </Button>
                )}

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

          {outsideSchedule && (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              {t('appointments:formDialog.outsideScheduleWarning', { name: outsideSchedule.names })}
            </div>
          )}

          {error && <div className="text-sm text-destructive">{error}</div>}

          {/* The warning replaces the footer rather than adding to it: with
              "save" still sitting there, the answer to "book provisionally?"
              would have two yes buttons. */}
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
                  {saving
                    ? t('common:saving')
                    : isConverting
                    ? t('appointments:formDialog.convertButton')
                    : t('common:save')}
                </Button>
              </>
            )}
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
