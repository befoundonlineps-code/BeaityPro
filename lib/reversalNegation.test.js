import fs from 'fs'
import path from 'path'

// 079a's TEST TWO asks product_balances whether a live balance exists — and
// 081_1 read that view's body and found no liveness filter at all: it sums
// EVERY movement, dead ones included. So its answer equals "the live balance"
// only while a reversal writes an EXACT NEGATION of its original.
//
// ⚠️ 081_2 measured that on the real database and it held on all four rows.
// But three reversed pairs are a fact about today's data, not a property of
// reverse_stock_document — and review said the right thing about it: the
// permanent shape is a test beside the function, not a sentence in a header. A
// header records that somebody checked once; nothing re-checks it.
//
// ✅ And it turns out to be better than that, because the property IS in the
// function and is deposited: the reversal's insert-select negates
// quantity_base, copies unit_cost untouched, and selects every movement of the
// source document with no narrowing. So this is not "we measured three pairs";
// it is "the function cannot do otherwise", guarded.
describe('a reversal writes the exact negation of its original', () => {
  const sqlDir = path.join(__dirname, '..', 'docs', 'sql')

  // ⚠️ The NEWEST definition wins, found rather than named. Four files define
  // this function (043 · 049d · 050d · 051c) and pinning one by name would
  // quietly stop guarding the day a fifth lands — the failure mode this
  // project calls a list that fails open. Highest filename is the live one,
  // because that is how this folder is ordered and how it is run.
  const definers = fs.readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => /function public\.reverse_stock_document/i.test(fs.readFileSync(path.join(sqlDir, f), 'utf8')))
    // ⚠️ NUMERIC-AWARE, and the plain .sort() it replaces was a fails-open
    // waiting for a three-digit script: '100_…' sorts BEFORE '095_…' by code
    // point, so the day the folder passes 099 the newest definition would stop
    // being read and nothing would say so. The guard would go on proving an
    // older file correct — the exact shape this file's own comment warns about
    // one paragraph up, met from a direction nobody had looked.
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  const newest = definers[definers.length - 1]
  const text = fs.readFileSync(path.join(sqlDir, newest), 'utf8')

  // 🔴 SCOPED TO THIS FUNCTION'S BODY, NOT TO THE FILE — and 095 is why. It
  // defines six objects in one file and three of them write movements, so
  // indexOf('insert into stock_movements') over the whole text now lands in
  // post_stock_document's SUPPLY branch: a block that legitimately carries no
  // minus and no m.-qualified column at all. Every assertion below would have
  // failed, reporting the reversal broken while nothing was wrong with it.
  //
  // ⚠️ And that is the more dangerous direction than it looks. A false ✗ costs
  // time; but "the needle drifted onto a different function" is one edit away
  // from a false ✓ — a block that happens to satisfy every needle while the
  // reversal itself is unguarded.
  const bodyStart = text.search(/CREATE OR REPLACE FUNCTION public\.reverse_stock_document/i)
  const body = text.slice(bodyStart, text.indexOf('$function$;', bodyStart))

  // The insert that copies the source document's movements, isolated so a
  // needle cannot match prose in the file's header instead of its code — the
  // fault CLAUDE.md item 2ب is written about.
  const copyBlock = body.slice(body.indexOf('insert into stock_movements'))

  it('found the definitions rather than scanning nothing', () => {
    // ⚠️ THE FILENAME PIN THAT USED TO BE HERE IS GONE, and it contradicted the
    // comment eight lines above it: "pinning one by name would quietly stop
    // guarding the day a fifth lands". A fifth landed (095) and the pin is what
    // failed — it asserted the newest definer was still 051c. The prose had
    // the rule right and the code did the opposite, which is why the shape is
    // asserted now and the name is not.
    expect(definers.length).toBeGreaterThanOrEqual(5)
    expect(bodyStart).toBeGreaterThan(-1)
    expect(copyBlock.length).toBeGreaterThan(200)
  })

  it('negates the quantity', () => {
    // The minus is the whole invariant. Without it a reversal DOUBLES the
    // original instead of cancelling it, and product_balances — which has no
    // liveness filter — would report that doubled figure as the balance.
    expect(copyBlock).toMatch(/-\s*m\.quantity_base/)
  })

  it('copies the unit cost untouched, and does not negate it', () => {
    // ⚠️ Both halves matter and they pull in opposite directions. The cost must
    // be carried over or the pair leaves a value remainder while its quantities
    // cancel — the exact shape 043 names and stockFixtures.test.js pins under
    // "quantities that cancel while the value does not". And it must NOT be
    // negated, or quantity × cost comes back positive on both sides.
    expect(copyBlock).toMatch(/(^|[^-\w.])m\.unit_cost/m)
    expect(copyBlock).not.toMatch(/-\s*m\.unit_cost/)
  })

  it('carries the batch through, and does not negate it', () => {
    // 🔴 095. lot_id follows unit_cost exactly: copied, never negated — and it
    // is the whole reason there is no junction table between a movement and its
    // batch. The reversal returns the goods TO THE BATCH THEY CAME FROM with no
    // search and no reverse allocation, and the batch's remaining balance
    // (sum(quantity_base) over lot_id) corrects itself because the counter-line
    // carries the same lot_id.
    //
    // ⚠️ A reversal that dropped this column could not be written at all —
    // stock_movements.lot_id is NOT NULL — so the failure would be loud. The
    // one that must be caught HERE is negation: `-m.lot_id` is not even a legal
    // uuid expression, but a later hand "negating for symmetry" would reach for
    // it the same way one nearly reached for the bonus (051c's header).
    expect(copyBlock).toMatch(/(^|[^-\w.])m\.lot_id/m)
    expect(copyBlock).not.toMatch(/-\s*m\.lot_id/)
  })

  it('keeps each line in the storage it happened in', () => {
    // ⚠️ storage_id comes from the MOVEMENT, not from the document — and after
    // 081_2's correction this is the load-bearing half. A transfer writes both
    // legs under one document: −10 out of one storage and +10 into another. If
    // the reversal took v_src.storage_id instead, both counter-legs would land
    // in the same storage, and the netting product_balances depends on would
    // break PER STORAGE while still looking perfect in total.
    //
    // 081_2 measured 75/−75 in تجريبي and −75/+75 in العام, which SUPPORTS
    // this and does not prove it. This is what proves it.
    expect(copyBlock).toMatch(/(^|[^-\w.])m\.storage_id/m)
    expect(copyBlock).not.toMatch(/v_src\.storage_id/)
  })

  it('takes every movement of the source document, with no narrowing', () => {
    // A reversal that copied SOME lines would net partially, and 081_2's
    // remainder columns would be the only thing that ever noticed.
    const where = copyBlock.slice(copyBlock.indexOf('where'))
    expect(where).toMatch(/m\.document_id\s*=\s*p_document_id/)
    // One condition, no `and` bolted on. Written as a shape rather than a
    // string comparison so reformatting does not fail it.
    expect(where.match(/\band\b/g)).toBeNull()
  })

  it('would notice the minus going missing', () => {
    // Counter-evidence on a copy — nothing touches the work tree.
    const broken = copyBlock.replace(/-\s*m\.quantity_base/, 'm.quantity_base')
    expect(broken).not.toMatch(/-\s*m\.quantity_base/)
    expect(broken).not.toBe(copyBlock)
  })
})
