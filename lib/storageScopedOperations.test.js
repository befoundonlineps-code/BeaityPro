const fs = require('fs')
const path = require('path')
const {
  OPERATION_TABLE, TABLE_NEEDS_STORAGE, TOOLBAR_GROUPS, isStorageScoped,
} = require('./storageScopedOperations')

// The guard that makes storageScopedOperations.js's claim true rather than
// merely tidy.
//
// ⚠️ WRITTEN BECAUSE THE SAME FAULT HAPPENED FOUR TIMES IN ONE REVIEW, and the
// cure was identical every time: not more care, but something that checks. A
// hand-written expectation in 066c_1 went stale, a remembered button count was
// wrong twice, and a claim about which PostgreSQL version catalogues NOT NULL
// was wrong in both halves. Every one of them was written by somebody who had
// just finished warning about hand-written lists.
//
// So: TABLE_NEEDS_STORAGE is read back against the schema scripts. If somebody
// adds storage_id to product_orders and does not flip the map, this fails —
// which is the difference between "the button lights correctly" and "the button
// lights correctly today".
const SQL_DIR = path.join(__dirname, '..', 'docs', 'sql')

// ⚠️ TABLES WHOSE SCHEMA THIS REPOSITORY CANNOT READ, NAMED ONE BY ONE.
//
// Everything up to stage 5 was created directly in the Supabase SQL editor, so
// there is no creation script for it here — DATABASE_DIAGRAM says so explicitly
// about the tables above product_orders. stock_documents is one of them.
//
// It is listed rather than skipped, and the list FAILS CLOSED: a new table in
// the map with no script and no entry here makes the test fail, so somebody
// looks at it once. Silently passing unverifiable keys would be the same fault
// this file exists to prevent, dressed as coverage.
const NO_CREATION_SCRIPT = {
  // Verified by 050a/051a altering it and by post_stock_document inserting into
  // it with storage_id every time; the column's NOT NULL is asserted in
  // DATABASE_DIAGRAM and relied on by 056c. Not readable from a create script.
  stock_documents: true,
}

const files = fs.readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql'))

// The create block for a table, found by searching every script rather than by
// a filename map — a filename map would be one more hand-written list.
// ⚠️ THE WORDS MUST BE ADJACENT. The first draft used `create\s+table[^;]*?` to
// allow "if not exists", and the lazy gap walked across comments and newlines
// until it reached `references public.stock_documents (` — a FOREIGN KEY, read
// as a create. It reported that stock_documents has a creation script and that
// its storage_id is not mandatory, both false.
//
// It failed on its first run, which is the only reason it is right now — and it
// is the same fault sqlVerificationShape had when it read `---` inside a string
// as a comment. A regex over SQL sees text, not structure, so the pattern has
// to be narrow enough that no gap exists for it to wander through.
function createBlockFor(table) {
  const re = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\s*\\(`, 'i'
  )
  for (const name of files) {
    const sql = fs.readFileSync(path.join(SQL_DIR, name), 'utf8')
    const m = sql.match(re)
    if (!m) continue
    // From the opening paren to its match, so a later table in the same file
    // cannot leak in.
    let depth = 0
    const start = m.index + m[0].length - 1
    for (let i = start; i < sql.length; i += 1) {
      if (sql[i] === '(') depth += 1
      else if (sql[i] === ')') {
        depth -= 1
        if (depth === 0) return { file: name, body: sql.slice(start + 1, i) }
      }
    }
  }
  return null
}

describe('the storage-scoped map matches the schema it claims to describe', () => {
  it('found the scripts it needs, rather than silently finding none', () => {
    // A derived search that quietly matched nothing would compare nothing and
    // pass — the failure mode this whole file could have had.
    expect(files.length).toBeGreaterThan(20)
    expect(createBlockFor('stocktake_sessions')).not.toBeNull()
    expect(createBlockFor('product_orders')).not.toBeNull()
  })

  it.each(Object.keys(TABLE_NEEDS_STORAGE))('%s', (table) => {
    const block = createBlockFor(table)

    if (!block) {
      // Fails closed: unreadable AND unlisted is a failure, not a skip.
      expect(NO_CREATION_SCRIPT[table]).toBe(true)
      return
    }

    const hasMandatoryStorage = /^\s*storage_id\s+\w+[^,]*?\bnot\s+null\b/im.test(block.body)
    expect(hasMandatoryStorage).toBe(TABLE_NEEDS_STORAGE[table])
  })

  it('every operation names a table the map knows, or names none', () => {
    for (const [op, table] of Object.entries(OPERATION_TABLE)) {
      if (table === null) continue
      expect(Object.keys(TABLE_NEEDS_STORAGE)).toContain(table)
    }
  })

  it('the toolbar lists every operation exactly once', () => {
    // Otherwise a button could be dropped from the bar while keeping its entry,
    // or drawn twice, and only a screenshot would say so.
    const flat = TOOLBAR_GROUPS.flat()
    expect(flat.slice().sort()).toEqual(Object.keys(OPERATION_TABLE).sort())
    expect(new Set(flat).size).toBe(flat.length)
  })

  it('greys six and leaves order lit', () => {
    // The number is derived here, not typed: this is the assertion that would
    // have caught "five" both times it was said.
    const scoped = Object.keys(OPERATION_TABLE).filter(isStorageScoped)
    expect(scoped.sort()).toEqual(
      ['opening', 'return_to_supplier', 'stocktake', 'supply', 'transfer', 'write_off']
    )
    expect(isStorageScoped('order')).toBe(false)
    expect(isStorageScoped('documents')).toBe(false)
  })
})
