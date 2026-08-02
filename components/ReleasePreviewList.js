import { useTranslation } from 'next-i18next'

function pad(n) {
  return String(n).padStart(2, '0')
}

function timeRange(appointment) {
  const start = new Date(appointment.start_time)
  const end = new Date(appointment.end_time)
  return `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`
}

// What is about to happen to today's bookings, split by what each one gets.
//
// Two lists, never one. Losing the main professional cancels the session and
// sends the client back to the waiting list, which means somebody has to
// phone them; losing an extra pair of hands changes nothing the client will
// ever notice. Merged, the receptionist could not tell which of her clients
// she actually has to call — so the split is the whole point of showing this
// at all, not a presentational nicety.
//
// A resource can only fill the first list: only a session's primary row may
// hold a resource unit, which appointments_group_resource_check enforces, so
// a broken machine never reaches a participant.
export default function ReleasePreviewList({ plan, clientsById, servicesById, employeesById }) {
  const { t } = useTranslation(['appointments', 'common'])

  if (!plan) return null

  function clientName(id) {
    const c = clientsById[id]
    return c ? `${c.first_name} ${c.last_name || ''}`.trim() : '—'
  }

  function rows(list, tone) {
    return list.map((a) => (
      <div
        key={a.id}
        className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-xs"
        style={{
          borderInlineStartWidth: 3,
          borderInlineStartColor:
            tone === 'cancel' ? 'var(--color-destructive)' : 'var(--color-muted-foreground)',
        }}
      >
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{clientName(a.client_id)}</span>
          <span className="ms-1.5 text-muted-foreground">{servicesById[a.service_id]?.name || '—'}</span>
        </span>
        <span className="shrink-0 text-muted-foreground">{employeesById[a.employee_id]?.name || '—'}</span>
        {/* Already had a span of its own, so the isolate is an attribute
            rather than a new element. See the note on ranges in CLAUDE.md. */}
        <span dir="ltr" className="shrink-0 tabular-nums text-muted-foreground">{timeRange(a)}</span>
      </div>
    ))
  }

  if (plan.toCancel.length === 0 && plan.toRemove.length === 0) {
    return (
      <div className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
        {t('appointments:dayStatus.nothingAffected')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {plan.toCancel.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium text-destructive">
            {t('appointments:dayStatus.willCancelHeading', { count: plan.toCancel.length })}
          </div>
          <p className="text-xs text-muted-foreground">{t('appointments:dayStatus.willCancelHint')}</p>
          <div className="flex flex-col gap-1">{rows(plan.toCancel, 'cancel')}</div>
        </div>
      )}

      {plan.toRemove.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-medium">
            {t('appointments:dayStatus.willRemoveHeading', { count: plan.toRemove.length })}
          </div>
          <p className="text-xs text-muted-foreground">{t('appointments:dayStatus.willRemoveHint')}</p>
          <div className="flex flex-col gap-1">{rows(plan.toRemove, 'remove')}</div>
        </div>
      )}
    </div>
  )
}
