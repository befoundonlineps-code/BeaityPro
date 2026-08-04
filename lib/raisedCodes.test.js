import { dbErrorKey, isUnexpectedDbError } from './dbErrors'
import { rpcErrorKey } from './rpcErrors'
import { raisedCode, isUnnamedRaise } from './raisedCodes'

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
    expect(dbErrorKey(trigger('storage_not_empty'))).toBe('common:dbError.ruleRefused')
    expect(isUnnamedRaise(trigger('storage_not_empty'))).toBe(true)
  })

  it('still reaches the console, because somebody has to name it', () => {
    expect(isUnexpectedDbError(trigger('storage_not_empty'))).toBe(true)
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
