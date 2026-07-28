const EVENT_NAME = 'client-ledger-changed'

export function emitLedgerChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT_NAME))
}

export function onLedgerChanged(handler) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
