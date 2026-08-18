const fs = require('fs')
const path = require('path')

// ==========================================================================
// THE COST LADDER USED TO LIVE IN THREE FUNCTIONS. AFTER 095 IT LIVES IN ONE,
// AND THIS FILE IS THAT CLAIM MADE CHECKABLE.
//
// ⚠️ WHAT THIS FILE USED TO ASSERT WAS TRUE AND IS NOW WRONG, DELIBERATELY.
// It compared post_stocktake_session's ladder against 043's line for line and
// demanded all FIVE tiers. 095 removes tier 1 — the weighted average of this
// storage — because a weighted average is the exact thing batch costing exists
// to abolish. So the old assertions did their job: they failed the moment the
// design changed, loudly, instead of letting a rewrite pass unnoticed.
//
// ⚠️ AND THE REPLACEMENT IS NOT "the same test with tier 1 deleted". The old
// shape was PARITY — the same walk written twice, compared. The new shape is
// SINGULARITY: the walk is written once and nothing may write it again. A
// parity test can only notice that two copies drifted; it cannot notice a
// third copy being born, and a third copy is what this module kept producing.
//
// So the three assertions are:
//
//   ① the ladder exists, in the one place, with its four remaining tiers
//   ② nothing else in the live design carries a ladder of its own
//   ③ the weighted average survives in exactly ONE place and it is NOT a cost
//     path — it prices a fine line, where a person owes one number per product
//
// ADR-053, in SQL: what would appear in several places is derived from one
// walk. Here it is not derived — it is called.
// ==========================================================================
const SQL_DIR = path.join(__dirname, '..', 'docs', 'sql')

// ⚠️ DERIVED, NOT TYPED, and sorted numerically. Naming the file would stop
// guarding the day a later script redefines the helper — CLAUDE.md §4b — and a
// plain .sort() would stop reading the newest definition the day the folder
// passes 099, because '100_…' precedes '095_…' by code point.
//
// ⚠️ AND THE MATCH IS CASE-INSENSITIVE, which is not fussiness: this folder
// holds both spellings side by side and always will. The four rewritten
// functions carry `CREATE OR REPLACE FUNCTION` verbatim from
// pg_get_functiondef, which upper-cases it; anything written by hand here is
// lower-case. A case-sensitive `includes` found nothing and returned undefined
// — and undefined is the fails-open this file was built to refuse, so the
// assertion below names it rather than trusting the lookup.
const newestDefining = (needle) => {
  const files = fs.readdirSync(SQL_DIR)
    .filter((name) => name.endsWith('.sql'))
    .filter((name) => needle.test(fs.readFileSync(path.join(SQL_DIR, name), 'utf8')))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  return files[files.length - 1]
}

const LADDER_FILE = newestDefining(/FUNCTION public\.open_estimated_lot\b/i)
const LIVE = LADDER_FILE && fs.readFileSync(path.join(SQL_DIR, LADDER_FILE), 'utf8')

