import { useMemo } from 'react'
import { useTranslation } from 'next-i18next'
import { summariseDay, SUMMARY_KEYS } from '../lib/statusSummary'

// Each bucket's colour, tied to what the calendar already says about that
// state rather than picked fresh: pending wears the amber it wears on a
// provisional block, cancelled and no-show wear the destructive red, and a
// running session wears the primary that marks the current hour.
const TONE = {
  confirmed: 'var(--color-primary)',
  pending: '#F59E0B',
  inProgress: 'var(--color-primary)',
  completed: '#10B981',
  cancelled: 'var(--color-destructive)',
  noShow: 'var(--color-destructive)',
}

// The day at a glance, under the grid.
//
// Always the whole salon's day, never the filtered column: somebody asking
// "how are we doing today" means the salon, and a number that quietly changed
// meaning when a role was selected would be worse than no number.
export default function StatusSummaryBar({ appointments, now }) {
  const { t } = useTranslation(['appointments'])

  const { counts, total } = useMemo(() => summariseDay(appointments, now), [appointments, now])

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-2 text-sm">
      {SUMMARY_KEYS.map((key) => (
        <span key={key} className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: TONE[key] }}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">{t(`appointments:statusSummary.${key}`)}</span>
          <span className="font-medium tabular-nums">{counts[key]}</span>
        </span>
      ))}

      <span className="flex items-center gap-1.5 ms-auto">
        <span className="text-muted-foreground">{t('appointments:statusSummary.total')}</span>
        <span className="font-semibold tabular-nums">{total}</span>
      </span>
    </div>
  )
}
