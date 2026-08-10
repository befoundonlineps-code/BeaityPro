const fs = require('fs')
const path = require('path')
const {
  OPERATION_TABLE, TABLE_NEEDS_STORAGE, TABLE_STORAGE_SCOPE, TOOLBAR_GROUPS,
  isStorageScoped,
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
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THIS GUARD DOES NOT PROVE, WRITTEN HERE RATHER THAN DISCOVERED LATER
//
// It reads docs/sql. So it proves THE CODE MATCHES THE SCRIPTS. It does not
// prove the scripts match the database, and it cannot — it has no connection to
// one.
//
// That gap is wider in this project than in most: the owner runs every script
// by hand in the Supabase SQL editor, so between a file here and a column there
// stands a person and a step. A script can sit in this folder unrun for weeks —
// 053 through 063 are recorded in docs/sql/README.md as exactly that, run state
// unknown — and this guard would go on passing about all of them.
//
// The other half — storage_id NOT NULL read from the live catalogue rather than
// from a script — is asked by docs/sql/067_2_doc_types_and_storage_columns.sql,
// and product_orders' emptiness by 067_3. Those files exist so the claim has an
// address in this repository instead of living in a conversation; ⚠️ THEY ARE
// QUESTIONS, NOT ANSWERS, until docs/sql/README.md records their results.
//
// And even once recorded, a live read is a reading of one moment rather than a
// standing promise. If the schema drifts, what notices is another live read —
// never this file.
const SQL_DIR = path.join(__dirname, '..', 'docs', 'sql')

// ⚠️ THE EXCEPTION LIST MOVED INTO THE MAP, AND THAT IS THE WHOLE POINT.
//
// It used to live here, as NO_CREATION_SCRIPT — so the map read as uniformly
// verified while one of its three entries was only being passed through. And
// that entry is stock_documents, which greys FIVE of the six operations: the
// heaviest line was the unchecked one, and nothing beside it said so.
//
// Now each entry carries `evidence`, and this file asserts the claim the field
// makes rather than the field's existence:
//
//   'script'   -> a create block must EXIST, must parse, and must agree
//   'document' -> a create block must NOT exist
//
// The second is what fails closed. The day somebody writes a creation script
// for stock_documents, this test breaks — because an entry claiming to be
// unverifiable while sitting next to its own script is a stale exemption, and
// stale exemptions are how a guard quietly stops guarding.

const files = fs.readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql'))

// ⚠️ Anchored at the start of a line, which is what keeps it off to_storage_id.
// Proved below with a block containing both columns rather than argued for
// here — see 'reads storage_id and not to_storage_id'.
function hasMandatoryStorage(body) {
  return /^\s*storage_id\s+\w+[^,]*?\bnot\s+null\b/im.test(body)
}

// The column names a create block declares.
//
// ⚠️ THIS EXISTS BECAUSE "no storage_id here" AND "I could not read this" WERE
// THE SAME ANSWER, and they came out of the guard written to stop exactly that.
// product_orders genuinely has no storage_id, so the check returns false — and
// a parse that failed for any reason (two columns on one line, a format nobody
// anticipated, the anchor not matching) returns false too. A fact and a fault
// with one output, in the direction that LIGHTS THE BUTTON.
//
// So the block is asked what columns it has, not whether one column is there.
// Every table in this schema declares id and salon_id; a block that yields
// neither was not understood, whatever else it yielded. Then "no storage_id" is
// news about a table that was read, rather than about text that was not.
//
// It is the same distinction as zero versus a dash in the balance column, moved
// inside the guard: an answer and an absence of one must not look alike.
function columnsOf(body) {
  return body
    .split('\n')
    .map((line) => line.match(/^\s{2,}([a-z_][a-z0-9_]*)\s+(?:uuid|text|numeric|boolean|timestamptz|integer|date|jsonb)\b/i))
    .filter(Boolean)
    .map((m) => m[1].toLowerCase())
}

function wasParsed(body) {
  const cols = columnsOf(body)
  return cols.includes('id') && cols.includes('salon_id')
}

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

  it.each(Object.keys(TABLE_STORAGE_SCOPE))('%s', (table) => {
    const entry = TABLE_STORAGE_SCOPE[table]
    const block = createBlockFor(table)

    expect(['script', 'document']).toContain(entry.evidence)

    if (entry.evidence === 'document') {
      // ⚠️ The claim being tested is "there is nothing here to read". If a
      // script has since appeared, the entry is lying about its own footing and
      // must be upgraded to 'script' — an exemption that outlives its reason is
      // how a guard stops guarding without anyone deciding that it should.
      expect(block).toBeNull()
      // And the survey that DOES ask the database has to be named, so the claim
      // has an address rather than a memory.
      expect(entry.survey).toMatch(/^\d{3}_\d+_[a-z_]+\.sql$/)
      expect(files).toContain(entry.survey)
      return
    }

    expect(block).not.toBeNull()
    // ⚠️ FIRST: was this block understood at all? Without this line, a false
    // from hasMandatoryStorage would be believed whether it means "there is no
    // such column" or "I did not read this text".
    expect(wasParsed(block.body)).toBe(true)
    expect(hasMandatoryStorage(block.body)).toBe(entry.needsStorage)
  })

  it('keeps the boolean map and the evidence map in step', () => {
    // TABLE_NEEDS_STORAGE is derived, so this cannot fail today — it is here so
    // that turning it back into a hand-written literal fails immediately rather
    // than drifting.
    for (const [table, entry] of Object.entries(TABLE_STORAGE_SCOPE)) {
      expect(TABLE_NEEDS_STORAGE[table]).toBe(entry.needsStorage)
    }
    expect(Object.keys(TABLE_NEEDS_STORAGE).sort())
      .toEqual(Object.keys(TABLE_STORAGE_SCOPE).sort())
  })

  it('tells a table with no storage_id from a block it failed to read', () => {
    // ⚠️ The fourth case, and the one the first three were missing: they were
    // all blocks that PARSE. None of them was a block that does not, so none of
    // them could distinguish the two ways of arriving at false.
    const realTableWithoutStorage = `
      id         uuid primary key default gen_random_uuid(),
      salon_id   uuid not null references public.salons (id),
      order_date date not null default current_date,
    `
    const unreadable = 'id uuid primary key, salon_id uuid not null, storage_id uuid not null'

    // Both answer "no mandatory storage_id"…
    expect(hasMandatoryStorage(realTableWithoutStorage)).toBe(false)
    expect(hasMandatoryStorage(unreadable)).toBe(false)

    // …and only one of them is entitled to be believed.
    expect(wasParsed(realTableWithoutStorage)).toBe(true)
    expect(wasParsed(unreadable)).toBe(false)
  })

  it('reads storage_id and not to_storage_id, in a block that has both', () => {
    // ⚠️ stock_documents carries TWO columns ending in storage_id: storage_id,
    // which is NOT NULL, and to_storage_id, which is nullable. A pattern that
    // matched the destination column instead of the source would report
    // "nullable" and LIGHT THE BUTTON — the same direction as the bug this file
    // already had once.
    //
    // What makes it safe is the `^\s*` anchor, not a word boundary: a line
    // beginning `to_storage_id` cannot begin `storage_id`. That is easy to
    // reason about and easy to be wrong about, so it is measured instead —
    // with the dangerous arrangement written out, in both orders, because a
    // single ordering would pass under a pattern that scans only the first
    // match.
    const destinationFirst = `
      id           uuid primary key,
      to_storage_id uuid references public.storages (id),
      storage_id   uuid not null references public.storages (id),
    `
    const sourceFirst = `
      id           uuid primary key,
      storage_id   uuid not null references public.storages (id),
      to_storage_id uuid references public.storages (id),
    `
    expect(hasMandatoryStorage(destinationFirst)).toBe(true)
    expect(hasMandatoryStorage(sourceFirst)).toBe(true)

    // And the counter-example that must NOT pass: only the nullable
    // destination present. If this ever returns true the anchor has been lost.
    const onlyDestination = `
      id           uuid primary key,
      to_storage_id uuid not null references public.storages (id),
    `
    expect(hasMandatoryStorage(onlyDestination)).toBe(false)
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
