// What fits on a booking block, and what a shortcut says when it fails.
//
// A block is (duration / 30) × rowHeight tall and clips whatever overflows,
// so everything drawn inside it is a question of arithmetic rather than
// taste. Keeping that arithmetic here means the thresholds can be checked
// against the measurements they came from instead of being numbers sitting in
// a className somewhere.

// Two text lines take 29px at text-[10px] with leading-tight, and a row of
// buttons 17px at text-[9px]. Below their sum a shortcut is cut off silently,
// which is worse than not offering it — nothing tells you it was meant to be
// there.
export const MIN_HEIGHT_FOR_ACTIONS = 46

// The progress figure needs one more text line under the existing two.
export const MIN_HEIGHT_FOR_PROGRESS_TEXT = 42

// Approve and cancel on the card itself, offered only for a provisional
// booking with the room to draw them.
export function canShowQuickActions({ status, height, hasHandler }) {
  return status === 'pending_approval' && !!hasHandler && height >= MIN_HEIGHT_FOR_ACTIONS
}

// The bar itself is drawn on the block's bottom edge and costs no content
// height, so it needs no threshold — only the figure beside it does.
export function canShowProgressText(height) {
  return height >= MIN_HEIGHT_FOR_PROGRESS_TEXT
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
