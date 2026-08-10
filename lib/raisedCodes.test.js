import fs from 'fs'
import path from 'path'
import { dbErrorKey, isUnexpectedDbError, dbErrorSentence } from './dbErrors'
import { rpcErrorKey } from './rpcErrors'
import { raisedCode, isUnnamedRaise, RAISED_CODES } from './raisedCodes'

// The bug this file exists for: a trigger raises on an ordinary UPDATE, so a
// plain client write carries a named refusal exactly as an RPC does — and the
// reporter those screens use knew nothing about the table.
const trigger = (message) => ({ code: 'P0001', message, details: null, hint: null })

describe('a raised code reaches a sentence however it arrived', () => {
  it('maps one that came back from a plain write, not only from an RPC', () => {
    // This is the case that was broken: StoragesManager and ProductFormDialog
    // both go through reportDbError, which used to consult SQLSTATE alone.
    expect(dbErrorKey(trigger('storage_not_found'))).toBe('products:stock.storageNotFound')
    expect(dbErrorKey(trigger('transfer_same_storage'))).toBe('products:stock.transferSameStorage')
  })

  it('gives the same answer through either entry point', () => {
    // One question, one answer. rpcErrorKey without overrides is dbErrorKey.
    for (const message of ['storage_not_found', 'appointment_not_cancellable', 'stock_document_empty']) {
      expect(rpcErrorKey(trigger(message))).toBe(dbErrorKey(trigger(message)))
    }
  })

  it('still lets one screen say something different from another', () => {
    // The reason overrides exist: releasing a whole day, a booking that moved
    // underneath you is stale news rather than a refusal.
    expect(rpcErrorKey(trigger('appointment_not_cancellable'), {
      appointment_not_cancellable: 'appointments:dayStatus.staleError',
    })).toBe('appointments:dayStatus.staleError')
  })
})

