const fs = require('fs')
const path = require('path')

// ==========================================================================
// THE FIVE-TIER COST LADDER NOW LIVES IN TWO SQL FILES, AND THIS IS THE ONE
// WALK MADE CHECKABLE.
//
// ⚠️ IT EXISTS BECAUSE A CLAIM WAS OVERSTATED, and the reviewer asked the right
// question about it. 054c's header says its body was "taken mechanically" from
// 043-cost-estimated.sql. That is true of the cost ladder and NOT true of the
// function: the loop was rewritten to read a table instead of a jsonb argument,
// the session lock and the balance update are new, and two variables were
// renamed. "Mechanically" was carried over from 049b's header, where it
// described a genuine copy of three hint strings, and it did not apply here.
//
// So the part where it MUST hold is measured rather than asserted. The ladder is
// the part where a dropped line is invisible: every tier produces a number, so a
// missing tier does not fail — it hands back a different cost, once, for a
// product with no history, and the stamped unit_cost is permanent (ADR-051).
//
// ⚠️ AND IT IS THE PART A REWRITE IS MOST LIKELY TO DAMAGE, because it is the
// part nobody is thinking about while restructuring the loop around it.
//
// ADR-053, in SQL: what appears in two places is derived from one walk. These
// two cannot import each other, so the next best thing is a test that fails the
// day they drift.
// ==========================================================================
const SQL_DIR = path.join(__dirname, '..', 'docs', 'sql')

// The ladder, cut out of a file by its own landmarks rather than by line
// numbers — which would silently select the wrong region the first time either
// file gained a comment.
function ladderOf(file) {
  const text = fs.readFileSync(path.join(SQL_DIR, file), 'utf8')
  const start = text.indexOf('if not v_estimated then')
  const tierFive = text.indexOf('v_cost := coalesce(v_cost, 0);', start)
  const end = text.indexOf('end if;', tierFive)
  // Failing loudly here matters more than anywhere: a silent miss would compare
  // two empty strings and pass.
  expect(start).toBeGreaterThan(-1)
  expect(tierFive).toBeGreaterThan(start)
  expect(end).toBeGreaterThan(tierFive)
  return text.slice(start, end + 'end if;'.length)
}

// Comments and blank lines out, whitespace flattened. The reasoning is
// deliberately NOT compared: 043 carries the full argument for each tier and
// 054c points at it, which is the arrangement this project wants — one account,
// not two paraphrases free to drift.
const statements = (block) => block
  .split(/\r?\n/)
  .map((line) => line.replace(/--.*$/, '').trim())
  .filter(Boolean)
  .map((line) => line.replace(/\s+/g, ' '))

// The two renames 054c made, applied to the canonical text before comparing.
// Listed here rather than tolerated by a fuzzy match: a rename somebody makes
// later has to be added on purpose, and adding it is where they notice they
// have changed the ladder.
const RENAMES = [
  // The storage arrives from the session row instead of a parameter.
  [/\bp_storage_id\b/g, 'v_storage_id'],
  // The product comes off the count row instead of a scalar parsed from jsonb.
  [/\bv_pid\b/g, 'v_row.product_id'],
]

const withRenames = (lines) => lines.map(
  (line) => RENAMES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), line)
)

describe('post_stocktake_session carries the canonical cost ladder unchanged', () => {
  const canonical = withRenames(statements(ladderOf('043-cost-estimated.sql')))
  const rewritten = statements(ladderOf('054c-post-stocktake-session.sql'))

  it('found a ladder in both files rather than two empty strings', () => {
    // The failure mode this whole file could have had.
    expect(canonical.length).toBeGreaterThan(10)
    expect(rewritten.length).toBe(canonical.length)
  })

  it('matches line for line', () => {
    // ✅ Measured, not described: 20 of 20 identical after the two renames.
    expect(rewritten).toEqual(canonical)
  })

  it('still has all five tiers, named by what makes each one different', () => {
    // A parity test alone would pass if BOTH files lost a tier on the same day.
    // These are the marks that distinguish the tiers from each other.
    const text = ladderOf('054c-post-stocktake-session.sql')
    // 1: the weighted average of this storage.
    expect(text).toContain('sum(quantity_base * unit_cost) / sum(quantity_base)')
    // 2: the last receipt in this storage.
    expect(text).toMatch(/storage_id = v_storage_id[\s\S]*quantity_base > 0[\s\S]*order by created_at desc/)
    // 3: the last receipt anywhere in the salon — the tier 043 added, and the
    //    one a rewrite drops most easily because it looks like a repeat of 2.
    expect(text).toContain('m.salon_id = v_salon_id')
    // 4: the catalogue's nominal price.
    expect(text).toContain('nominal_purchase_price')
    // 5: zero, and only as the last word.
    expect(text).toContain('coalesce(v_cost, 0)')
  })

  it('keeps the negation written once', () => {
    // 043 records the fault by name: `v_estimated := (v_balance <= 0)` sat
    // above `if v_balance > 0`, two opposites that had to stay opposite
    // forever. One of them would be edited alone one day and the disagreement
    // would be silent. So the ladder branches on `not v_estimated` and nothing
    // else re-derives the condition.
    const text = ladderOf('054c-post-stocktake-session.sql')
    expect(text).toContain('if not v_estimated then')
    expect(text).not.toMatch(/if\s+v_balance\s*>\s*0/)
  })
})
