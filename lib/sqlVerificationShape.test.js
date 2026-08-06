const fs = require('fs')
const path = require('path')

// A verification query that cannot run is worse than no verification, because
// of what it takes down with it.
//
// ⚠️ THE INCIDENT. 051c ended with `select count(*), (length(p.prosrc) - ...)
// ... from pg_proc p` — an aggregate beside bare column expressions with no
// GROUP BY, which Postgres refuses. The SQL editor runs a file as ONE
// transaction, so the refusal rolled back the CREATE OR REPLACE above it. The
// function was never saved and the file said nothing about it.
//
// Two things were wrong, and only one of them was the SQL:
//
//  1. The query was invalid. 050d had the same shape and worked, because it had
//     no count(*) — adding one turned every other column into a grouping error.
//  2. The file's header claimed safety on the wrong ground: "no RAISE is
//     executed here". CLAUDE.md's rule was written about a deliberate RAISE
//     because that is how the class was first met, and the class is wider —
//     ANY failing statement rolls back the DDL above it.
//
// ⚠️ And nothing in the changed script could have caught it: a query that
// errors reports the error, not the rollback it caused. What caught it was
// 051d, a SEPARATE file, reporting rev_copies_bonus_expect_1 = 0.
//
// This test catches the SHAPE. It is deliberately narrow — it is not a SQL
// validator and does not claim to be one. It answers exactly one question, the
// one that cost a round: is there a select with a top-level aggregate, no GROUP
// BY, and a column reference outside that aggregate?
const ROOT = path.join(__dirname, '..')
const SQL_DIR = path.join(ROOT, 'docs', 'sql')

const AGGREGATES = /^\s*(count|sum|avg|min|max|bool_or|bool_and|string_agg|array_agg|jsonb_agg)\s*\(/i

// Dollar-quoted function bodies are not this file's business: the statements
// inside them are planned by PL/pgSQL when the function runs, not by the editor
// when the script does, and they are full of selects that would confuse every
// rule below.
//
// ⚠️ ONE SCANNER, NOT TWO PASSES, and this guard's own first draft is why.
// Stripping comments and then strings flags 047 — a valid, already-run script —
// because it contains E'\n---\n', whose `---` is not a comment. The comment pass
// ate the rest of that line including the closing quote, the string pass then
// mangled everything after it, and the `group by` two lines down disappeared.
//
// A `--` inside a string is not a comment and a quote inside a comment is not a
// string; neither can be decided without reading left to right, once.
function strippable(sql) {
  const source = sql.replace(/\$([a-zA-Z_]*)\$[\s\S]*?\$\1\$/g, ' BODY ')
  let out = ''
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "'") {
      i += 1
      while (i < source.length) {
        if (source[i] === "'") {
          if (source[i + 1] !== "'") break
          i += 1
        }
        i += 1
      }
      out += "''"
      continue
    }
    if (source[i] === '-' && source[i + 1] === '-') {
      while (i < source.length && source[i] !== '\n') i += 1
      out += '\n'
      continue
    }
    out += source[i]
  }
  return out
}

// Split on a delimiter that is at bracket depth zero.
function splitTop(text, delimiter) {
  const parts = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '(') depth += 1
    else if (ch === ')') depth -= 1
    else if (ch === delimiter && depth === 0) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts
}

// The index of a keyword at bracket depth zero, or -1.
function indexOfTop(text, keyword) {
  const pattern = new RegExp(`\\b${keyword}\\b`, 'gi')
  let match = pattern.exec(text)
  while (match) {
    let depth = 0
    for (let i = 0; i < match.index; i += 1) {
      if (text[i] === '(') depth += 1
      else if (text[i] === ')') depth -= 1
    }
    if (depth === 0) return match.index
    match = pattern.exec(text)
  }
  return -1
}

// Remove balanced groups whose contents are a subquery. A column reference
// inside one is that subquery's business, not this select's.
function dropSubqueries(item) {
  let out = ''
  let depth = 0
  let groupStart = -1
  for (let i = 0; i < item.length; i += 1) {
    const ch = item[i]
    if (ch === '(') {
      if (depth === 0) groupStart = i
      depth += 1
    } else if (ch === ')') {
      depth -= 1
      if (depth === 0) {
        const inner = item.slice(groupStart + 1, i)
        out += /^\s*select\b/i.test(inner) ? ' ' : `(${dropSubqueries(inner)})`
        groupStart = -1
      }
    } else if (depth === 0) {
      out += ch
    }
  }
  return out
}

