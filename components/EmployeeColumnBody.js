import { useTranslation } from 'next-i18next'
import {
  buildTimeSlots,
  totalGridMinutes,
  slotStartTime,
  minutesFromGridStart,
  minutesToLabel,
  isWithinGrid,
  isSlotPast,
  SLOT_MINUTES,
} from '../lib/appointmentGrid'
import { isWithinAnyWindow } from '../lib/employeeAvailability'
import { clusterAppointments } from '../lib/resourceAllocation'

// One professional's column for one day: the shift shading, the walls, the
// booking blocks and the now line.
//
// It was lifted out of the calendar unchanged so the week view could be the
// same column drawn seven times for seven dates instead of once for each
// professional. Nothing about it knows which of the two it is in — every
// answer that used to come from the calendar's single date now arrives as
// `dateISO`, which is the only thing that ever differed.
//
// Two things stopped being special cases on the way out. The now line works
// out for itself whether `dateISO` is today, so in a week it lands on one
// column rather than all seven; and a drop reports the column's own date, so
// dragging a booking sideways in a week moves it to that day.
export default function EmployeeColumnBody({
  employee, dateISO, appointments, windows, absence, now,
  rowHeight, clientsById, servicesById,
  dragState, dragOverKey, onDragOverColumn, onDragLeaveColumn,
  onDragStart, onDragEnd, onDrop,
  onCellClick, onClusterClick, onAppointmentClick,
}) {
  const { t } = useTranslation(['appointments', 'employees', 'common'])

  const slots = buildTimeSlots()
  const gridMinutes = totalGridMinutes()
  const gridHeight = (gridMinutes / SLOT_MINUTES) * rowHeight
  const columnKey = `${employee.id}|${dateISO}`

  const isToday = dateISO === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const nowMinutes = isToday ? minutesFromGridStart(now) : -1
  const showNowLine = isToday && isWithinGrid(nowMinutes)

  function clientName(id) {
    const c = clientsById[id]
    return c ? `${c.first_name} ${c.last_name || ''}`.trim() : ''
  }

  return (
    <div
      className={`relative ${dragOverKey === columnKey ? 'bg-primary/5 ring-2 ring-inset ring-primary/40' : ''}`}
      style={{ height: gridHeight }}
      onDragOver={(event) => {
        if (!dragState) return
        event.preventDefault() // without this the drop is never allowed
        event.dataTransfer.dropEffect = 'move'
        onDragOverColumn(columnKey)
      }}
      onDragLeave={() => onDragLeaveColumn(columnKey)}
      onDrop={(event) => onDrop(event, employee, dateISO)}
    >
      {slots.map((s) => {
        const cellEndLabel = minutesToLabel(s.minutesFromStart + SLOT_MINUTES)
        const past = isSlotPast(slotStartTime(dateISO, s.minutesFromStart + SLOT_MINUTES), now)
        // Outside the shift is no longer a wall: the slot stays shaded so it
        // still reads as unusual, but it opens the dialog, which is where the
        // provisional-booking question gets asked. Time that has already
        // passed stays closed — that one is not a judgement call.
        const withinShift = isWithinAnyWindow(windows, s.label, cellEndLabel)
        const style = { top: (s.minutesFromStart / SLOT_MINUTES) * rowHeight, height: rowHeight }
        // Repeat the hour inside every column so the eye can track time while
        // scanning sideways, without going back to the left rail.
        const hourMark = s.minutesFromStart % 60 === 0 ? (
          <span className="pointer-events-none absolute start-1 top-0.5 text-[10px] leading-none text-primary/30">
            {s.label}
          </span>
        ) : null

        // An absence is a wall, not a question. Outside the shift is
        // negotiable — she is around and might agree — but "not here today"
        // leaves nobody to ask, so the cell stops offering the
        // provisional-booking dialog the way a past slot does.
        if (past || absence) {
          return (
            <div
              key={s.minutesFromStart}
              className="absolute inset-x-0 border-b border-border/50 bg-muted/60"
              style={style}
              title={t(absence && !past
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
            onClick={() => onCellClick(employee.id, s.minutesFromStart, dateISO)}
          >
            {hourMark}
          </button>
        )
      })}

      {/* Almost every cluster holds exactly one appointment and renders
          exactly as before. More than one only happens when a no_show and a
          live booking land on the same slot — the only overlap the database
          allows, since booked/completed/pending_approval can never overlap
          each other for the same employee. That case gets one merged block
          that opens a picker instead of guessing which appointment you
          meant. */}
      {clusterAppointments(appointments).map((cluster) => {
        const clampedStart = Math.max(minutesFromGridStart(cluster.start), 0)
        const clampedEnd = Math.min(minutesFromGridStart(cluster.end), gridMinutes)
        if (clampedEnd <= clampedStart) return null
        const top = (clampedStart / SLOT_MINUTES) * rowHeight
        const height = ((clampedEnd - clampedStart) / SLOT_MINUTES) * rowHeight

        if (cluster.items.length > 1) {
          return (
            <button
              key={`cluster-${columnKey}-${cluster.start.getTime()}`}
              type="button"
              className="absolute inset-x-0.5 z-10 overflow-hidden rounded px-1 py-0.5 text-start text-[10px] leading-tight text-white hover:brightness-110"
              style={{ top, height, background: 'var(--color-primary)' }}
              onClick={() => onClusterClick({ employee, cluster })}
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
        // A provisional booking keeps its service colour — it is a real hold
        // on the slot — but wears a dashed edge and a hatch so it never reads
        // as settled. A confirmed booking is solid, but opens the same
        // actions dialog (cancel / didn't-show); completed, cancelled and
        // no-show blocks stay inert since that dialog offers them nothing.
        const pending = a.status === 'pending_approval'
        const actionable = pending || a.status === 'booked'
        const beingDragged = dragState?.appointment.id === a.id
        // An added professional's row is a full booking holding its own slot,
        // so it draws at full size — the calendar answers "is this person
        // busy?", and the answer is yes either way. It is only toned down and
        // labelled so the main professional's row reads first.
        const isParticipant = a.is_primary === false
        const Tag = actionable ? 'button' : 'div'
        return (
          <Tag
            key={a.id}
            type={actionable ? 'button' : undefined}
            // Only a booking that can still be acted on can be moved, the
            // same rule that decides whether it opens a dialog.
            draggable={actionable}
            onDragStart={actionable ? (event) => onDragStart(event, a) : undefined}
            onDragEnd={actionable ? onDragEnd : undefined}
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
              clientName(a.client_id),
              service?.name || null,
            ].filter(Boolean).join(' — ')}
            onClick={actionable ? () => onAppointmentClick(a) : undefined}
          >
            <div className="truncate font-medium">{clientName(a.client_id)}</div>
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
          style={{ top: (nowMinutes / SLOT_MINUTES) * rowHeight }}
        />
      )}
    </div>
  )
}
