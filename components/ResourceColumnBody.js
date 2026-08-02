import { useTranslation } from 'next-i18next'
import {
  buildTimeSlots,
  totalGridMinutes,
  minutesFromGridStart,
  isWithinGrid,
  SLOT_MINUTES,
} from '../lib/appointmentGrid'
import { clusterAppointments } from '../lib/resourceAllocation'

// One resource's column for one day.
//
// Read-only by design: bookings land here automatically when a
// resource-linked service is booked from a professional's column, and a
// resource cannot answer "who performs this?", so there is nothing to click
// a cell for. Lifted out beside EmployeeColumnBody for the same reason — a
// week of one resource is this column drawn seven times.
//
// Units are not lanes here. Several units busy in the same window arrive as
// one cluster carrying them all, and the block says how many rather than
// splitting the column — which is what the day view already did, and what the
// dialog behind it is for.
export default function ResourceColumnBody({
  resource, dateISO, appointments, now, rowHeight,
  clientsById, servicesById, onClusterClick,
}) {
  const { t } = useTranslation(['appointments', 'common'])

  const slots = buildTimeSlots()
  const gridMinutes = totalGridMinutes()
  const gridHeight = (gridMinutes / SLOT_MINUTES) * rowHeight

  const isToday = dateISO === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMinutes = isToday ? minutesFromGridStart(now) : -1
  const showNowLine = isToday && isWithinGrid(nowMinutes)

  function clientName(id) {
    const c = clientsById[id]
    return c ? `${c.first_name} ${c.last_name || ''}`.trim() : ''
  }

  return (
    <div className="relative" style={{ height: gridHeight }}>
      {slots.map((s) => (
        <div
          key={s.minutesFromStart}
          className="absolute inset-x-0 border-b border-border/50"
          style={{ top: (s.minutesFromStart / SLOT_MINUTES) * rowHeight, height: rowHeight }}
        >
          {s.minutesFromStart % 60 === 0 && (
            <span className="pointer-events-none absolute start-1 top-0.5 text-[10px] leading-none text-primary/30">
              {s.label}
            </span>
          )}
        </div>
      ))}

      {clusterAppointments(appointments).map((cluster) => {
        const clampedStart = Math.max(minutesFromGridStart(cluster.start), 0)
        const clampedEnd = Math.min(minutesFromGridStart(cluster.end), gridMinutes)
        if (clampedEnd <= clampedStart) return null
        const single = cluster.items.length === 1
        const service = single ? servicesById[cluster.items[0].service_id] : null
        return (
          <button
            key={`${resource.id}-${dateISO}-${cluster.start.getTime()}`}
            type="button"
            className="absolute inset-x-0.5 z-10 overflow-hidden rounded-lg px-1 py-0.5 text-start text-[10px] leading-tight text-white hover:opacity-90"
            style={{
              top: (clampedStart / SLOT_MINUTES) * rowHeight,
              height: ((clampedEnd - clampedStart) / SLOT_MINUTES) * rowHeight,
              background: single ? service?.color || 'var(--color-muted-foreground)' : 'var(--color-primary)',
            }}
            onClick={() => onClusterClick({ resource, cluster })}
          >
            {single ? (
              <>
                <div className="truncate font-medium">{clientName(cluster.items[0].client_id)}</div>
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
          style={{ top: (nowMinutes / SLOT_MINUTES) * rowHeight }}
        />
      )}
    </div>
  )
}
