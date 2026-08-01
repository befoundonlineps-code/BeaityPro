import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import { ChevronRight, ChevronLeft, Plus, Users, RotateCcw } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import { useServiceCatalog } from '../hooks/useServiceCatalog'
import { useClientsLookup } from '../hooks/useClientsLookup'
import { useAppointments } from '../hooks/useAppointments'
import { useEmployeeSchedules } from '../hooks/useEmployeeSchedules'
import { useScheduleExceptions } from '../hooks/useScheduleExceptions'
import { useRoleBusinessTypes } from '../hooks/useRoleBusinessTypes'
import { useResources } from '../hooks/useResources'
import { useCancellationReasons } from '../hooks/useCancellationReasons'
import { useAbsenceReasons } from '../hooks/useAbsenceReasons'
import { useDayStatus } from '../hooks/useDayStatus'
import { useRescheduleReasons } from '../hooks/useRescheduleReasons'
import { useAdjustmentReasons } from '../hooks/useAdjustmentReasons'
import {
  buildTimeSlots,
  totalGridMinutes,
  slotStartTime,
  minutesFromGridStart,
  minutesToLabel,
  isWithinGrid,
  isSlotPast,
  resolveBookingStart,
  dropTargetMinutes,
  SLOT_MINUTES,
} from '../lib/appointmentGrid'
import { availableWindowsForDate, isWithinAnyWindow } from '../lib/employeeAvailability'
import { clusterAppointments } from '../lib/resourceAllocation'
import AppointmentFormDialog from './AppointmentFormDialog'
import AppointmentActionsDialog from './AppointmentActionsDialog'
import AppointmentClusterDialog from './AppointmentClusterDialog'
import RescheduleDialog from './RescheduleDialog'
import RescheduleConfirmDialog from './RescheduleConfirmDialog'
import AdjustDurationDialog from './AdjustDurationDialog'
import ResourceBookingsDialog from './ResourceBookingsDialog'
import EmployeeDayDialog from './EmployeeDayDialog'
import ResourceDayDialog from './ResourceDayDialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const ROW_HEIGHT = 40 // px per 30-minute row
const HEADER_HEIGHT = 48 // fits the two-line employee header (role over name)

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftISO(dateISO, days) {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function clientName(clientsById, id) {
  const c = clientsById[id]
  return c ? `${c.first_name} ${c.last_name || ''}`.trim() : ''
}

export default function AppointmentCalendar({ salonId }) {
  const { t } = useTranslation(['appointments', 'employees', 'services', 'common'])
  const router = useRouter()
  const [dateISO, setDateISO] = useState(todayISO())
  const [now, setNow] = useState(new Date())
  const [dialogState, setDialogState] = useState(null) // null closed, {} blank, {employeeId,startTime} prefilled
  const [resourceDetail, setResourceDetail] = useState(null) // { resource, cluster }
  const [actionDetail, setActionDetail] = useState(null) // the pending/booked appointment being acted on
  const [employeeClusterDetail, setEmployeeClusterDetail] = useState(null) // { employee, cluster } — overlapping employee blocks
  const [rescheduleDetail, setRescheduleDetail] = useState(null) // the appointment being moved to a new date/time/employee
  const [adjustDetail, setAdjustDetail] = useState(null) // the running session whose real end is being recorded
  const [dragState, setDragState] = useState(null) // { appointment, grabOffsetY, durationMinutes } while a block is in hand
  const [dragOverEmployeeId, setDragOverEmployeeId] = useState(null)
  const [dropTarget, setDropTarget] = useState(null) // { appointment, employeeId, start } awaiting confirmation
  // Assistant columns are hidden by default — the calendar reads as the
  // roster of people who take their own appointments; a helper only shows
  // up here when someone deliberately asks to book one directly.
  const [showAssistants, setShowAssistants] = useState(false)
  // Whose standing is being looked at. A column header is the natural place
  // to ask "is this person in today?" — it already names exactly one person,
  // and the calendar already knows which day is on screen, so neither has to
  // be picked a second time.
  const [dayStatusEmployee, setDayStatusEmployee] = useState(null)
  const [dayStatusResource, setDayStatusResource] = useState(null)

  const { employees, loading: employeesLoading } = useEmployees()
  const { categories, services, loading: servicesLoading } = useServiceCatalog()
  const { clients, loading: clientsLoading } = useClientsLookup()
  const { dayAppointments, waitingAppointments, releaseOriginsById, loading: apptsLoading, reload } = useAppointments(dateISO)
  const { schedulesByEmployee, loading: schedulesLoading } = useEmployeeSchedules()
  const { exceptionsByEmployee, loading: exceptionsLoading, reload: reloadExceptions } = useScheduleExceptions()
  const { roleBusinessTypes, loading: roleTypesLoading } = useRoleBusinessTypes()
  const { resources, units: resourceUnits, serviceResources, loading: resourcesLoading } = useResources()
  const { reasons: cancellationReasons, loading: cancellationReasonsLoading, reload: reloadCancellationReasons } = useCancellationReasons()
  const { reasons: absenceReasons, loading: absenceReasonsLoading, reload: reloadAbsenceReasons } = useAbsenceReasons()
  const { absencesByEmployee, outagesByUnit, loading: dayStatusLoading, reload: reloadDayStatus } = useDayStatus()
  const { reasons: rescheduleReasons, loading: rescheduleReasonsLoading, reload: reloadRescheduleReasons } = useRescheduleReasons()
  const { reasons: adjustmentReasons, loading: adjustmentReasonsLoading, reload: reloadAdjustmentReasons } = useAdjustmentReasons()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const loading = employeesLoading || servicesLoading || clientsLoading || apptsLoading || schedulesLoading || exceptionsLoading || roleTypesLoading || resourcesLoading || rescheduleReasonsLoading || adjustmentReasonsLoading || dayStatusLoading
  const slots = buildTimeSlots()
  const gridMinutes = totalGridMinutes()
  const gridHeight = (gridMinutes / SLOT_MINUTES) * ROW_HEIGHT

  const clientsById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients])
  const servicesById = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services])

  const displayedDate = useMemo(() => new Date(`${dateISO}T00:00:00`), [dateISO])
  const windowsByEmployee = useMemo(() => {
    const map = {}
    for (const emp of employees) {
      const entry = schedulesByEmployee[emp.id]
      map[emp.id] = availableWindowsForDate(
        entry?.schedule,
        entry?.slots,
        exceptionsByEmployee[emp.id],
        displayedDate,
        absencesByEmployee[emp.id]
      )
    }
    return map
  }, [employees, schedulesByEmployee, exceptionsByEmployee, displayedDate, absencesByEmployee])

  // The absence row for the day on screen, per employee — what the header
  // shows and what turns the column into a wall.
  const absenceToday = useMemo(() => {
    const map = {}
    for (const emp of employees) {
      map[emp.id] = (absencesByEmployee[emp.id] || []).find((a) => a.absence_date === dateISO) || null
    }
    return map
  }, [employees, absencesByEmployee, dateISO])

  const absenceReasonsById = useMemo(
    () => Object.fromEntries((absenceReasons || []).map((r) => [r.id, r])),
    [absenceReasons]
  )

  const cancellationReasonsById = useMemo(
    () => Object.fromEntries((cancellationReasons || []).map((r) => [r.id, r])),
    [cancellationReasons]
  )

  // Where a waiting entry came from, ready to show: the slot it lost and who
  // it was with.
  //
  // The reason shown is the coarse one recorded against the booking — "the
  // professional was absent" — and deliberately not the absence's own reason.
  // What the receptionist needs before she picks up the phone is why this
  // client was moved; that her colleague is unwell is staff information, and
  // it has no business travelling into that call.
  function releaseOrigin(waitingRow) {
    const origin = waitingRow.released_from_id ? releaseOriginsById[waitingRow.released_from_id] : null
    if (!origin || !origin.start_time) return null
    const at = new Date(origin.start_time)
    return {
      time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
      employeeName: employeesById[origin.employee_id]?.name || '',
      reasonName: cancellationReasonsById[origin.cancellation_reason_id]?.name || '',
    }
  }

  const isToday = dateISO === todayISO()
  const nowMinutes = isToday ? minutesFromGridStart(now) : -1
  const showNowLine = isToday && isWithinGrid(nowMinutes)

  const employeesById = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])
  const unitsById = useMemo(() => Object.fromEntries(resourceUnits.map((u) => [u.id, u])), [resourceUnits])

  // Hiding is display-only: an assistant's column disappears, but the
  // employee is still fully bookable as an added professional on someone
  // else's session, and this list is what the toggle button reveals.
  const hasAssistants = employees.some((e) => e.is_assistant)
  const visibleEmployees = showAssistants ? employees : employees.filter((e) => !e.is_assistant)

  // A row that has been superseded — rescheduled to another time, or
  // adjusted to a different end — keeps its original span forever. It is
  // history, not a slot still on the board, so it stays hidden here exactly
  // like a cancelled one and only surfaces through superseded_by_id.
  const isHistorical = (a) => a.status === 'cancelled' || a.status === 'rescheduled' || a.status === 'adjusted'

  function appointmentsForEmployee(employeeId) {
    return dayAppointments.filter((a) => a.employee_id === employeeId && !isHistorical(a))
  }

  // The other rows on the same session. The adjust dialog needs them whole —
  // every participant's end moves together, so every participant's
  // availability has to be checked.
  function groupMembers(appointment) {
    if (!appointment) return []
    return dayAppointments
      .filter((a) => a.group_id === appointment.group_id && a.id !== appointment.id && !isHistorical(a))
      .map((a) => ({ ...a, employeeName: employeesById[a.employee_id]?.name || '' }))
  }

  // The same session including the row that was clicked. The actions dialog
  // lists it as a roster, so it has to read the same whether the receptionist
  // opened the primary's block or an assistant's — and removing somebody
  // means finding them in that list either way.
  function sessionMembers(appointment) {
    if (!appointment) return []
    return dayAppointments
      .filter((a) => a.group_id === appointment.group_id && !isHistorical(a))
      .map((a) => ({ ...a, employeeName: employeesById[a.employee_id]?.name || '' }))
  }

  // How many of a resource's units are down on the day shown, which is what
  // its header reports instead of the capacity.
  function outUnitCount(resourceId) {
    return resourceUnits.filter(
      (u) => u.resource_id === resourceId
        && ((outagesByUnit[u.id] || []).some((o) => o.outage_date === dateISO))
    ).length
  }

  function appointmentsForResource(resourceId) {
    return dayAppointments.filter((a) => {
      if (isHistorical(a) || !a.resource_unit_id) return false
      return unitsById[a.resource_unit_id]?.resource_id === resourceId
    })
  }

  function handleDragStart(event, appointment) {
    const rect = event.currentTarget.getBoundingClientRect()
    setDragState({
      appointment,
      grabOffsetY: event.clientY - rect.top,
      durationMinutes: (new Date(appointment.end_time) - new Date(appointment.start_time)) / 60000,
    })
    event.dataTransfer.effectAllowed = 'move'
    // Firefox refuses to start a drag unless some data is carried.
    event.dataTransfer.setData('text/plain', appointment.id)
  }

  function handleDragEnd() {
    setDragState(null)
    setDragOverEmployeeId(null)
  }

  // dragover/drop bubble up from the slot cells and blocks inside, so the
  // column body hears them without any of its children needing to opt out
  // of pointer events. currentTarget is always this container, which is
  // what the drop offset has to be measured against.
  function handleDrop(event, employee) {
    event.preventDefault()
    if (!dragState) return

    const rect = event.currentTarget.getBoundingClientRect()
    const minutes = dropTargetMinutes({
      pointerOffsetY: event.clientY - rect.top,
      grabOffsetY: dragState.grabOffsetY,
      rowHeight: ROW_HEIGHT,
      durationMinutes: dragState.durationMinutes,
    })
    const start = slotStartTime(dateISO, minutes)
    const { appointment } = dragState

    setDragState(null)
    setDragOverEmployeeId(null)

    // Picked up and put back exactly where it was: nothing moved, so no
    // history entry should be written for it.
    if (employee.id === appointment.employee_id && start.getTime() === new Date(appointment.start_time).getTime()) {
      return
    }

    setDropTarget({ appointment, employeeId: employee.id, start })
  }

  function handleCellClick(employeeId, minutesFromStart) {
    // Prefill what will actually be booked: a slot already under way starts
    // from this moment, not from the boundary drawn on the grid. Save
    // re-derives it against a fresh clock.
    const slotStart = slotStartTime(dateISO, minutesFromStart)
    setDialogState({ employeeId, startTime: resolveBookingStart(slotStart, new Date()) || slotStart })
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">{t('common:loading')}</div>
  }

  if (employees.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 p-6">
          <div className="font-medium">{t('appointments:noEmployeesTitle')}</div>
          <p className="text-sm text-muted-foreground">{t('appointments:noEmployeesMessage')}</p>
          <Button onClick={() => router.push('/employees')}>{t('appointments:goToEmployeesButton')}</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => setDateISO(shiftISO(dateISO, -1))} title={t('appointments:prevDayTitle')}>
            <ChevronRight />
          </Button>
          <Input type="date" className="w-auto" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
          <Button variant="outline" size="sm" onClick={() => setDateISO(todayISO())}>{t('appointments:todayButton')}</Button>
          <Button variant="outline" size="icon-sm" onClick={() => setDateISO(shiftISO(dateISO, 1))} title={t('appointments:nextDayTitle')}>
            <ChevronLeft />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {hasAssistants && (
            <Button
              variant={showAssistants ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowAssistants((v) => !v)}
            >
              <Users />
              {showAssistants ? t('appointments:hideAssistantsButton') : t('appointments:showAssistantsButton')}
            </Button>
          )}
          <Button onClick={() => setDialogState({})}>
            <Plus />
            {t('appointments:newAppointmentButton')}
          </Button>
        </div>
      </div>

      {/* Both scrollbars belong to this box, not the page, so the horizontal
          one stays on screen at any vertical position instead of sitting
          below a full day's worth of rows. */}
      {/* items-start matters: without it each column is stretched to the
          scrollport height rather than its own content height, and a sticky
          header cannot outlive its containing block — so the headers would
          scroll away once past that point. */}
      <div
        className="flex items-start overflow-auto rounded-lg border border-border"
        style={{ height: 'calc(100vh - 16rem)', minHeight: 360 }}
      >
        <div className="sticky start-0 z-30 flex shrink-0 flex-col bg-card" style={{ width: 56 }}>
          <div
            className="sticky top-0 z-40 flex items-center justify-center border-b border-border bg-card text-[11px] text-muted-foreground"
            style={{ height: HEADER_HEIGHT }}
          />
          {slots.map((s) => (
            <div
              key={s.minutesFromStart}
              className="flex items-start justify-center border-b border-border/50 pt-0.5 text-[11px] text-muted-foreground"
              style={{ height: ROW_HEIGHT }}
            >
              {s.label}
            </div>
          ))}
        </div>

        <div className="flex shrink-0 flex-col border-e border-border bg-muted/20" style={{ width: 180 }}>
          <div
            className="sticky top-0 z-20 flex items-center justify-center border-b border-border bg-card text-xs font-medium"
            style={{ height: HEADER_HEIGHT }}
          >
            {t('appointments:waitingListColumn')}
          </div>
          {/* Explicit height keeps this column the same length as the grid
              ones now that they size to their content. */}
          <div className="flex flex-col gap-1.5 overflow-y-auto p-1.5" style={{ height: gridHeight }}>
            {waitingAppointments.length === 0 ? (
              <div className="p-2 text-center text-xs text-muted-foreground">{t('appointments:waitingListEmpty')}</div>
            ) : (
              waitingAppointments.map((a) => {
                const service = servicesById[a.service_id]
                // An entry that lost a real slot, rather than one that never
                // had one. Without this the two look identical, and the
                // receptionist phones a client back with no idea what she is
                // apologising for.
                const origin = releaseOrigin(a)
                return (
                  <button
                    key={a.id}
                    type="button"
                    className="rounded-md border border-border bg-card px-2 py-1.5 text-start text-xs hover:bg-muted"
                    style={{ borderInlineStartWidth: 3, borderInlineStartColor: service?.color || 'var(--color-muted-foreground)' }}
                    // The reason leads the tooltip: the third line already
                    // carries the slot and the name, which is what she reads
                    // at a glance, so hovering is for the "why".
                    title={[
                      origin?.reasonName || null,
                      a.note || null,
                      t('appointments:waitingListConvertHint'),
                    ].filter(Boolean).join(' — ')}
                    // Opens the booking dialog in conversion mode, carrying
                    // the client along so it can be shown without a lookup.
                    onClick={() => setDialogState({ waitingAppointment: { ...a, client: clientsById[a.client_id] || null } })}
                  >
                    <div className="truncate font-medium">{clientName(clientsById, a.client_id)}</div>
                    <div className="truncate text-muted-foreground">{service?.name}</div>
                    {origin && (
                      <div className="mt-0.5 flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <RotateCcw className="size-3 shrink-0" />
                        <span className="truncate">
                          {origin.employeeName
                            ? t('appointments:waitingListReleasedFrom', { time: origin.time, name: origin.employeeName })
                            : t('appointments:waitingListReleasedFromTimeOnly', { time: origin.time })}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {visibleEmployees.map((emp) => (
          <div key={emp.id} className="flex shrink-0 flex-col border-e border-border" style={{ width: 160 }}>
            {/* Two stacked cells, not one block: the role sits in its own
                tinted band above the name, separated by a real divider.

                When she is off, the absence takes that band over rather than
                claiming a third line — the header is 48px on every day of the
                year, and a rare state should not cost every other day
                vertical space. The role is static information that comes back
                tomorrow; "sick leave" is not, and the colour shift makes it
                scannable across every column at once. */}
            <button
              type="button"
              className="sticky top-0 z-20 flex flex-col border-b border-border bg-card text-start hover:brightness-95"
              style={{ height: HEADER_HEIGHT }}
              title={t('appointments:dayStatus.employeeHeaderHint')}
              onClick={() => setDayStatusEmployee(emp)}
            >
              <div
                className={`flex flex-1 items-center justify-center overflow-hidden border-b border-border px-1 ${
                  absenceToday[emp.id] ? 'bg-amber-500/20' : 'bg-primary/10'
                }`}
              >
                <span
                  className={`truncate text-[11px] leading-none ${
                    absenceToday[emp.id] ? 'text-amber-700 dark:text-amber-400' : 'text-primary/80'
                  }`}
                >
                  {absenceToday[emp.id]
                    ? absenceReasonsById[absenceToday[emp.id].absence_reason_id]?.name || ''
                    : t(`employees:roles.${emp.role}`)}
                </span>
              </div>
              <div className="flex w-full flex-1 items-center justify-center overflow-hidden px-1">
                <span className="truncate text-xs font-medium leading-none">{emp.name}</span>
              </div>
            </button>
            <div
              className={`relative ${dragOverEmployeeId === emp.id ? 'bg-primary/5 ring-2 ring-inset ring-primary/40' : ''}`}
              style={{ height: gridHeight }}
              onDragOver={(event) => {
                if (!dragState) return
                event.preventDefault() // without this the drop is never allowed
                event.dataTransfer.dropEffect = 'move'
                setDragOverEmployeeId(emp.id)
              }}
              onDragLeave={() => setDragOverEmployeeId((current) => (current === emp.id ? null : current))}
              onDrop={(event) => handleDrop(event, emp)}
            >
              {slots.map((s) => {
                const cellEndLabel = minutesToLabel(s.minutesFromStart + SLOT_MINUTES)
                const past = isSlotPast(slotStartTime(dateISO, s.minutesFromStart + SLOT_MINUTES), now)
                // Outside the shift is no longer a wall: the slot stays
                // shaded so it still reads as unusual, but it opens the
                // dialog, which is where the provisional-booking question
                // gets asked. Time that has already passed stays closed —
                // that one is not a judgement call.
                const withinShift = isWithinAnyWindow(windowsByEmployee[emp.id], s.label, cellEndLabel)
                const style = { top: (s.minutesFromStart / SLOT_MINUTES) * ROW_HEIGHT, height: ROW_HEIGHT }
                // Repeat the hour inside every column so the eye can track time
                // while scanning sideways, without going back to the left rail.
                const hourMark = s.minutesFromStart % 60 === 0 ? (
                  <span className="pointer-events-none absolute start-1 top-0.5 text-[10px] leading-none text-primary/30">
                    {s.label}
                  </span>
                ) : null

                // An absence is a wall, not a question. Outside the shift is
                // negotiable — she is around and might agree — but "not here
                // today" leaves nobody to ask, so the cell stops offering the
                // provisional-booking dialog the way a past slot does.
                if (past || absenceToday[emp.id]) {
                  return (
                    <div
                      key={s.minutesFromStart}
                      className="absolute inset-x-0 border-b border-border/50 bg-muted/60"
                      style={style}
                      title={t(absenceToday[emp.id] && !past
                        ? 'appointments:dayStatus.absentCellHint'
                        : 'appointments:pastSlotHint')}
                    >
                      {hourMark}
                    </div>
                  )
                }
                return (
                  <button
                    key={s.minutesFromStart}
                    type="button"
                    className={
                      withinShift
                        ? 'absolute inset-x-0 border-b border-border/50 hover:bg-muted/40'
                        : 'absolute inset-x-0 border-b border-border/50 bg-muted/60 hover:bg-muted/80'
                    }
                    style={style}
                    title={withinShift ? undefined : t('appointments:outsideScheduleHint')}
                    onClick={() => handleCellClick(emp.id, s.minutesFromStart)}
                  >
                    {hourMark}
                  </button>
                )
              })}

              {/* Almost every cluster holds exactly one appointment and
                  renders exactly as before. More than one only happens when
                  a no_show and a live booking land on the same slot — the
                  only overlap the database allows, since booked/completed/
                  pending_approval can never overlap each other for the same
                  employee. That case gets one merged block that opens a
                  picker instead of guessing which appointment you meant. */}
              {clusterAppointments(appointmentsForEmployee(emp.id)).map((cluster) => {
                const clampedStart = Math.max(minutesFromGridStart(cluster.start), 0)
                const clampedEnd = Math.min(minutesFromGridStart(cluster.end), gridMinutes)
                if (clampedEnd <= clampedStart) return null
                const top = (clampedStart / SLOT_MINUTES) * ROW_HEIGHT
                const height = ((clampedEnd - clampedStart) / SLOT_MINUTES) * ROW_HEIGHT

                if (cluster.items.length > 1) {
                  return (
                    <button
                      key={`cluster-${emp.id}-${cluster.start.getTime()}`}
                      type="button"
                      className="absolute inset-x-0.5 z-10 overflow-hidden rounded px-1 py-0.5 text-start text-[10px] leading-tight text-white hover:brightness-110"
                      style={{ top, height, background: 'var(--color-primary)' }}
                      onClick={() => setEmployeeClusterDetail({ employee: emp, cluster })}
                    >
                      <div className="truncate font-medium">{t('appointments:employeeCluster.blockLabel')}</div>
                      <div className="truncate opacity-90">
                        {t('appointments:employeeCluster.blockCount', { count: cluster.items.length })}
                      </div>
                    </button>
                  )
                }

                const a = cluster.items[0]
                const service = servicesById[a.service_id]
                // A provisional booking keeps its service colour — it is a
                // real hold on the slot — but wears a dashed edge and a
                // hatch so it never reads as settled. A confirmed booking is
                // solid, but now opens the same actions dialog (cancel /
                // didn't-show); completed, cancelled and no-show blocks stay
                // inert since this dialog offers them nothing to do.
                const pending = a.status === 'pending_approval'
                const actionable = pending || a.status === 'booked'
                const beingDragged = dragState?.appointment.id === a.id
                // An added professional's row is a full booking holding its
                // own slot, so it draws at full size — the calendar answers
                // "is this person busy?", and the answer is yes either way.
                // It is only toned down and labelled so the main
                // professional's row stays the one that reads first.
                const isParticipant = a.is_primary === false
                const Tag = actionable ? 'button' : 'div'
                return (
                  <Tag
                    key={a.id}
                    type={actionable ? 'button' : undefined}
                    // Only a booking that can still be acted on can be moved,
                    // the same rule that decides whether it opens a dialog.
                    draggable={actionable}
                    onDragStart={actionable ? (event) => handleDragStart(event, a) : undefined}
                    onDragEnd={actionable ? handleDragEnd : undefined}
                    className={`absolute inset-x-0.5 z-10 overflow-hidden rounded px-1 py-0.5 text-start text-[10px] leading-tight text-white ${
                      pending
                        ? 'border-2 border-dashed border-white/90 hover:brightness-110'
                        : actionable
                        ? 'hover:brightness-110'
                        : 'pointer-events-none'
                    } ${actionable ? 'cursor-grab active:cursor-grabbing' : ''} ${
                      beingDragged ? 'opacity-40' : isParticipant ? 'opacity-70' : ''
                    }`}
                    style={{
                      top,
                      height,
                      backgroundColor: service?.color || 'var(--color-muted-foreground)',
                      backgroundImage: pending
                        ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0 4px, transparent 4px 10px)'
                        : undefined,
                    }}
                    title={[
                      isParticipant ? t('appointments:participantBlockHint') : null,
                      pending ? t('appointments:pendingBlockHint') : null,
                      clientName(clientsById, a.client_id),
                      service?.name || null,
                    ].filter(Boolean).join(' — ')}
                    onClick={actionable ? () => setActionDetail(a) : undefined}
                  >
                    <div className="truncate font-medium">{clientName(clientsById, a.client_id)}</div>
                    <div className="truncate opacity-90">{service?.name}</div>
                    {isParticipant && (
                      <span className="pointer-events-none absolute bottom-0.5 end-1 rounded bg-black/30 px-1 text-[9px] leading-tight">
                        {t('appointments:participantBadge')}
                      </span>
                    )}
                  </Tag>
                )
              })}

              {showNowLine && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[15] h-0.5 bg-destructive"
                  style={{ top: (nowMinutes / SLOT_MINUTES) * ROW_HEIGHT }}
                />
              )}
            </div>
          </div>
        ))}

        {/* Resource columns are a read-only mirror: bookings land here
            automatically when a resource-linked service is booked from an
            employee column, so these cells are inert by design. */}
        {resources.map((resource) => {
          const clusters = clusterAppointments(appointmentsForResource(resource.id))
          return (
            <div key={resource.id} className="flex shrink-0 flex-col border-e border-border bg-muted/10" style={{ width: 160 }}>
              {/* The cells below stay inert — a resource cannot answer "who
                  performs this?" — but the header is a different question,
                  and it is the only place to ask whether the machine works
                  today. */}
              <button
                type="button"
                className="sticky top-0 z-20 flex flex-col border-b border-border bg-card text-start hover:brightness-95"
                style={{ height: HEADER_HEIGHT }}
                title={t('appointments:dayStatus.resourceHeaderHint')}
                onClick={() => setDayStatusResource(resource)}
              >
                <div
                  className={`flex w-full flex-1 items-center justify-center overflow-hidden border-b border-border px-1 ${
                    outUnitCount(resource.id) > 0 ? 'bg-amber-500/20' : 'bg-primary/10'
                  }`}
                >
                  <span
                    className={`truncate text-[11px] leading-none ${
                      outUnitCount(resource.id) > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-primary/80'
                    }`}
                  >
                    {outUnitCount(resource.id) > 0
                      ? t('appointments:dayStatus.unitsOutLabel', {
                          out: outUnitCount(resource.id),
                          total: resource.capacity,
                        })
                      : t('appointments:resourceColumn.capacityLabel', { count: resource.capacity })}
                  </span>
                </div>
                <div className="flex w-full flex-1 items-center justify-center overflow-hidden px-1">
                  <span className="truncate text-xs font-medium leading-none">{resource.name}</span>
                </div>
              </button>

              <div className="relative" style={{ height: gridHeight }}>
                {slots.map((s) => (
                  <div
                    key={s.minutesFromStart}
                    className="absolute inset-x-0 border-b border-border/50"
                    style={{ top: (s.minutesFromStart / SLOT_MINUTES) * ROW_HEIGHT, height: ROW_HEIGHT }}
                  >
                    {s.minutesFromStart % 60 === 0 && (
                      <span className="pointer-events-none absolute start-1 top-0.5 text-[10px] leading-none text-primary/30">
                        {s.label}
                      </span>
                    )}
                  </div>
                ))}

                {clusters.map((cluster) => {
                  const clampedStart = Math.max(minutesFromGridStart(cluster.start), 0)
                  const clampedEnd = Math.min(minutesFromGridStart(cluster.end), gridMinutes)
                  if (clampedEnd <= clampedStart) return null
                  const single = cluster.items.length === 1
                  const service = single ? servicesById[cluster.items[0].service_id] : null
                  return (
                    <button
                      key={`${resource.id}-${cluster.start.getTime()}`}
                      type="button"
                      className="absolute inset-x-0.5 z-10 overflow-hidden rounded px-1 py-0.5 text-start text-[10px] leading-tight text-white hover:opacity-90"
                      style={{
                        top: (clampedStart / SLOT_MINUTES) * ROW_HEIGHT,
                        height: ((clampedEnd - clampedStart) / SLOT_MINUTES) * ROW_HEIGHT,
                        background: single ? service?.color || 'var(--color-muted-foreground)' : 'var(--color-primary)',
                      }}
                      onClick={() => setResourceDetail({ resource, cluster })}
                    >
                      {single ? (
                        <>
                          <div className="truncate font-medium">{clientName(clientsById, cluster.items[0].client_id)}</div>
                          <div className="truncate opacity-90">{service?.name}</div>
                        </>
                      ) : (
                        <>
                          <div className="truncate font-medium">{t('appointments:resourceColumn.bookedBlock')}</div>
                          <div className="truncate opacity-90">
                            {t('appointments:resourceColumn.bookedCount', { count: cluster.items.length })}
                          </div>
                        </>
                      )}
                    </button>
                  )
                })}

                {showNowLine && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[15] h-0.5 bg-destructive"
                    style={{ top: (nowMinutes / SLOT_MINUTES) * ROW_HEIGHT }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <ResourceBookingsDialog
        open={!!resourceDetail}
        onOpenChange={(open) => { if (!open) setResourceDetail(null) }}
        resource={resourceDetail?.resource}
        cluster={resourceDetail?.cluster}
        unitsById={unitsById}
        employeesById={employeesById}
        clientsById={clientsById}
        servicesById={servicesById}
      />

      <AppointmentClusterDialog
        open={!!employeeClusterDetail}
        onOpenChange={(open) => { if (!open) setEmployeeClusterDetail(null) }}
        employee={employeeClusterDetail?.employee}
        cluster={employeeClusterDetail?.cluster}
        clientsById={clientsById}
        servicesById={servicesById}
        // Sequential, not stacked: the picker closes itself, then the usual
        // actions dialog opens for the one appointment that was picked.
        onPick={(a) => { setEmployeeClusterDetail(null); setActionDetail(a) }}
      />

      <AppointmentActionsDialog
        open={!!actionDetail}
        onOpenChange={(open) => { if (!open) setActionDetail(null) }}
        appointment={actionDetail}
        employee={actionDetail ? employeesById[actionDetail.employee_id] : null}
        clientName={actionDetail ? clientName(clientsById, actionDetail.client_id) : ''}
        serviceName={actionDetail ? servicesById[actionDetail.service_id]?.name : ''}
        sessionMembers={sessionMembers(actionDetail)}
        cancellationReasons={cancellationReasons}
        cancellationReasonsLoading={cancellationReasonsLoading}
        reloadCancellationReasons={reloadCancellationReasons}
        salonId={salonId}
        // Sequential, not stacked: this dialog closes itself before handing
        // the appointment off to the reschedule dialog.
        onReschedule={(a) => setRescheduleDetail(a)}
        onAdjustDuration={(a) => setAdjustDetail(a)}
        // Confirming writes a shift exception, and cancelling can remove
        // one — either way the day's windows have to be reloaded alongside
        // the bookings themselves.
        onDone={() => { reload(); reloadExceptions() }}
      />

      <RescheduleDialog
        open={!!rescheduleDetail}
        onOpenChange={(open) => { if (!open) setRescheduleDetail(null) }}
        appointment={rescheduleDetail}
        service={rescheduleDetail ? servicesById[rescheduleDetail.service_id] : null}
        clientName={rescheduleDetail ? clientName(clientsById, rescheduleDetail.client_id) : ''}
        employees={employees}
        services={services}
        categories={categories}
        roleBusinessTypes={roleBusinessTypes}
        schedulesByEmployee={schedulesByEmployee}
        exceptionsByEmployee={exceptionsByEmployee}
        absencesByEmployee={absencesByEmployee}
        resources={resources}
        resourceUnits={resourceUnits}
        serviceResources={serviceResources}
        rescheduleReasons={rescheduleReasons}
        rescheduleReasonsLoading={rescheduleReasonsLoading}
        reloadRescheduleReasons={reloadRescheduleReasons}
        salonId={salonId}
        // The old row becomes a rescheduled history entry and may have shed
        // a shift exception, exactly like confirming and cancelling do.
        onDone={() => { reload(); reloadExceptions() }}
      />

      <AdjustDurationDialog
        open={!!adjustDetail}
        onOpenChange={(open) => { if (!open) setAdjustDetail(null) }}
        appointment={adjustDetail}
        service={adjustDetail ? servicesById[adjustDetail.service_id] : null}
        clientName={adjustDetail ? clientName(clientsById, adjustDetail.client_id) : ''}
        groupMembers={groupMembers(adjustDetail)}
        adjustmentReasons={adjustmentReasons}
        adjustmentReasonsLoading={adjustmentReasonsLoading}
        reloadAdjustmentReasons={reloadAdjustmentReasons}
        salonId={salonId}
        // The old rows become adjusted history and may carry a shift
        // exception across to the new ones, so windows reload too.
        onDone={() => { reload(); reloadExceptions() }}
      />

      {/* Where a drag lands. Resource columns carry no drop handlers at
          all, so they simply never accept one — a resource cannot answer
          "who performs this?", and it follows the booking rather than
          being something you drag onto. */}
      <RescheduleConfirmDialog
        open={!!dropTarget}
        onOpenChange={(open) => { if (!open) setDropTarget(null) }}
        target={dropTarget}
        service={dropTarget ? servicesById[dropTarget.appointment.service_id] : null}
        clientName={dropTarget ? clientName(clientsById, dropTarget.appointment.client_id) : ''}
        fromEmployee={dropTarget ? employeesById[dropTarget.appointment.employee_id] : null}
        employees={employees}
        services={services}
        categories={categories}
        roleBusinessTypes={roleBusinessTypes}
        schedulesByEmployee={schedulesByEmployee}
        exceptionsByEmployee={exceptionsByEmployee}
        absencesByEmployee={absencesByEmployee}
        resources={resources}
        resourceUnits={resourceUnits}
        serviceResources={serviceResources}
        rescheduleReasons={rescheduleReasons}
        onDone={() => { reload(); reloadExceptions() }}
      />

      <EmployeeDayDialog
        open={!!dayStatusEmployee}
        onOpenChange={(open) => { if (!open) setDayStatusEmployee(null) }}
        employee={dayStatusEmployee}
        dateISO={dateISO}
        absence={dayStatusEmployee ? absenceToday[dayStatusEmployee.id] : null}
        absenceReasons={absenceReasons}
        absenceReasonsLoading={absenceReasonsLoading}
        reloadAbsenceReasons={reloadAbsenceReasons}
        salonId={salonId}
        clientsById={clientsById}
        servicesById={servicesById}
        employeesById={employeesById}
        // Marking somebody off cancels sessions, which drops the shift
        // exceptions those confirmations had written — the same reload the
        // single-booking path already does, plus the absence itself.
        onDone={() => { reload(); reloadExceptions(); reloadDayStatus() }}
      />

      <ResourceDayDialog
        open={!!dayStatusResource}
        onOpenChange={(open) => { if (!open) setDayStatusResource(null) }}
        resource={dayStatusResource}
        units={resourceUnits}
        outagesByUnit={outagesByUnit}
        dateISO={dateISO}
        clientsById={clientsById}
        servicesById={servicesById}
        employeesById={employeesById}
        onDone={() => { reload(); reloadExceptions(); reloadDayStatus() }}
      />

      <AppointmentFormDialog
        open={!!dialogState}
        onOpenChange={(open) => { if (!open) setDialogState(null) }}
        salonId={salonId}
        initialEmployeeId={dialogState?.employeeId}
        initialStartTime={dialogState?.startTime}
        waitingAppointment={dialogState?.waitingAppointment}
        employees={employees}
        services={services}
        categories={categories}
        roleBusinessTypes={roleBusinessTypes}
        schedulesByEmployee={schedulesByEmployee}
        exceptionsByEmployee={exceptionsByEmployee}
        absencesByEmployee={absencesByEmployee}
        resources={resources}
        resourceUnits={resourceUnits}
        serviceResources={serviceResources}
        onSaved={reload}
      />
    </div>
  )
}
