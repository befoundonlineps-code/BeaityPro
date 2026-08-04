import { dbErrorKey, isUnexpectedDbError } from './dbErrors'
import { RAISED_CODES, raisedCode } from './raisedCodes'

// One raised code saying different things on different screens.
//
// The table itself moved to lib/raisedCodes.js, because it turned out not to
// be an RPC concern at all: a trigger raises the same kind of exception on an
// ordinary UPDATE, so dbErrors has to read it too. What is left here is the
// part that really is per-caller.
//
// `overrides` is not a nicety. appointment_not_cancellable means "this booking
// cannot be cancelled" in the actions dialog and "your view is out of date" in
// the day-status dialogs, because there somebody is releasing a whole day and a
// booking that moved underneath them is stale news rather than a refusal.
// Collapsing those into one sentence would have been a behaviour change
// smuggled inside a refactor.
//
// Without overrides this is now exactly dbErrorKey, which is the point: there
// is one answer to "what does this error say", and one place it comes from.
export function rpcErrorKey(error, overrides) {
  const code = raisedCode(error)
  if (code && overrides && overrides[code]) return overrides[code]
  return dbErrorKey(error)
}

// The one call sites should use.
//
// An error that is neither a code we raise nor a SQLSTATE we recognise still
// reaches the console, for the same reason reportDbError does it: translating
// without recording trades a confused user for a fault nobody can find.
export function reportRpcError(error, context, overrides) {
  if (isUnexpectedDbError(error)) {
    // eslint-disable-next-line no-console
    console.error(`[rpc] unexpected error${context ? ` — ${context}` : ''}`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
  }
  return rpcErrorKey(error, overrides)
}

export { RAISED_CODES, raisedCode }
