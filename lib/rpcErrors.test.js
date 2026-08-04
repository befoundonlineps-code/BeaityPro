import fs from 'fs'
import path from 'path'
import { raisedCode, rpcErrorKey, reportRpcError, RAISED_CODES } from './rpcErrors'

const raised = (message, code = 'P0001') => ({ code, message })

describe('raisedCode', () => {
  it('finds the code when the message is exactly it', () => {
    expect(raisedCode(raised('appointment_not_cancellable'))).toBe('appointment_not_cancellable')
  })

  it('finds it inside a longer sentence', () => {
    // PostgREST has wrapped these differently across versions, which is half
    // the reason reading the message by hand was fragile.
    expect(raisedCode(raised('ERROR: appointment_not_pending (SQLSTATE P0001)')))
      .toBe('appointment_not_pending')
  })

  it('does not match a code embedded in a longer identifier', () => {
    // The improvement over includes(): today no code is a prefix of another,
    // and this is what keeps that from mattering the day one is.
    expect(raisedCode(raised('appointment_not_pending_review'))).toBe(null)
    expect(raisedCode(raised('x_appointment_not_pending'))).toBe(null)
  })

  it('is null for an error that raised nothing of ours', () => {
    expect(raisedCode({ code: '23505', message: 'duplicate key value' })).toBe(null)
    expect(raisedCode(null)).toBe(null)
    expect(raisedCode({})).toBe(null)
  })
})

describe('rpcErrorKey', () => {
  it('returns the key for a raised code', () => {
    expect(rpcErrorKey(raised('participant_is_primary')))
      .toBe('appointments:actionsDialog.isPrimaryError')
  })

  it('lets a screen override one code without touching the rest', () => {
    // The case that made overrides necessary rather than tidy: this code says
    // "cannot be cancelled" in the actions dialog and "your view is stale" in
    // the day-status dialogs, because there a booking that moved underneath
    // somebody releasing a whole day is news, not a refusal.
    const overrides = { appointment_not_cancellable: 'appointments:dayStatus.staleError' }

    expect(rpcErrorKey(raised('appointment_not_cancellable'), overrides))
      .toBe('appointments:dayStatus.staleError')
    expect(rpcErrorKey(raised('participant_is_primary'), overrides))
      .toBe('appointments:actionsDialog.isPrimaryError')
  })

  it('falls through to dbErrors when nothing of ours was raised', () => {
    // A constraint violation still gets its own wording rather than the
    // generic one, which a standalone map would have thrown away.
    expect(rpcErrorKey({ code: '23P01', message: 'conflicting key value' }))
      .toBe('common:dbError.slotTaken')
    expect(rpcErrorKey({ code: '23505', message: 'duplicate' }))
      .toBe('common:dbError.duplicate')
  })

  it('gives the generic key for something nobody has explained yet', () => {
    expect(rpcErrorKey({ code: 'XX000', message: 'internal error' }))
      .toBe('common:dbError.unexpected')
  })
})

describe('reportRpcError', () => {
  let spy
  beforeEach(() => { spy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => { spy.mockRestore() })

  it('stays quiet for a code we raise on purpose', () => {
    expect(reportRpcError(raised('appointment_not_cancellable'), 'test'))
      .toBe('appointments:actionsDialog.notCancellableError')
    expect(spy).not.toHaveBeenCalled()
  })

  it('stays quiet for a SQLSTATE dbErrors already explains', () => {
    reportRpcError({ code: '23505', message: 'duplicate' }, 'test')
    expect(spy).not.toHaveBeenCalled()
  })

  it('records anything nobody has decided how to explain', () => {
    // Translating without recording trades a confused user for a fault nobody
    // can find — the same reason reportDbError logs.
    reportRpcError({ code: 'XX000', message: 'something new' }, 'test')
    expect(spy).toHaveBeenCalled()
  })
})

// The debt this file was written to pay off, kept paid.
describe('no screen reads a raised code out of the message by hand', () => {
  function sourceFiles(dir, found = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) sourceFiles(full, found)
      else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) found.push(full)
    }
    return found
  }

  const files = ['components', 'lib', 'pages', 'hooks']
    .map((dir) => path.join(__dirname, '..', dir))
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) => sourceFiles(dir))

  it('found files to check', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('has no message.includes() naming a code this module owns', () => {
    // Eighteen of these existed. Each one was a silent single point of
    // failure: rename a raised code and the match stops hitting, with no
    // error and no warning — just a specific explanation quietly replaced by
    // "something went wrong", on a screen that still appears to work.
    const offenders = []
    for (const file of files) {
      if (file.endsWith('rpcErrors.js')) continue
      const source = fs.readFileSync(file, 'utf8')
      for (const code of Object.keys(RAISED_CODES)) {
        if (new RegExp(`includes\\(\\s*['"\`]${code}`).test(source)) {
          offenders.push(`${path.basename(file)} → ${code}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
