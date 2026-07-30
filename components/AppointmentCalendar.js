import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import { useServiceCatalog } from '../hooks/useServiceCatalog'
import { useClientsLookup } from '../hooks/useClientsLookup'
import { useAppointments } from '../hooks/useAppointments'
import { useEmployeeSchedules } from '../hooks/useEmployeeSchedules'
import { useScheduleExceptions } from '../hooks/useScheduleExceptions'
import { useRoleBusinessTypes } from '../hooks/useRoleBusinessTypes'
import { useResources } from '../hooks/useResources'
import { useCancellationReasons } from '../hooks/useCancellationReasons'
import {
  buildTimeSlots,
  totalGridMinutes,
  slotStartTime,
  minutesFromGridStart,
  minutesToLabel,
  isWithinGrid,
  isSlotPast,
  resolveBookingStart,
  SLOT_MINUTES,
} from '../lib/appointmentGrid'
import { availableWindowsForDate, isWithinAnyWindow } from '../lib/employeeAvailability'
import { clusterAppointments } from '../lib/resourceAllocation'
import AppointmentFormDialog from './AppointmentFormDialog'
import AppointmentActionsDialog from './AppointmentActionsDialog'
import AppointmentClusterDialog from './AppointmentClusterDialog'
import ResourceBookingsDialog from './ResourceBookingsDialog'
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

  const { employees, loading: employeesLoading } = useEmployees()
  const { categories, services, loading: servicesLoading } = useServiceCatalog()
  const { clients, loading: clientsLoading } = useClientsLookup()
  const { dayAppointments, waitingAppointments, loading: apptsLoading, reload } = useAppointments(dateISO)
  const { schedulesByEmployee, loading: schedulesLoading } = useEmployeeSchedules()
  const { exceptionsByEmployee, loading: exceptionsLoading, reload: reloadExceptions } = useScheduleExceptions()
  const { roleBusinessTypes, loading: roleTypesLoading } = useRoleBusinessTypes()
  const { resources, units: resourceUnits, serviceResources, loading: resourcesLoading } = useResources()
  const { reasons: cancellationReasons, loading: cancellationReasonsLoading, reload: reloadCancellationReasons } = useCancellationReasons()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const loading = employeesLoading || servicesLoading || clientsLoading || apptsLoading || schedulesLoading || exceptionsLoading || roleTypesLoading || resourcesLoading
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
      map[emp.id] = availableWindowsForDate(entry?.schedule, entry?.slots, exceptionsByEmployee[emp.id], displayedDate)
    }
    return map
  }, [employees, schedulesByEmployee, exceptionsByEmployee, displayedDate])

  const isToday = dateISO === todayISO()
  const nowMinutes = isToday ? minutesFromGridStart(now) : -1
  const showNowLine = isToday && isWithinGrid(nowMinutes)

  const employeesById = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e])), [employees])
  const unitsById = useMemo(() => Object.fromEntries(resourceUnits.map((u) => [u.id, u])), [resourceUnits])

  function appointmentsForEmployee(employeeId) {
    return dayAppointments.filter((a) => a.employee_id === employeeId && a.status !== 'cancelled')
  }

  function appointmentsForResource(resourceId) {
    return dayAppointments.filter((a) => {
      if (a.status === 'cancelled' || !a.resource_unit_id) return false
      return unitsById[a.resource_unit_id]?.resource_id === resourceId
    })
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
        <Button onClick={() => setDialogState({})}>
          <Plus />
          {t('appointments:newAppointmentButton')}
        </Button>
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
                return (
                  <div
                    key={a.id}
                    className="rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                    style={{ borderInlineStartWidth: 3, borderInlineStartColor: service?.color || 'var(--color-muted-foreground)' }}
                    title={a.note || ''}
                  >
                    <div className="truncate font-medium">{clientName(clientsById, a.client_id)}</div>
                    <div className="truncate text-muted-foreground">{service?.name}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {employees.map((emp) => (
          <div key={emp.id} className="flex shrink-0 flex-col border-e border-border" style={{ width: 160 }}>
            {/* Two stacked cells, not one block: the role sits in its own
                tinted band above the name, separated by a real divider. */}
            <div className="sticky top-0 z-20 flex flex-col border-b border-border bg-card" style={{ height: HEADER_HEIGHT }}>
              <div className="flex flex-1 items-center justify-center overflow-hidden border-b border-border bg-primary/10 px-1">
                <span className="truncate text-[11px] leading-none text-primary/80">
                  {t(`employees:roles.${emp.role}`)}
                </span>
              </div>
              <div className="flex flex-1 items-center justify-center overflow-hidden px-1">
                <span className="truncate text-xs font-medium leading-none">{emp.name}</span>
              </div>
            </div>
            <div className="relative" style={{ height: gridHeight }}>
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

                if (past) {
                  return (
                    <div
                      key={s.minutesFromStart}
                      className="absolute inset-x-0 border-b border-border/50 bg-muted/60"
                      style={style}
                      title={t('appointments:pastSlotHint')}
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
                const Tag = actionable ? 'button' : 'div'
                return (
                  <Tag
                    key={a.id}
                    type={actionable ? 'button' : undefined}
                    className={`absolute inset-x-0.5 z-10 overflow-hidden rounded px-1 py-0.5 text-start text-[10px] leading-tight text-white ${
                      pending
                        ? 'border-2 border-dashed border-white/90 hover:brightness-110'
                        : actionable
                        ? 'hover:brightness-110'
                        : 'pointer-events-none'
                    }`}
                    style={{
                      top,
                      height,
                      backgroundColor: service?.color || 'var(--color-muted-foreground)',
                      backgroundImage: pending
                        ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.3) 0 4px, transparent 4px 10px)'
                        : undefined,
                    }}
                    title={
                      pending
                        ? `${t('appointments:pendingBlockHint')} — ${clientName(clientsById, a.client_id)}`
                        : `${clientName(clientsById, a.client_id)} — ${service?.name || ''}`
                    }
                    onClick={actionable ? () => setActionDetail(a) : undefined}
                  >
                    <div className="truncate font-medium">{clientName(clientsById, a.client_id)}</div>
                    <div className="truncate opacity-90">{service?.name}</div>
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
              <div className="sticky top-0 z-20 flex flex-col border-b border-border bg-card" style={{ height: HEADER_HEIGHT }}>
                <div className="flex flex-1 items-center justify-center overflow-hidden border-b border-border bg-primary/10 px-1">
                  <span className="truncate text-[11px] leading-none text-primary/80">
                    {t('appointments:resourceColumn.capacityLabel', { count: resource.capacity })}
                  </span>
                </div>
                <div className="flex flex-1 items-center justify-center overflow-hidden px-1">
                  <span className="truncate text-xs font-medium leading-none">{resource.name}</span>
                </div>
              </div>

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
        cancellationReasons={cancellationReasons}
        cancellationReasonsLoading={cancellationReasonsLoading}
        reloadCancellationReasons={reloadCancellationReasons}
        salonId={salonId}
        // Confirming writes a shift exception, and cancelling can remove
        // one — either way the day's windows have to be reloaded alongside
        // the bookings themselves.
        onDone={() => { reload(); reloadExceptions() }}
      />

      <AppointmentFormDialog
        open={!!dialogState}
        onOpenChange={(open) => { if (!open) setDialogState(null) }}
        salonId={salonId}
        initialEmployeeId={dialogState?.employeeId}
        initialStartTime={dialogState?.startTime}
        employees={employees}
        services={services}
        categories={categories}
        roleBusinessTypes={roleBusinessTypes}
        schedulesByEmployee={schedulesByEmployee}
        exceptionsByEmployee={exceptionsByEmployee}
        resources={resources}
        resourceUnits={resourceUnits}
        serviceResources={serviceResources}
        onSaved={reload}
      />
    </div>
  )
}
