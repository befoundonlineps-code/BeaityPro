const fs = require('fs')
const path = require('path')
const {
  strippable, splitTop, indexOfTop, dropSubqueries, statementsOf,
} = require('../test-utils/sqlStatements')

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
// The two guards below answer the two halves. The first checks the SHAPE of a
// query and is deliberately narrow. The second checks the STRUCTURE of a file
// and is the one that actually closes the class — because "will this statement
// fail?" cannot be decided by reading it, while "can this statement's failure
// undo a change?" can.
const ROOT = path.join(__dirname, '..')
const SQL_DIR = path.join(ROOT, 'docs', 'sql')
const FILES = fs.readdirSync(SQL_DIR).filter((name) => name.endsWith('.sql'))

const AGGREGATES = /^\s*(count|sum|avg|min|max|bool_or|bool_and|string_agg|array_agg|jsonb_agg)\s*\(/i

function violationsIn(sql) {
  const found = []
  for (const { text: statement } of statementsOf(sql)) {
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

describe('an aggregate does not sit beside an ungrouped column', () => {
  it('reads every script in docs/sql', () => {
    // Guarding an empty list is the failure mode this project has already paid
    // for twice. If the folder moves, this says so instead of passing.
    expect(FILES.length).toBeGreaterThan(10)
  })

  it.each(FILES)('%s', (name) => {
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

  it('leaves the shapes that are legal alone', () => {
    // 050d had exactly these columns and ran fine, because it had no aggregate
    // beside them. Flagging it would make this guard noise, and a noisy guard
    // gets deleted.
    expect(violationsIn(`
      select (length(p.prosrc) - length(replace(p.prosrc, 'm.entered_unit_price', '')))
             / length('m.entered_unit_price') as copies_price
      from pg_proc p where p.proname = 'reverse_stock_document';`)).toEqual([])

    expect(violationsIn(`
      select count(*) as copies, bool_or(p.prosrc like '%x%') as has_x
      from pg_proc p where p.proname = 'post_stock_document';`)).toEqual([])
  })

  it('does not read a dash inside a string as the start of a comment', () => {
    // ⚠️ The guard's own first bug, kept as a case. 047 groups correctly and was
    // flagged anyway, because E'\\n---\\n' had its `---` taken for a comment —
    // which swallowed the closing quote, then the line, then the GROUP BY two
    // lines below. A guard that cannot read a separator string cannot be
    // trusted about the query containing it.
    expect(violationsIn(`
      select p.proname, count(*) as copies,
             string_agg(p.oid::text, E'\\n---\\n') as signatures
      from pg_proc p
      group by p.proname;`)).toEqual([])
  })
})

// ---------------------------------------------------------------------------

// ⚠️ THE HALF THAT ACTUALLY CLOSES THE CLASS, and it is structural rather than
// clever. The rule above catches one shape of failing query; a misspelt column,
// an ambiguous reference, a type that will not cast and a division by zero all
// fail identically and none of them can be seen by reading the text. "Will this
// statement fail?" is not decidable here. "Can this statement's failure undo a
// change?" is — and it is the only question that matters, because a verification
// that cannot undo anything is safe however wrong it is.
//
// ⚠️ NOT "ONE EXECUTABLE STATEMENT PER FILE", which was the shape first
// proposed. That would reject 051a, whose six statements — add the column, drop
// and add two constraints, comment it — MUST be one transaction: if a constraint
// is refused by existing rows, the column has to go with it. Atomic DDL is the
// feature, not the hazard. The hazard is a REPORTING query sharing a transaction
// with the change it reports on.
const MIXED_BEFORE_THE_RULE = new Set([
  '042-probe-select-into.sql', '043-cost-estimated.sql',
  '044-reversal-transfer-shape.sql', '045-reversal-race.sql',
  '046-cost-estimated-comment.sql', '047-supplier-doc-number.sql',
  '049a-post-stock-document.sql', '049b-post-stocktake.sql',
  '049c-transfer-stock.sql', '049d-reverse-stock-document.sql',
  '050a-document-money-columns.sql', '050b-line-price-columns.sql',
  '050c-post-stock-document.sql', '050d-reverse-stock-document.sql',
  '051a-bonus-quantity-column.sql', '051b-post-stock-document.sql',
  '051c-reverse-stock-document.sql',
])

describe('a change and the query that checks it do not share a transaction', () => {
  it.each(FILES)('%s', (name) => {
    const statements = statementsOf(fs.readFileSync(path.join(SQL_DIR, name), 'utf8'))
    const mixes = statements.some((s) => s.kind === 'ddl')
      && statements.some((s) => s.kind === 'query')

    // ⚠️ AN EXCEPTION LIST, WHICH FAILS CLOSED. Every one of these has already
    // been run against production; splitting them now would rewrite the record
    // of what was executed, which is the only record there is. A new file that
    // mixes is not on the list and fails — somebody looks at it once, which is
    // the whole design.
    expect(mixes).toBe(MIXED_BEFORE_THE_RULE.has(name))
  })

  it('every grandfathered name still exists', () => {
    // Otherwise the list quietly becomes a list of nothing, and a renamed file
    // would slip through under its old exemption.
    for (const name of MIXED_BEFORE_THE_RULE) expect(FILES).toContain(name)
  })

  it('separates a change from its check, and knows the difference from atomic DDL', () => {
    const ddl = `
      alter table public.t add column c numeric;
      alter table public.t add constraint t_c_positive check (c is null or c > 0);
      comment on column public.t.c is 'شيء';`
    const check = `
      select (select data_type from information_schema.columns
              where table_name = 't' and column_name = 'c') as type_expect_numeric;`
    const together = `${ddl}\n${check}`

    const mixed = (sql) => statementsOf(sql).some((s) => s.kind === 'ddl')
      && statementsOf(sql).some((s) => s.kind === 'query')

    // Three DDL statements in one file is the point, not the problem.
    expect(mixed(ddl)).toBe(false)
    expect(statementsOf(ddl)).toHaveLength(3)
    // A check on its own can be as wrong as it likes and undo nothing.
    expect(mixed(check)).toBe(false)
    // Together is the arrangement that cost a round.
    expect(mixed(together)).toBe(true)
  })

  it('does not mistake `create ... as select` for a separate query', () => {
    // The select never starts a statement of its own, so a view definition is
    // one DDL statement and not a change plus a check.
    const view = `create or replace view public.v with (security_invoker = true)
                  as select id, name from public.t;`
    expect(statementsOf(view).map((s) => s.kind)).toEqual(['ddl'])
  })
})

// ==========================================================================
// A CHECK constraint rejects a row only when its expression is FALSE. UNKNOWN
// passes. So `col = 'literal'` on a nullable column does not refuse a NULL —
// it waves it through, and reads exactly like a rule that refuses it.
//
// ⚠️ THIS COST A REVIEW ROUND. 052b's first draft refused "a discount value
// with no kind" in its header and did not refuse it in its expression:
//
//     value 300, kind NULL  ->  REJECTED   (both branches reach FALSE anyway)
//     value  10, kind NULL  ->  ACCEPTED   (the ambiguous one, and the point)
//
// The absurd value was caught by accident and the plausible one let through, so
// the constraint caught the case nobody would write and missed the case it was
// written for. Measured over the whole case set, not reasoned.
// ==========================================================================

// Equality comparisons on a column, inside a CHECK, that nothing in the same
// expression proves non-null. Reviewed once each; the list fails CLOSED, so a
// new one appears here as a failure rather than as silence.
const NULL_SAFE_BY_REVIEW = {
  // 044: `doc_type = 'reversal' or (doc_type = 'transfer') = (to_storage_id is
  // not null)`. Safe only if doc_type can never be null — a NULL there would
  // make the whole expression UNKNOWN and let the row through, exactly as
  // happened in 052b's first draft.
  //
  // ✅ MEASURED, not assumed: 052c read information_schema and
  // stock_documents.doc_type is NOT NULL. The repository could not answer it —
  // the diagram lists the column without its nullability — so the question was
  // hung on a verification script that had to run anyway.
  //
  // ⚠️ Which means this entry has a lifetime: if doc_type is ever made
  // nullable, 044 acquires the hole and this line becomes a lie. Nothing here
  // can see that happen. It is the exception that carries the most risk, and
  // saying so is the only guard available.
  '044-reversal-transfer-shape.sql': ['doc_type'],

  // 056a: `(role_at_resolution is not null) = (resolution = 'role_responsible')`.
  // Safe only if `resolution` can never be null — a NULL there would make the
  // right side UNKNOWN, the equality UNKNOWN, and the row would pass.
  //
  // ✅ AND IT IS SAFE ON STRONGER GROUND THAN 044's. doc_type's NOT NULL had to
  // be measured by a separate script (052c) because the column predates this
  // project; `resolution NOT NULL` is declared in the SAME statement as this
  // constraint, twelve lines above it. The two cannot drift apart without
  // somebody editing one file and reading the other.
  //
  // ⚠️ The sibling check on the same table uses IN rather than `=` so it never
  // reaches this guard, and it is safe for exactly the same reason. That is
  // worth knowing: passing here is not evidence about it.
  '056a-stock-fines.sql': ['resolution'],
}

function checkExpressions(sql) {
  const text = strippable(sql)
  const out = []
  const pattern = /\bcheck\s*\(/gi
  let match = pattern.exec(text)
  while (match) {
    let depth = 1
    let i = match.index + match[0].length
    const start = i
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth += 1
      else if (text[i] === ')') depth -= 1
      i += 1
    }
    out.push(text.slice(start, i - 1))
    match = pattern.exec(text)
  }
  return out
}

function unguardedEqualities(sql) {
  const found = new Set()
  for (const expression of checkExpressions(sql)) {
    for (const [, column] of expression.matchAll(/\b([a-z_]+)\s*=\s*''/g)) {
      // ⚠️ Doubled backslashes: inside a template literal `\b` is a backspace
      // character, not a word boundary, and `\s` is a plain "s". The first
      // draft of this line built a regex that could not compile.
      const guarded = new RegExp(
        `\\b${column}\\s+is\\s+not\\s+null|coalesce\\s*\\(\\s*${column}\\b`, 'i'
      )
      if (!guarded.test(expression)) found.add(column)
    }
  }
  return [...found]
}

describe('a CHECK cannot refuse what it only finds UNKNOWN', () => {
  const files = fs.readdirSync(SQL_DIR).filter((name) => name.endsWith('.sql'))

  it.each(files)('%s guards every equality it tests a column with', (name) => {
    const found = unguardedEqualities(fs.readFileSync(path.join(SQL_DIR, name), 'utf8'))
    expect(found).toEqual(NULL_SAFE_BY_REVIEW[name] || [])
  })

  // ⚠️ Counter-evidence: the exact expression that was wrong, and the one that
  // replaced it. Note that strippable() has already turned every string literal
  // into '' by the time this runs, which is why the pattern matches on that.
  it('flags the draft that shipped and clears the fix', () => {
    const broken = `alter table t add constraint c check (
      line_discount_value is null
      or (line_discount_kind = 'percent' and line_discount_value <= 100)
      or (line_discount_kind = 'amount' and entered_unit_price is not null));`
    expect(unguardedEqualities(broken)).toEqual(['line_discount_kind'])

    const fixed = `alter table t add constraint c check (
      line_discount_value is null
      or (line_discount_kind is not null and (
        (line_discount_kind = 'percent' and line_discount_value <= 100)
        or (line_discount_kind = 'amount' and entered_unit_price is not null))));`
    expect(unguardedEqualities(fixed)).toEqual([])
  })

  it('accepts coalesce as the guard too, since it is equally null-safe', () => {
    // The reviewer proposed coalesce. It is correct; 052b states the pairing as
    // its own conjunct instead so one clause governs every branch and a third
    // kind cannot arrive unwrapped. Both must pass here, or this guard would be
    // enforcing a style rather than the property.
    const withCoalesce = `alter table t add constraint c check (
      v is null or coalesce(k, '') = 'percent');`
    expect(unguardedEqualities(withCoalesce)).toEqual([])
  })

  it('says nothing about equalities outside a CHECK', () => {
    // A WHERE clause has the same three-valued behaviour, but a survey is read
    // by a person and a constraint is installed on production. Widening this to
    // every query would flag most of docs/sql and get switched off.
    const plainQuery = `select * from stock_movements where line_discount_kind = 'amount';`
    expect(unguardedEqualities(plainQuery)).toEqual([])
  })
})
