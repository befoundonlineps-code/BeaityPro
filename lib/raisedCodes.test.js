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
    expect(dbErrorSentence(withHint('storage_not_empty', 'المستودع فيه رصيد'), t))
      .toBe('t(products:storages.notEmptyError)')
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
      .toBe('t(products:storages.notEmptyError)')
    expect(dbErrorSentence(withHint('consignment_locked', 'h'), t))
      .toBe('t(products:productDialog.consignmentLockedError)')
  })
})

describe('the codes read from the function text', () => {
  it('names the four that were unreachable from outside', () => {
    // ⚠️ These could never have been driven at: RLS answers storage_not_found
    // on the first lookup, so everything behind it is unreachable from outside
    // BY CONSTRUCTION. Reading the text was the only way, and it is why the
    // list stopped where it did for so long.
    for (const code of ['product_not_found', 'stock_line_zero', 'count_invalid', 'unit_cost_required']) {
      expect(RAISED_CODES[code]).toBeDefined()
    }
  })

  it('turns each of them into its own sentence, not the generic one', () => {
    const t = (key) => `t(${key})`
    for (const code of ['product_not_found', 'stock_line_zero', 'count_invalid', 'unit_cost_required']) {
      const sentence = dbErrorSentence({ code: 'P0001', message: code }, t, 'test')
      expect(sentence).toBe(`t(${RAISED_CODES[code]})`)
      expect(sentence).not.toContain('unexpected')
    }
  })

  it('still has nothing for the two functions whose text has not arrived', () => {
    // ⚠️ A record of what has been SEEN, never completed from the design.
    // transfer_stock and reverse_stock_document are outstanding, and inventing
    // plausible names for their guards would be the fault this list avoids.
    expect(RAISED_CODES.transfer_insufficient_stock).toBeUndefined()
    expect(RAISED_CODES.document_already_reversed).toBeUndefined()
  })
})