function violationsIn(sql) {
  const found = []
  for (const statement of splitTop(strippable(sql), ';')) {
    const selectAt = indexOfTop(statement, 'select')
    if (selectAt < 0) continue

    const afterSelect = statement.slice(selectAt + 'select'.length)
    const fromAt = indexOfTop(afterSelect, 'from')
    const selectList = fromAt < 0 ? afterSelect : afterSelect.slice(0, fromAt)

    const items = splitTop(selectList, ',')
    if (!items.some((item) => AGGREGATES.test(item))) continue
    if (indexOfTop(statement, 'group') >= 0) continue

    for (const item of items) {
      if (AGGREGATES.test(item)) continue
      // A qualified column: `p.prosrc`, `m.unit_cost`. Unqualified names cannot
      // be told from function names without a catalogue, so they are left
      // alone — this fails towards silence on shapes it cannot read, and
      // catches the one it can.
      if (/\b[a-z_]+\.[a-z_]+/i.test(dropSubqueries(item))) {
        found.push(item.trim().replace(/\s+/g, ' ').slice(0, 90))
      }
    }
  }
  return found
}

describe('a verification query cannot take the change down with it', () => {
  const files = fs.readdirSync(SQL_DIR).filter((name) => name.endsWith('.sql'))

  it('reads every script in docs/sql', () => {
    // Guarding an empty list is the failure mode this project has already paid
    // for twice. If the folder moves, this says so instead of passing.
    expect(files.length).toBeGreaterThan(10)
  })

  it.each(files)('%s mixes no aggregate with an ungrouped column', (name) => {
    expect(violationsIn(fs.readFileSync(path.join(SQL_DIR, name), 'utf8'))).toEqual([])
  })

  // ⚠️ COUNTER-EVIDENCE BEFORE BELIEF. A guard that has never been shown
  // failing is a guard nobody has tested — and on this project the false ✓ has
  // been the expensive direction, not the false ✗. This is the exact text that
  // rolled 051c back, and the exact text that replaced it.
  it('fails on the query that actually caused this, and passes the fix', () => {
    const broken = `
      select
        count(*) as copies_expect_1,
        (length(p.prosrc) - length(replace(p.prosrc, 'm.bonus_quantity', '')))
          / length('m.bonus_quantity') as copies_bonus_expect_1
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'reverse_stock_document';`

    const fixed = `
      with rev as (
        select p.prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'reverse_stock_document'
      )
      select
        (select count(*) from rev) as copies_expect_1,
        (select (length(prosrc) - length(replace(prosrc, 'm.bonus_quantity', '')))
                / length('m.bonus_quantity') from rev) as copies_bonus_expect_1;`

    expect(violationsIn(broken)).toHaveLength(1)
    expect(violationsIn(fixed)).toEqual([])
  })

  it('leaves the shape that is legal alone', () => {
    // 050d had exactly these columns and ran fine, because it had no aggregate
    // beside them. Flagging it would make this guard noise, and a noisy guard
    // gets deleted.
    const legal = `
      select (length(p.prosrc) - length(replace(p.prosrc, 'm.entered_unit_price', '')))
             / length('m.entered_unit_price') as copies_price
      from pg_proc p where p.proname = 'reverse_stock_document';`
    expect(violationsIn(legal)).toEqual([])

    // And an aggregate-only list is legal however many there are.
    const allAggregates = `
      select count(*) as copies, bool_or(p.prosrc like '%x%') as has_x
      from pg_proc p where p.proname = 'post_stock_document';`
    expect(violationsIn(allAggregates)).toEqual([])
  })

  it('does not read a dash inside a string as the start of a comment', () => {
    // ⚠️ The guard's own first bug, kept as a case. 047 groups correctly and was
    // flagged anyway, because E'\\n---\\n' had its `---` taken for a comment —
    // which swallowed the closing quote, then the line, then the GROUP BY two
    // lines below. A guard that cannot read a separator string cannot be
    // trusted about the query containing it.
    const grouped = `
      select p.proname, count(*) as copies,
             string_agg(p.oid::text, E'\\n---\\n') as signatures
      from pg_proc p
      group by p.proname;`
    expect(violationsIn(grouped)).toEqual([])
  })
})