describe('a raise nobody has named yet', () => {
  it('says a rule refused it, not that something went wrong', () => {
    // Two different facts. "A rule of ours said no" is actionable; "something
    // went wrong" sends somebody to check their internet.
    expect(dbErrorKey(trigger('some_rule_nobody_named_yet'))).toBe('common:dbError.ruleRefused')
    expect(isUnnamedRaise(trigger('some_rule_nobody_named_yet'))).toBe(true)
  })

  it('still reaches the console, because somebody has to name it', () => {
    expect(isUnexpectedDbError(trigger('some_rule_nobody_named_yet'))).toBe(true)
  })

  it('does not claim a rule refused an ordinary database fault', () => {
    // 23505 is Postgres speaking, not us.
    expect(isUnnamedRaise({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(dbErrorKey({ code: '23505', message: 'duplicate key' })).toBe('common:dbError.duplicate')
  })

  it('stays quiet about a code it does know', () => {
    expect(isUnexpectedDbError(trigger('storage_not_found'))).toBe(false)
  })
})

describe('whole-word matching', () => {
  it('does not match a code that is only part of a longer word', () => {
    expect(raisedCode(trigger('xstorage_not_foundy'))).toBeNull()
    expect(raisedCode(trigger('the storage_not_found rule fired'))).toBe('storage_not_found')
  })

  it('survives an error with no message', () => {
    expect(raisedCode({ code: 'P0001' })).toBeNull()
    expect(raisedCode(null)).toBeNull()
  })
})

describe('the trigger hint is used when no code has been named', () => {
  // Both trigger codes arrived carrying an Arabic sentence in `hint`, written
  // when the trigger was written, sitting unread while the screen said
  // "something went wrong".
  const withHint = (message, hint) => ({ code: 'P0001', message, hint })
  const t = (key) => `t(${key})`

  it('shows the hint rather than the generic sentence', () => {
    expect(dbErrorSentence(withHint('some_new_rule', 'المستودع فيه رصيد'), t))
      .toBe('المستودع فيه رصيد')
  })

  it('prefers a named key over the hint, because a key can be translated', () => {
    // The hint is Arabic living in the database. A second language would get
    // Arabic back, so a named code always wins.
    //
    // ⚠️ The expected key CHANGED, and not because the sentence was improved.
    // storage_not_empty was declared twice in RAISED_CODES; the later
    // declaration silently won, and this assertion was written from what the
    // code did rather than from what it was supposed to do. So it passed for
    // weeks while the richer sentence written for 077a was unreachable.
    expect(dbErrorSentence(withHint('storage_not_empty', 'المستودع فيه رصيد'), t))
      .toBe('t(products:storageDialog.storageNotEmpty)')
  })

  it('keeps the generic sentence for a raise with no hint', () => {
    // Not every P0001 is written for a person. An internal raise with a
    // technical message and no hint must not be shown as if it were.
    expect(dbErrorSentence({ code: 'P0001', message: 'internal_assert_failed' }, t))
      .toBe('t(common:dbError.ruleRefused)')
    expect(dbErrorSentence({ code: 'P0001', message: 'x', hint: '   ' }, t))
      .toBe('t(common:dbError.ruleRefused)')
  })

  it('never lets a hint override an ordinary database fault', () => {
    // 23505 is Postgres speaking, and its hint is Postgres English.
    expect(dbErrorSentence({ code: '23505', message: 'duplicate key', hint: 'Key (x)=(1) exists' }, t))
      .toBe('t(common:dbError.duplicate)')
  })

  it('maps both codes the owner measured off a real session', () => {
    expect(dbErrorSentence(withHint('storage_not_empty', 'h'), t))
      .toBe('t(products:storageDialog.storageNotEmpty)')
    expect(dbErrorSentence(withHint('consignment_locked', 'h'), t))
      .toBe('t(products:productDialog.consignmentLockedError)')
  })

  it('speaks for both halves of the split guard, separately', () => {
    // ⚠️ 079a turns one refusal into two, and the point of two codes is that
    // they must not resolve to the same sentence. A live balance can be
    // emptied and the sentence names how; history cannot, and pretending
    // otherwise would send somebody looking for a button that is not there.
    const flag = dbErrorSentence(withHint('consignment_flag_locked', 'h'), t)
    const supplier = dbErrorSentence(withHint('consignment_supplier_locked', 'h'), t)
    expect(flag).toBe('t(products:productDialog.consignmentFlagLockedError)')
    expect(supplier).toBe('t(products:productDialog.consignmentSupplierLockedError)')
    expect(flag).not.toBe(supplier)
  })

  it('still answers the code the live database raises today', () => {
    // The old function has not been replaced yet — 079a is written, not run,
    // and run state lives with the owner. The day README records it, this
    // assertion and the entry it guards go together.
    expect(isUnnamedRaise(trigger('consignment_locked'))).toBe(false)
  })
})

describe('the codes read from the function text', () => {
  // Everything the four stock functions can refuse. Not "what we have seen" —
  // all four texts arrived whole, so this is the closed set.
  const STOCK_CODES = [
    'wrong_function_for_doc_type', 'stock_document_empty', 'storage_not_found',
    'product_not_found', 'stock_line_zero', 'unit_cost_required', 'count_invalid',
    'transfer_same_storage',
    'stock_document_not_found', 'cannot_reverse_a_reversal', 'already_reversed',
  ]

  it('names every one, including the ones unreachable from outside', () => {
    // ⚠️ Most of these could never have been driven at: RLS answers
    // storage_not_found on the first lookup, so everything behind it is
    // unreachable from outside BY CONSTRUCTION. Reading the text was the only
    // way, and it is why the list stopped where it did for so long.
    for (const code of STOCK_CODES) expect(RAISED_CODES[code]).toBeDefined()
  })

  it('turns each of them into its own sentence, not the generic one', () => {
    const t = (key) => `t(${key})`
    for (const code of STOCK_CODES) {
      const sentence = dbErrorSentence({ code: 'P0001', message: code }, t, 'test')
      expect(sentence).toBe(`t(${RAISED_CODES[code]})`)
      expect(sentence).not.toContain('unexpected')
    }
  })

  it('speaks for the three that only a race can reach', () => {
    // The screen disables the button in all three cases, so the only route is
    // two people at once, a double click, or a stale page. That argues FOR the
    // sentence: whoever meets one meets it at the worst moment.
    const t = (key) => `t(${key})`
    for (const code of ['stock_document_not_found', 'cannot_reverse_a_reversal', 'already_reversed']) {
      expect(isUnnamedRaise({ code: 'P0001', message: code })).toBe(false)
      expect(dbErrorSentence({ code: 'P0001', message: code }, t)).toBe(`t(${RAISED_CODES[code]})`)
    }
  })

  it('still refuses to invent a code nobody has read', () => {
    // ⚠️ Closed for these four functions only. The rule the header states
    // holds everywhere else: absence means NOT MEASURED, never "does not
    // exist". These two are plausible names for guards that were looked for
    // and are not in any text we have.
    expect(RAISED_CODES.transfer_insufficient_stock).toBeUndefined()
    expect(RAISED_CODES.stocktake_already_posted).toBeUndefined()
  })
})

// ── Every refusal written down in SQL has a sentence ──────────────────────
//
// The rounds this cost are the argument for it. Four codes sat unnamed for
// weeks while we drove a browser at them, and two of those — stock_line_zero
// and unit_cost_required — were guards that fired on real screens and arrived
// as "something went wrong". They were unreachable from outside BY
// CONSTRUCTION, because RLS answers storage_not_found on the first lookup. The
// text was the only way, and the text was always readable.
//
// So the moment a function's text lands in docs/, this reads it. A pasted body
// carrying a code nobody has named fails here rather than on somebody's screen
// in six months.
//
// Direction matters. This block asserts one: every code RAISED must be NAMED.
//
// ⚠️ THE OTHER DIRECTION IS NOW ASSERTED TOO, in the block below, and it used
// to say here that it could not be — "six named codes have no source in docs/
// (both trigger codes, and transfer_same_storage)". That sentence was true
// when written and is not true now: 077a deposited refuse_archiving_stocked_
// storage, 079a deposits the consignment guard, and transfer_stock arrived in
// 043. The count is FOUR and two of the three examples it named are wrong —
// a header that was correct on the day it was written, which is the class this
// project keeps finding.
//
// The reason it was left one-directional was sound and is preserved: asserting
// the reverse naively would delete measured knowledge to satisfy an incomplete
// file. What changed is that "incomplete" is now a list with reasons instead
// of a blanket excuse.
describe('every raise written down in docs/ has a named sentence', () => {
  // Scope derived, not listed. A new script under docs/sql/ is covered the day
  // it lands; a renamed folder makes the walk return nothing and the emptiness
  // check below fails loudly rather than passing on zero files.
  const sqlFilesUnder = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return sqlFilesUnder(full)
      return entry.name.endsWith('.sql') ? [full] : []
    })

  // `raise exception 'code'` — the quoted code is required, so prose that
  // merely mentions RAISE EXCEPTION (the header of 043 does) is not a match.
  const codesIn = (text) => [...text.matchAll(/raise\s+exception\s+'([a-z_]+)'/gi)].map((m) => m[1])

  const docsDir = path.join(__dirname, '..', 'docs')
  const files = sqlFilesUnder(docsDir)
  const raised = new Map()
  for (const file of files) {
    for (const code of codesIn(fs.readFileSync(file, 'utf8'))) {
      if (!raised.has(code)) raised.set(code, new Set())
      raised.get(code).add(path.basename(file))
    }
  }

  it('reads the files rather than passing on an empty walk', () => {
    // ⚠️ The counter-evidence this check exists for: a guard that scans
    // nothing reports nothing wrong. Both numbers were measured, and both are
    // lower bounds — they may only grow.
    expect(files.length).toBeGreaterThan(0)
    expect(raised.size).toBeGreaterThan(0)
  })

  it('reads a raise in both shapes it is written in', () => {
    // Same line, and split across lines before `using hint`. Both occur in the
    // real bodies, so a reader that handled one would half-work in silence.
    expect(codesIn("raise exception 'same_line' using hint = 'x';")).toEqual(['same_line'])
    expect(codesIn("raise exception 'split_line'\n      using hint = 'x';")).toEqual(['split_line'])
    expect(codesIn('-- the header says RAISE EXCEPTION is banned here')).toEqual([])
  })

  it('names every one of them', () => {
    const unnamed = [...raised.keys()].filter((code) => !RAISED_CODES[code])
    // The message carries the file, because the person who reads this failure
    // pasted a function body and needs to know which one.
    expect(unnamed.map((c) => `${c} ← ${[...raised.get(c)].join(', ')}`)).toEqual([])
  })

  it('covers all four stock functions exhaustively', () => {
    // All four texts arrived COMPLETE from pg_get_functiondef, so this is a
    // stronger claim than the rest of the map makes: 18 raise statements
    // across the four (3 + 6 + 6 + 3), 11 distinct codes because
    // storage_not_found appears twice in transfer_stock and several are
    // shared. All named. Asserted against the pasted bodies rather than from
    // memory of having read them.
    const script = fs.readFileSync(path.join(docsDir, 'sql', '043-cost-estimated.sql'), 'utf8')
    expect(new Set(codesIn(script))).toEqual(new Set([
      'wrong_function_for_doc_type', 'stock_document_empty', 'storage_not_found',
      'product_not_found', 'stock_line_zero', 'unit_cost_required', 'count_invalid',
      'transfer_same_storage',
      'stock_document_not_found', 'cannot_reverse_a_reversal', 'already_reversed',
    ]))
  })
})

// ── And the other direction: every sentence still has a raiser ────────────
//
// ⚠️ THE MISSING HALF, AND WE PRODUCED ITS FIRST CONCRETE INSTANCE OURSELVES
// IN THE ROUND THAT ADDED IT. 079a stops raising consignment_locked and starts
// raising two new codes. The old entry stays mapped and stays asserted by name
// — so the day 079a runs, a key guards a refusal that no longer exists, its
// test is green, and nothing anywhere says so. A dead key lives forever,
// because the walk above only ever asks "is this raise named".
//
// The list below is the whole point, and it fails CLOSED: a new orphan breaks
// this test and somebody writes a line saying why. Compare the alternative —
// a rule saying "every key must have a raiser" would be false today and would
// have been deleted within a round.
const NAMED_WITHOUT_A_RAISE_IN_DOCS = {
  // The appointments/day-status RPC bodies have never been deposited. Their
  // codes were measured off real sessions, and CLAUDE.md's rule applies
  // exactly: absence from our files is NOT MEASURED, never "does not exist".
  missing_system_cancellation_reason: 'function text not in docs/ — measured, not deposited',
  employee_already_absent: 'function text not in docs/ — measured, not deposited',
  resource_unit_already_out: 'function text not in docs/ — measured, not deposited',
  // ⚠️ RETIRING. The live database still raises this one; 079a replaces it and
  // is written, not run. Run state lives with the owner (docs/sql/README.md),
  // so this entry and its assertion above go together the day README records
  // 079a — and this line is what will make somebody notice.
  consignment_locked: 'retiring — raised by the live function until 079a runs',
}

describe('every sentence still has something that raises it', () => {
  const sqlFilesUnder = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return sqlFilesUnder(full)
      return entry.name.endsWith('.sql') ? [full] : []
    })

  const raised = new Set()
  for (const file of sqlFilesUnder(path.join(__dirname, '..', 'docs'))) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/raise\s+exception\s+'([a-z_]+)'/gi)) {
      raised.add(m[1])
    }
  }

  it('reads the files rather than passing on an empty walk', () => {
    expect(raised.size).toBeGreaterThan(20)
    expect(raised.has('consignment_flag_locked')).toBe(true)
  })

  it('has no orphan nobody has accounted for', () => {
    const orphans = Object.keys(RAISED_CODES)
      .filter((code) => !raised.has(code))
      .filter((code) => !NAMED_WITHOUT_A_RAISE_IN_DOCS[code])
    expect(orphans).toEqual([])
  })

  it('keeps the exception list honest in the other direction too', () => {
    // ⚠️ A list of exceptions rots the way a list of rules does. An entry whose
    // code HAS a raiser now is a line nobody removed — and it would quietly
    // exempt that code from the check forever. This is what will fire the day
    // somebody deposits the day-status RPC.
    const noLongerNeeded = Object.keys(NAMED_WITHOUT_A_RAISE_IN_DOCS).filter((code) => raised.has(code))
    expect(noLongerNeeded).toEqual([])
  })

  it('does not exempt a code that was never named at all', () => {
    // The list excuses a MISSING RAISER, not a missing sentence. An entry here
    // for something absent from RAISED_CODES would be excusing nothing and
    // reading as coverage.
    const notEvenNamed = Object.keys(NAMED_WITHOUT_A_RAISE_IN_DOCS).filter((code) => !RAISED_CODES[code])
    expect(notEvenNamed).toEqual([])
  })
})

