import { useMemo, useRef } from 'react'
import { useTranslation } from 'next-i18next'
import { useRouter } from 'next/router'
import { ChevronRight, ChevronLeft, ChevronDown, Plus, Users, CalendarClock, Phone, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import CalendarViewMenu from './CalendarViewMenu'
import { toolbarCard, toolbarCardButton, toolbarArrow, ToolbarStack } from './ToolbarCard'

// Everything above the grid, in the order somebody works in: make a booking,
// choose whose day you are looking at, choose which day, then the three
// things you reach for while the day is already on screen.
//
// Lifted out of AppointmentCalendar rather than left inline, because a row of
// controls is the one part of that file with nothing behind it — no data, no
// fetching, no state of its own — and pulling it out is what makes it
// possible to render and measure on its own. The calendar returns an empty
// card long before the toolbar when a salon has no staff yet, so inline there
// was no way to look at this at all.
export default function CalendarToolbar({
  dateISO, onDateChange, onToday, onStep, isWeek,
  viewSelection, onViewSelect, employees, resources, visibleEmployeeCount,
  shiftsLabel,
  onNewAppointment, onOpenShifts, onOpenWorkPhone, onOpenQuickSale,
  trailing,
}) {
  const { t } = useTranslation(['appointments', 'employees', 'common', 'topBar'])
  const router = useRouter()

  // The day written out, not 04/08/2026. The weekday earns its place: the
  // question behind most glances at this card is which day of the week is on
  // the board, and reading that off a numeral costs a second every time.
  const dateLabel = useMemo(
    () => new Date(`${dateISO}T00:00:00`).toLocaleDateString(router.locale || 'ar', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    }),
    [dateISO, router.locale]
  )

  const dateInputRef = useRef(null)

  // Clicking the text of a date input does not open its calendar — only the
  // little indicator does, and this one has no indicator to click. showPicker
  // is the supported way to ask; focus is the fallback for anything that
  // refuses, which at least hands the keyboard over.
  function openDatePicker() {
    const el = dateInputRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker()
        return
      } catch {
        // fall through to focus
      }
    }
    el.focus()
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div data-toolbar-row className="flex flex-wrap items-center gap-2.5">
        {/* Filled, and first. Everything else on this row reports something or
            narrows something; this is the only one that makes a booking, so it
            is the only one not wearing the neutral card. */}
        <Button className="h-12 rounded-xl px-4 text-[13px]" onClick={onNewAppointment}>
          <Plus className="size-[18px]" />
          {t('appointments:newAppointmentButton')}
        </Button>

        {/* Who is on the board, and how many of them. */}
        <CalendarViewMenu
          selection={viewSelection}
          employees={employees}
          resources={resources}
          count={visibleEmployeeCount}
          onSelect={onViewSelect}
        />

        {/* The day: both arrows, the date itself and the way back to today, in
            one card because they are all the same question. The same two
            arrows step a week at a time once the board shows one, so there is
            no second pair to learn. */}
        <div className={cn(toolbarCard, 'gap-1 px-1.5 focus-within:ring-2 focus-within:ring-ring')}>
          <button
            type="button"
            className={toolbarArrow}
            onClick={() => onStep(-1)}
            title={t(isWeek ? 'appointments:weekView.prevWeekTitle' : 'appointments:prevDayTitle')}
          >
            <ChevronRight className="size-4" />
          </button>

          {/* The written-out date sits on top of a real date input rather than
              replacing it. A native input can only say 04/08/2026, so the
              visible half carries the words and calls showPicker(), and the
              input underneath stays the thing holding the value and taking the
              keyboard. Hidden from the accessibility tree on purpose: the
              input beside it says the same thing, and twice is worse. */}
          <div className="relative">
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={openDatePicker}
              className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted/60"
            >
              <ToolbarStack label={t('appointments:toolbar.dateLabel')} value={dateLabel} />
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
            <input
              ref={dateInputRef}
              type="date"
              aria-label={t('appointments:toolbar.dateLabel')}
              value={dateISO}
              onChange={(e) => onDateChange(e.target.value)}
              className="pointer-events-none absolute inset-0 size-full opacity-0"
            />
          </div>

          <button
            type="button"
            className={toolbarArrow}
            onClick={() => onStep(1)}
            title={t(isWeek ? 'appointments:weekView.nextWeekTitle' : 'appointments:nextDayTitle')}
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-muted/60"
            onClick={onToday}
          >
            {t('appointments:todayButton')}
          </button>
        </div>

        <button
          type="button"
          className={toolbarCardButton}
          title={t('appointments:shiftsDialog.buttonTitle')}
          onClick={onOpenShifts}
        >
          <CalendarClock className="size-[18px] shrink-0 text-muted-foreground" />
          <ToolbarStack
            className="max-w-44"
            label={t('appointments:toolbar.shiftLabel')}
            value={shiftsLabel}
          />
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>

        <button
          type="button"
          className={toolbarCardButton}
          title={t('appointments:workPhone.buttonTitle')}
          onClick={onOpenWorkPhone}
        >
          <Phone className="size-[18px] shrink-0 text-muted-foreground" />
          <span className="text-[13px] font-medium">{t('appointments:workPhone.buttonLabel')}</span>
        </button>

        {/* Nothing behind it yet, and it says so in the same words the clients
            bar already uses for the same promise. Pressed rather than
            disabled: a greyed-out control invites the question a second time,
            and the badge answers it once. */}
        <button
          type="button"
          className={cn(toolbarCardButton, 'text-muted-foreground')}
          title={`${t('appointments:quickSaleButton')} — ${t('topBar:soonBadge')}`}
          onClick={onOpenQuickSale}
        >
          <Zap className="size-[18px] shrink-0" />
          <span className="text-[13px] font-medium">{t('appointments:quickSaleButton')}</span>
          <span className="text-[9px] leading-none">{t('topBar:soonBadge')}</span>
        </button>
      </div>

      {/* The assistant toggle, when the roster has assistants and the current
          view is one they belong to. It stays on the far side rather than
          joining the row: it changes what the six answer about, so it is not
          one of them. */}
      <div className="flex items-center gap-2">{trailing}</div>
    </div>
  )
}
