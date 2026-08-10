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
    .sort()

  const newest = definers[definers.length - 1]
  const text = fs.readFileSync(path.join(sqlDir, newest), 'utf8')

  // The insert that copies the source document's movements, isolated so a
  // needle cannot match prose in the file's header instead of its code — the
  // fault CLAUDE.md item 2ب is written about.
  const copyBlock = text.slice(
    text.indexOf('insert into stock_movements'),
    text.indexOf('$function$;', text.indexOf('insert into stock_movements')),
  )

  it('found the definitions rather than scanning nothing', () => {
    expect(definers.length).toBeGreaterThanOrEqual(4)
    expect(newest).toBe('051c-reverse-stock-document.sql')
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