// ── No code is declared twice ─────────────────────────────────────────────
//
// ⚠️ This reads the FILE, not the object, and that is the entire point. A
// duplicate key in an object literal is legal JavaScript: the last one wins
// and the earlier one is gone before any test can look at it. Object.keys()
// reports a clean map over a broken file, and every assertion written from
// observed behaviour agrees with the accident.
//
// It was not hypothetical. storage_not_empty was declared twice — once for
// 077a with a sentence that named the way out and said the storage returns on
// un-archiving, and once with an older, shorter one. The old one won for
// weeks. Nothing failed, and the test above asserted the winner.
//
// And it is the same shape as the duplicate entry added by hand one round
// earlier, pointing at a translation key that did not exist. Twice in two
// rounds is a class, not an incident — item «شو صنفه، ووين بيعيش كمان؟» in
// CLAUDE.md: the fix, the second site, and then a guard for the class.
describe('every code is declared exactly once', () => {
  const source = fs.readFileSync(path.join(__dirname, 'raisedCodes.js'), 'utf8')
  const start = source.indexOf('RAISED_CODES = {')
  const body = source.slice(start, source.indexOf('\n}', start))
  const declared = [...body.matchAll(/^ {2}([a-z_][a-z0-9_]*):/gm)].map((m) => m[1])

  it('reads the declarations rather than passing on an empty scan', () => {
    // A guard that scans nothing reports nothing wrong. Both are lower bounds.
    expect(start).toBeGreaterThan(-1)
    expect(declared.length).toBeGreaterThan(20)
    expect(declared).toContain('consignment_flag_locked')
  })

  it('finds no repeat', () => {
    const twice = declared.filter((code, i) => declared.indexOf(code) !== i)
    expect(twice).toEqual([])
  })

  it('would catch one', () => {
    // Counter-evidence on a copy, never on the work tree — CLAUDE.md's
    // procedure, and the half of it that touches nothing. `git checkout --`
    // has already eaten an unrelated uncommitted fix once in this project.
    const withRepeat = "RAISED_CODES = {\n  a_code: 'x',\n  b_code: 'y',\n  a_code: 'z',\n}"
    const inner = withRepeat.slice(0, withRepeat.indexOf('\n}'))
    const found = [...inner.matchAll(/^ {2}([a-z_][a-z0-9_]*):/gm)].map((m) => m[1])
    expect(found.filter((c, i) => found.indexOf(c) !== i)).toEqual(['a_code'])
  })
})

