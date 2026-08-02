// What fits on a booking block, and what a shortcut says when it fails.
//
// A block is (duration / 30) × rowHeight tall and clips whatever overflows,
// so everything drawn inside it is a question of arithmetic rather than
// taste. Keeping that arithmetic here means the thresholds can be checked
// against the measurements they came from instead of being numbers sitting in
// a className somewhere.

// Measured from the block's own styles: text-[10px] with leading-tight gives
// a 12.5px line, py-0.5 puts 2px above and below, and the approve/cancel row
// at text-[9px] takes 17px including its gap.
const LINE = 12.5
const PADDING = 4
const BUTTON_ROW = 17

// What a block has room to show, decided together rather than one threshold
// at a time.
//
// They have to be decided together because they compete for the same height:
// a pending block that just fits two lines and a button row would overflow
// the moment a third line was added under an independent rule of its own.
// Answering once means the arithmetic can never contradict itself.
//
// Order of preference is the order a receptionist reads them — who, what,
// when, and how far along — so the last one to fit is the first to go.
export function cardContent({ height, status, isRunning, hasApproveHandler }) {
  const fits = (lines, extra = 0) => height >= PADDING + lines * LINE + extra

  const showActions =
    status === 'pending_approval' && !!hasApproveHandler && fits(2, BUTTON_ROW)

  // The name and the service are lines one and two, so the time is the third
  // — and on a pending block it has to clear the button row as well.
  const showTime = showActions ? fits(3, BUTTON_ROW) : fits(3)

  // Progress follows whatever came before it, so it is the fourth line when
  // the time is showing and the third when it is not.
  const showProgress = !!isRunning && fits(showTime ? 4 : 3)

  return { showActions, showTime, showProgress }
}

// A confirmed booking wears a tick. Only a settled one: provisional blocks
// carry their own dashed edge and their own two buttons, and completed or
// cancelled ones are history rather than something to reassure anybody about.
export function showsConfirmedTick(status) {
  return status === 'booked'
}

// Which message a one-press approve turns into, or null when it worked.
//
// The same shape as rescheduleErrorKey: the caller owns the round trip, this
// owns what the outcome is called. Without it the card and the dialog could
// drift into explaining the same refusal two different ways.
export function approveErrorKey({ error, data }) {
  if (error) {
    if (error.message?.includes('appointment_not_pending')) {
      return 'appointments:actionsDialog.notPendingError'
    }
    return null // caller falls back to reportDbError
  }
  if (!data) return 'appointments:actionsDialog.noRowsError'
  return null
}
