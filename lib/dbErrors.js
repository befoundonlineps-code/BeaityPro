import { RAISED_CODES, raisedCode, raisedHint, isUnnamedRaise } from './raisedCodes'

// Turning a database error into something a receptionist can act on.
//
// Postgres messages are written for whoever wrote the schema, not whoever
// is standing at the desk with a client waiting. "column status is of type
// appointment_status but expression is of type text" tells her nothing she
// can do anything about, and showing it is a small breach of trust: it
// looks like the app broke rather than that something specific went wrong.
//
// Callers translate the outcomes they genuinely expect — a clash, a full
// room, a stale row — and route everything else through here, so an
// unforeseen fault still arrives as a sentence rather than as internals.

// Errors a receptionist can actually respond to, keyed by Postgres SQLSTATE.
const SQLSTATE_KEYS = {
  '23505': 'common:dbError.duplicate',      // unique_violation
  '23503': 'common:dbError.stillInUse',     // foreign_key_violation
  '23514': 'common:dbError.notAllowed',     // check_violation
  '23502': 'common:dbError.missingField',   // not_null_violation
  '23P01': 'common:dbError.slotTaken',      // exclusion_violation
  '42501': 'common:dbError.notPermitted',   // insufficient_privilege (RLS)
  '40001': 'common:dbError.tryAgain',       // serialization_failure
  '40P01': 'common:dbError.tryAgain',       // deadlock_detected
}

// The i18n key to show for a database error, always a real sentence.
//
// Anything unrecognised becomes a generic "something went wrong, try
// again" rather than the raw message — deliberately, because an
// unrecognised error is by definition one nobody has decided how to
// explain yet.
//
// ⚠️ Raised codes are consulted FIRST, and that is not a convenience. A
// trigger raises one on an ordinary UPDATE, so a plain client write can carry
// a named refusal just as an RPC can — which this function did not know, and
// two real refusals reached a real screen as "something went wrong" because of
// it (lib/raisedCodes.js records which). Every caller of reportDbError gets
// them from here rather than each screen having to pick the right reporter.
export function dbErrorKey(error) {
  if (!error) return null

  const raised = raisedCode(error)
  if (raised) return RAISED_CODES[raised]

  // A rule of ours refused this on purpose and nobody has written its sentence
  // yet. That is a different fact from an unrecognised fault, and saying so is
  // both more useful and more honest than the generic line.
  if (isUnnamedRaise(error)) return 'common:dbError.ruleRefused'

  return SQLSTATE_KEYS[error.code] || 'common:dbError.unexpected'
}

// True when the error is worth putting in front of a developer rather than
// silently swallowing.
//
// An unnamed raise counts: it is exactly the case where somebody has to read
// the console, find the code, and give it a sentence.
export function isUnexpectedDbError(error) {
  if (!error) return false
  if (raisedCode(error)) return false
  return isUnnamedRaise(error) || !SQLSTATE_KEYS[error.code]
}

// The one call sites should use: returns the message key AND makes sure an
// unrecognised error still reaches somebody who can act on it.
//
// Translating without recording would trade one failure for a worse one --
// the receptionist stops seeing noise, and whoever has to fix the cause
// loses the only evidence there was. These calls go straight from the
// browser to the database, so they never touch the Next.js server and its
// log will never hold them: the browser console is the only place left.
export function reportDbError(error, context) {
  if (isUnexpectedDbError(error)) {
    // eslint-disable-next-line no-console
    console.error(`[db] unexpected error${context ? ` — ${context}` : ''}`, {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
  }
  return dbErrorKey(error)
}

// The sentence to put on the screen — and the one call sites should use.
//
// ⚠️ It takes `t` rather than returning a key, and that is the whole point.
// A trigger written for a person carries `using hint = '…'`: an Arabic
// sentence already saying exactly what went wrong. Returning a translation key
// can only ever throw that away, which is what was happening — the hint sat in
// the error object while the screen said "something went wrong".
//
// The order is: a named code's key → the trigger's own hint → the generic
// sentence. A named key wins because it is translatable and a hint is Arabic
// living in the database; a second language would get Arabic back.
//
// What this buys is not two messages. It is that the next trigger somebody
// writes gets an understandable refusal from the moment they write it — no
// translation key, no round trip through a review. The default heals itself.
// ⚠️ There is no branch here for "a named code wins". There was one, and a
// mutation proved it dead: isUnnamedRaise is false whenever the code IS named,
// so the hint branch cannot fire for one — and dbErrorKey below maps it. The
// ordering guarantee lives in one place instead of being asserted twice, and a
// second copy that no test could tell apart is exactly what rots.
export function dbErrorSentence(error, t, context) {
  if (!error) return null

  const hint = raisedHint(error)
  if (hint && isUnnamedRaise(error)) {
    // Still logged: an unnamed code is one somebody should name eventually,
    // and the hint being good enough for today does not make it named.
    reportDbError(error, context)
    return hint
  }

  return t(reportDbError(error, context))
}