describe('a SQLSTATE override, for a failure only the caller can read', () => {
  const t = (key) => `t(${key})`
  const duplicate = { code: '23505', message: 'duplicate key value violates unique constraint' }

  it('lets the reversal screen say what 23505 means there', () => {
    // ⚠️ A unique violation is 23505 wherever it happens, and only the caller
    // knows WHICH uniqueness broke. On the reversal screen it means somebody
    // reversed the document a second ago — news, not a fault, and nothing the
    // person can fix by reviewing input they never typed (item 51).
    expect(dbErrorSentence(duplicate, t, 'test', { 23505: 'products:stock.reversedElsewhere' }))
      .toBe('t(products:stock.reversedElsewhere)')
  })

  it('keeps the generic sentence everywhere that did not ask', () => {
    // The override is per call site by design. A global table of constraint
    // names would be the inventory-not-rule fault wearing a message map: the
    // list never closes, and every new constraint is a silent gap.
    expect(dbErrorSentence(duplicate, t, 'test')).toBe('t(common:dbError.duplicate)')
  })

  it('still prefers a raised code over a SQLSTATE override', () => {
    // A named refusal is the more specific fact, so it wins even when the
    // caller also named the SQLSTATE.
    const raised = { code: 'P0001', message: 'already_reversed' }
    expect(dbErrorSentence(raised, t, 'test', { 23505: 'products:stock.reversedElsewhere' }))
      .toBe('t(products:stock.alreadyReversed)')
  })
})
