import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react'
import { useEmployees } from '../hooks/useEmployees'
import { useServiceCatalog } from '../hooks/useServiceCatalog'
import { useClientsLookup } from '../hooks/useClientsLookup'
import { useAppointments } from '../hooks/useAppointments'
import { useEmployeeSchedules } from '../hooks/useEmployeeSchedules'
import { useRoleBusinessTypes } from '../hooks/useRoleBusinessTypes'
import { useResources } from '../hooks/useResources'
import {
  buildTimeSlots,
  totalGridMinutes,
  slotStartTime,
  minutesFromGridStart,
  minutesToLabel,
  isWithinGrid,
  SLOT_MINUTES,
} from '../lib/appointmentGrid'
import { availableWindowForDate, isWithinWindow } from '../lib/employeeAvailability'
import AppointmentFormDialog from './AppointmentFormDialog'
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

  const { employees, loading: employeesLoading } = useEmployees()
  const { categories, services, loading: servicesLoading } = useServiceCatalog()
  const { clients, loading: clientsLoading } = useClientsLookup()
  const { dayAppointments, waitingAppointments, loading: apptsLoading, reload } = useAppointments(dateISO)
  const { schedulesByEmployee, loading: schedulesLoading } = useEmployeeSchedules()
  const { roleBusinessTypes, loading: roleTypesLoading } = useRoleBusinessTypes()
  const { resources, units: resourceUnits, serviceResources, loading: resourcesLoading } = useResources()

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const loading = employeesLoading || servicesLoading || clientsLoading || apptsLoading || schedulesLoading || roleTypesLoading || resourcesLoading
  const slots = buildTimeSlots()
  const gridMinutes = totalGridMinutes()
  const gridHeight = (gridMinutes / SLOT_MINUTES) * ROW_HEIGHT

  const clientsById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients])
  const servicesById = useMemo(() => Object.fromEntries(services.map((s) => [s.id, s])), [services])

  const displayedDate = useMemo(() => new Date(`${dateISO}T00:00:00`), [dateISO])
  const windowByEmployee = useMemo(() => {
    const map = {}
    for (const emp of employees) {
      const entry = schedulesByEmployee[emp.id]
      map[emp.id] = availableWindowForDate(entry?.schedule, entry?.slots, displayedDate)
    }
    return map
  }, [employees, schedulesByEmployee, displayedDate])

  const isToday = dateISO === todayISO()
  const nowMinutes = isToday ? minutesFromGridStart(now) : -1
  const showNowLine = isToday && isWithinGrid(nowMinutes)

  function appointmentsForEmployee(employeeId) {
    return dayAppointments.filter((a) => a.employee_id === employeeId && a.status !== 'cancelled')
  }

  function handleCellClick(employeeId, minutesFromStart) {
    setDialogState({ employeeId, startTime: slotStartTime(dateISO, minutesFromStart) })
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

      <div className="flex overflow-x-auto rounded-lg border border-border">
        <div className="sticky start-0 z-20 flex shrink-0 flex-col bg-card" style={{ width: 56 }}>
          <div className="flex items-center justify-center border-b border-border text-[11px] text-muted-foreground" style={{ height: HEADER_HEIGHT }} />
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
          <div className="flex items-center justify-center border-b border-border text-xs font-medium" style={{ height: HEADER_HEIGHT }}>
            {t('appointments:waitingListColumn')}
          </div>
          <div className="flex flex-col gap-1.5 p-1.5">
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
            <div className="flex flex-col border-b border-border" style={{ height: HEADER_HEIGHT }}>
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
                const window = windowByEmployee[emp.id]
                const cellEndLabel = minutesToLabel(s.minutesFromStart + SLOT_MINUTES)
                const available = isWithinWindow(window, s.label, cellEndLabel)
                const style = { top: (s.minutesFromStart / SLOT_MINUTES) * ROW_HEIGHT, height: ROW_HEIGHT }
                // Repeat the hour inside every column so the eye can track time
                // while scanning sideways, without going back to the left rail.
                const hourMark = s.minutesFromStart % 60 === 0 ? (
                  <span className="pointer-events-none absolute start-1 top-0.5 text-[10px] leading-none text-primary/30">
                    {s.label}
                  </span>
                ) : null

                if (!available) {
                  return (
                    <div
                      key={s.minutesFromStart}
                      className="absolute inset-x-0 border-b border-border/50 bg-muted/60"
                      style={style}
                      title={t('appointments:outsideScheduleHint')}
                    >
                      {hourMark}
                    </div>
                  )
                }
                return (
                  <button
                    key={s.minutesFromStart}
                    type="button"
                    className="absolute inset-x-0 border-b border-border/50 hover:bg-muted/40"
                    style={style}
                    onClick={() => handleCellClick(emp.id, s.minutesFromStart)}
                  >
                    {hourMark}
                  </button>
                )
              })}

              {appointmentsForEmployee(emp.id).map((a) => {
                const startMin = minutesFromGridStart(new Date(a.start_time))
                const endMin = minutesFromGridStart(new Date(a.end_time))
                const clampedStart = Math.max(startMin, 0)
                const clampedEnd = Math.min(endMin, gridMinutes)
                if (clampedEnd <= clampedStart) return null
                const service = servicesById[a.service_id]
                const top = (clampedStart / SLOT_MINUTES) * ROW_HEIGHT
                const height = ((clampedEnd - clampedStart) / SLOT_MINUTES) * ROW_HEIGHT
                return (
                  <div
                    key={a.id}
                    className="pointer-events-none absolute inset-x-0.5 z-10 overflow-hidden rounded px-1 py-0.5 text-[10px] leading-tight text-white"
                    style={{ top, height, background: service?.color || 'var(--color-muted-foreground)' }}
                    title={`${clientName(clientsById, a.client_id)} — ${service?.name || ''}`}
                  >
                    <div className="truncate font-medium">{clientName(clientsById, a.client_id)}</div>
                    <div className="truncate opacity-90">{service?.name}</div>
                  </div>
                )
              })}

              {showNowLine && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-destructive"
                  style={{ top: (nowMinutes / SLOT_MINUTES) * ROW_HEIGHT }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

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
        resources={resources}
        resourceUnits={resourceUnits}
        serviceResources={serviceResources}
        onSaved={reload}
      />
    </div>
  )
}