// A function's body cut out by its own landmarks rather than by line numbers,
// which would select the wrong region the first time anything gained a comment.
function bodyOf(text, name) {
  const start = text.search(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\b`, 'i'))
  // Failing loudly here matters more than anywhere: a silent miss would test an
  // empty string and pass every needle by vacuity.
  expect(start).toBeGreaterThan(-1)
  const end = text.indexOf('$function$;', start)
  expect(end).toBeGreaterThan(start)
  return text.slice(start, end)
}

// The weighted average, tolerant of an alias prefix so a rename of `m` does not
// read as its disappearance — the needle that oscillated in 077a is the warning.
const WEIGHTED_AVERAGE =
  /sum\(\s*(?:\w+\.)?quantity_base\s*\*\s*(?:\w+\.)?unit_cost\s*\)\s*\/\s*sum\(\s*(?:\w+\.)?quantity_base\s*\)/g

// Comments out, whitespace flattened — the ladder is compared as code, never as
// prose. CLAUDE.md §2ب: a needle that can match an explanation cannot also be
// trusted to match a violation.
const codeOnly = (block) => block
  .split(/\r?\n/)
  .map((line) => line.replace(/--.*$/, ''))
  .join('\n')

describe('the cost ladder is written once, and tier 1 is gone from every cost path', () => {
  it('found the file that defines the ladder, rather than scanning nothing', () => {
    expect(LADDER_FILE).toBeDefined()
    expect(LIVE.length).toBeGreaterThan(1000)
  })

  it('keeps the four surviving tiers, each named by what makes it different', () => {
    // A singularity test alone would pass on a ladder that had quietly lost a
    // rung: one copy of four tiers and one copy of three look identical to a
    // count of copies. Every tier produces a number, so a missing one does not
    // fail — it hands back a different cost, once, for a product with no
    // history here, and the stamped unit_cost is permanent (ADR-051).
    // 🔴 THE TIERS ARE CUT APART BEFORE THEY ARE READ, and the first draft of
    // this test proves why. It asked whether `m.salon_id = p_salon_id` appeared
    // anywhere in the ladder — and it appears in tier 2 as well, because tier 2
    // is scoped to a storage AND a salon. So the tier-3 needle was satisfied by
    // tier 2, and the counter-evidence run is what exposed it: deleting tier 3
    // left the test green.
    //
    // ⚠️ That is the exact hazard the old comment named — "tier 3 looks like a
    // repeat of tier 2" — written as prose beside a needle that had fallen into
    // it. Tiers 2 and 3 differ by an ABSENCE (no storage filter), and an
    // absence cannot be matched across a region that contains the presence.
    const lookups = codeOnly(bodyOf(LIVE, 'open_estimated_lot')).match(/select[\s\S]*?into v_cost[\s\S]*?;/g)
    expect(lookups).toHaveLength(3)

    // 2: the last receipt IN THIS STORAGE.
    expect(lookups[0]).toMatch(/m\.storage_id = p_storage_id/)
    expect(lookups[0]).toMatch(/m\.quantity_base > 0[\s\S]*order by m\.created_at desc/)
    // 3: the last receipt anywhere in the salon — the tier a rewrite drops most
    //    easily, and the one defined by what it does NOT filter on.
    expect(lookups[1]).toMatch(/m\.salon_id = p_salon_id/)
    expect(lookups[1]).not.toMatch(/storage_id/)
    // 4: the catalogue's nominal price.
    expect(lookups[2]).toContain('nominal_purchase_price')

    const ladder = codeOnly(bodyOf(LIVE, 'open_estimated_lot'))
    // 5: zero, and only as the last word.
    expect(ladder).toContain('coalesce(v_cost, 0)')

    // 🔴 AND THE TIERS FALL THROUGH ON `v_cost is null`, WHICH IS LOAD-BEARING
    // AND EASY TO READ AS STYLE. `select … into` over zero rows assigns NULL
    // rather than leaving the variable alone; that is the ONLY reason a failed
    // lookup moves to the next tier instead of stamping the previous product's
    // cost from the caller's loop. Two of these — tier 2→3 and tier 3→4 — and
    // tier 4→5 is the coalesce above, which is why the count is two and not
    // three. A fifth tier arriving without its guard shows up here as 3.
    expect(ladder.match(/if v_cost is null then/g)).toHaveLength(2)
  })

  it('marks every lot the ladder opens as estimated', () => {
    // The whole point of the rung. A lot born here has no invoice behind it, and
    // `cost_is_estimated` is what lets a screen say "0 ₪ (غير معروفة)" instead
    // of a silent zero. Written as a literal `true` in the insert, not derived
    // from a variable that could be reassigned above it (CLAUDE.md §9).
    const ladder = codeOnly(bodyOf(LIVE, 'open_estimated_lot'))
    expect(ladder).toMatch(/insert into public\.stock_lots[\s\S]*?values[\s\S]*?true/)
  })

  it('leaves no second ladder anywhere in the live design', () => {
    // ③ THE ASSERTION THE OLD PARITY TEST STRUCTURALLY COULD NOT MAKE. Tier 4's
    // needle appears once per ladder and nowhere else in this module, so
    // counting it counts ladders. A fourth function that grows its own — the
    // thing that happened three times before 095 — trips this on the day it is
    // written, not after it has stamped costs.
    expect(codeOnly(LIVE).match(/nominal_purchase_price/g)).toHaveLength(1)
  })

  it('uses the weighted average once, and not to price a movement', () => {
    // 🔴 THE DESIGN CHANGE ITSELF, stated as a shape. Tier 1 was a weighted
    // average over a storage's movements, and it is what batch costing
    // replaces: goods leave at the price of THEIR batch, never at a blend.
    //
    // ⚠️ But the expression is not banned outright, and that distinction is the
    // point. It survives in exactly one place — the fine line — because a fine
    // is a claim against a person for one amount per product, not a statement
    // about what each batch was worth. stock_fine_lines_one_per_product refuses
    // any other shape.
    const code = codeOnly(LIVE)
    const hits = code.match(WEIGHTED_AVERAGE)
    expect(hits).toHaveLength(1)

    // And it sits inside the fine's insert, not before it. An occurrence
    // earlier in the file would be a cost path by definition — every one of
    // them runs above this line.
    const fineInsert = code.indexOf('insert into stock_fine_lines')
    expect(fineInsert).toBeGreaterThan(-1)
    expect(code.search(WEIGHTED_AVERAGE)).toBeGreaterThan(fineInsert)
  })

  it('would notice a tier going missing', () => {
    // Counter-evidence on a copy — nothing touches the work tree, the shape
    // sqlVerificationShape uses for the same reason. A guard that has never
    // been seen to bite is not a guard.
    //
    // ⚠️ AND THE MUTATION IS THE ONE THAT ACTUALLY BREAKS THE DESIGN, not the
    // one that is easiest to write. Tier 3 does not vanish by deletion in
    // practice — it collapses into tier 2 when somebody "tidies" it by adding
    // the storage filter back, at which point the salon-wide fallback is gone
    // and a product supplied only to another storage silently prices at the
    // catalogue's nominal instead of its real last cost.
    const lookups = codeOnly(bodyOf(LIVE, 'open_estimated_lot')).match(/select[\s\S]*?into v_cost[\s\S]*?;/g)
    const collapsed = lookups[1].replace(
      /m\.salon_id = p_salon_id/,
      'm.salon_id = p_salon_id\n and m.storage_id = p_storage_id',
    )
    expect(collapsed).not.toBe(lookups[1])
    // The live tier 3 passes this and the collapsed one does not — which is the
    // assertion the guard makes above, run against a copy that must fail it.
    expect(lookups[1]).not.toMatch(/storage_id/)
    expect(collapsed).toMatch(/storage_id/)
  })
})
