import {
  movement, fixtureIsConsistent, historyMovements, productBalances,
  OWNER_PRODUCTS, HYPOTHETICAL_PRODUCTS, OWNER_HISTORY,
} from './stockFixtures'

// The fixture builder is itself guarded, because the last two rounds were both
// lost to a fixture rather than to code: one drew a reversal with no movements
// and a date written as a plain string, the next drew 0.6 pieces per package.
// A builder that can still produce those is not a fix.

describe('the builder refuses what the writer would refuse', () => {
  it('computes base from entered × factor, never accepts it', () => {
    // ⚠️ The exact shape that escaped: entered_quantity hardcoded beside a
    // varying quantity_base. It is not expressible here — base is derived.
    expect(movement({
      id: 'm1', documentId: 'd1', product: 'p-cooler', enteredPackages: 5, unitCostPerBase: 6.6667,
    })).toMatchObject({ entered_quantity: '5', quantity_base: '75' })
  })

  it('refuses a fraction of a piece, exactly as the entry screen does', () => {
    // "القطع ما بتتجزّأ" — lib/stockDocument.js rejects it, so a fixture must
    // not be able to depict it. 0.2 × 15 = 3 is fine; 0.2 × 1 is not.
    expect(() => movement({
      id: 'm1', documentId: 'd1', product: 'p-laser', enteredPackages: 0.5, unitCostPerBase: 10,
    })).toThrow(/pieces do not divide/)
  })

  it('refuses a product it does not know rather than inventing a factor', () => {
    expect(() => movement({
      id: 'm1', documentId: 'd1', product: 'nope', enteredPackages: 1, unitCostPerBase: 1,
    })).toThrow(/unknown product/)
  })

  it('refuses a direction that is neither receipt nor issue', () => {
    // The sign is the document's, never the typist's — the rule stockLine
    // keeps, kept here too so a fixture cannot contradict it.
    expect(() => movement({
      id: 'm1', documentId: 'd1', product: 'p-laser', enteredPackages: 1, unitCostPerBase: 1, direction: 0,
    })).toThrow(/direction must be/)
  })

  it('rounds unit_cost to the four decimals the column keeps', () => {
    // Rounding on the way IN is what produces item 35's 100.0005 on the way
    // out. Doing it here means a fixture carries the database's precision
    // rather than JavaScript's.
    expect(movement({
      id: 'm1', documentId: 'd1', product: 'p-cooler', enteredPackages: 1, unitCostPerBase: 100 / 15,
    }).unit_cost).toBe('6.6667')
  })

  it('keeps a null cost null, because "no price" is not "priced at zero"', () => {
    expect(movement({
      id: 'm1', documentId: 'd1', product: 'p-laser', enteredPackages: 1, unitCostPerBase: null,
    }).unit_cost).toBeNull()
  })
})

describe('fixtureIsConsistent', () => {
  it('passes a set the builder made', () => {
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-cooler', enteredPackages: 5, unitCostPerBase: 6.6667 }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 20, unitCostPerBase: 50 }),
    ]
    expect(fixtureIsConsistent(rows)).toEqual([])
  })

  it('catches a hand-written pair, which is the case that got past a screenshot', () => {
    // Written by hand on purpose: 5 packages of a 15-factor product cannot be
    // 3 pieces. This is what the probe drew, and what nobody saw.
    const handWritten = [{
      id: 'bad', product_id: 'p-cooler', entered_quantity: '5', quantity_base: '3',
    }]
    expect(fixtureIsConsistent(handWritten)).toEqual([
      'bad: |3| ≠ 5 × 15',
    ])
  })

  it('names an unknown product rather than passing it', () => {
    expect(fixtureIsConsistent([{ id: 'x', product_id: 'ghost', entered_quantity: '1', quantity_base: '1' }]))
      .toEqual(['x: unknown product'])
  })
})

describe('the owner’s measured catalogue', () => {
  it('is all pieces, with the factors he measured', () => {
    // ⚠️ Pinned because I have twice drawn screens from a base_unit I made up.
    // All three are pcs; the factors are 15, 1, 1.
    expect(OWNER_PRODUCTS.map((p) => [p.base_unit, p.units_per_package]))
      .toEqual([['pcs', 15], ['pcs', 1], ['pcs', 1]])
  })

  it('keeps the hypothetical products separate and says so', () => {
    // There is no ml or g product in his database — item 36. Mixing them into
    // OWNER_PRODUCTS would make a hypothesis read as measured behaviour, which
    // is exactly what "تكلفة المل: 0.05 ₪" did.
    expect(OWNER_PRODUCTS.some((p) => p.base_unit !== 'pcs')).toBe(false)
    expect(HYPOTHETICAL_PRODUCTS.every((p) => p.id.startsWith('h-'))).toBe(true)
  })
})

describe('the states his database actually reached', () => {
  // Nobody types these: a negative balance, a poisoned pair that cancels in
  // both numerator and denominator, an average correct AFTER poisoning.
  const balanceOf = (rows) => rows.reduce((sum, m) => sum + Number(m.quantity_base), 0)
  const valueOf = (rows) => rows.reduce((sum, m) => sum + Number(m.quantity_base) * Number(m.unit_cost), 0)

  it.each(['shampoo', 'laser'])('reproduces %s: poisoned, reversed, re-posted', (key) => {
    const rows = historyMovements(key)
    const { balance, value, average } = OWNER_HISTORY[key].expected
    expect(balanceOf(rows)).toBe(balance)
    expect(valueOf(rows)).toBeCloseTo(value, 4)
    // ADR-051 arithmetically: the reversal stamps the SAME unit_cost, so the
    // poisoned pair cancels in numerator and denominator at once.
    expect(valueOf(rows) / balanceOf(rows)).toBeCloseTo(average, 4)
  })

  it('reproduces the NEGATIVE balance the stocktake will meet on its first run', () => {
    // (kept below; the balance-view cases follow)
    // -75 in the general storage: transferred out, never received in. The
    // first "recorded" figure that screen shows will be below zero, and
    // counting an empty shelf produces a +75 adjustment. Undecided, not wrong.
    const rows = historyMovements('cooler')
    expect(balanceOf(rows)).toBe(-75)
    expect(fixtureIsConsistent(rows)).toEqual([])
  })
})

describe('productBalances reproduces the view, including what a paraphrase loses', () => {
  // The balance screen (item 33) is not built yet, and these are the states it
  // will meet on its first run. Written before the screen deliberately: saying
  // this afterwards does not help.

  it('gives a number when the balance is positive', () => {
    const rows = historyMovements('shampoo')
    expect(productBalances(rows)).toEqual([
      { storage_id: 'stor-general', product_id: 'p-shampoo', balance_base: 20, avg_cost: 50 },
    ])
  })

  it('gives NULL — not zero — when the balance is NEGATIVE', () => {
    // ⚠️ THE THIRD STATE. avg_cost is NULL whenever the balance is <= 0, so a
    // screen has to distinguish "a number", "zero" (which may mean free or may
    // mean unknown — item 34) and "does not apply". Drawing NULL as 0 puts
    // three different meanings on one glyph.
    //
    // And this row is real: مبرد ومهدئ ليزر in the general storage, today.
    expect(productBalances(historyMovements('cooler'))).toEqual([
      { storage_id: 'stor-general', product_id: 'p-cooler', balance_base: -75, avg_cost: null },
    ])
  })

  it('gives NULL when the balance is exactly zero', () => {
    // A shelf emptied to zero has no average either — the CASE is `> 0`, not
    // `<> 0`. Easy to get wrong from memory.
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 4, unitCostPerBase: 25 }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 4, unitCostPerBase: 25, direction: -1 }),
    ]
    expect(productBalances(rows)[0]).toMatchObject({ balance_base: 0, avg_cost: null })
  })

  it('lets a NULL cost drag the average down, because sum() skips NULLs', () => {
    // ⚠️ quantity_base * NULL is NULL and sum() ignores it, so a movement with
    // no unit_cost counts in the DENOMINATOR and not the numerator. 10 pieces
    // at 100 plus 10 with no cost averages 50, not 100 — and nothing on screen
    // says half the pile was never priced.
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: 100 }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: null }),
    ]
    expect(productBalances(rows)[0]).toMatchObject({ balance_base: 20, avg_cost: 50 })
  })

  it('has NO ROW for a product that never moved — item 27', () => {
    // "Never moved" is not "zero", and the view cannot tell you the difference
    // because it never saw the product. A screen that renders only these rows
    // shows nothing at all for a newly created product.
    const rows = historyMovements('laser')
    expect(productBalances(rows).map((r) => r.product_id)).toEqual(['p-laser'])
    expect(productBalances(rows).some((r) => r.product_id === 'p-cooler')).toBe(false)
  })

  it('separates the same product in two storages', () => {
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-cooler', enteredPackages: 5, unitCostPerBase: 6.6667, direction: -1 }),
      movement({ id: 'b', documentId: 'd', product: 'p-cooler', enteredPackages: 5, unitCostPerBase: 6.6667, storageId: 'stor-test' }),
    ]
    const balances = productBalances(rows)
    expect(balances).toHaveLength(2)
    expect(balances.find((b) => b.storage_id === 'stor-general')).toMatchObject({ balance_base: -75, avg_cost: null })
    expect(balances.find((b) => b.storage_id === 'stor-test')).toMatchObject({ balance_base: 75 })
  })

  it('is the exact formula ADR-051 was verified with, not a lookalike', () => {
    // sum(qty × cost) / sum(qty) — the same expression the view runs, so the
    // healed averages are checked against the algebra that produces them.
    for (const key of ['shampoo', 'laser']) {
      const { average } = OWNER_HISTORY[key].expected
      expect(productBalances(historyMovements(key))[0].avg_cost).toBeCloseTo(average, 4)
    }
  })
})

describe('the case a mutation could not find', () => {
  it('gives NULL when EVERY movement has no cost — not zero', () => {
    // ⚠️ sum() over nothing is NULL, not 0, so the view says "no average" for
    // a pile nobody ever priced. My first reproduction accumulated into 0 and
    // returned 0, which reads as FREE — the exact unknown-versus-free collapse
    // (item 34) inside the function written to preserve it.
    //
    // No mutation could reach it: skipping a term and adding zero are
    // identical for a sum. It came from asking what the SQL does with nothing
    // to add, which is a question no test was posing.
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: null }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: null }),
    ]
    expect(productBalances(rows)[0]).toEqual({
      storage_id: 'stor-general', product_id: 'p-laser', balance_base: 20, avg_cost: null,
    })
  })

  it('still gives a number when only SOME movements were priced', () => {
    // One priced row is enough for sum() to be non-NULL, and the unpriced one
    // still counts in the denominator — so the average is dragged, not absent.
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: 100 }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: null }),
    ]
    expect(productBalances(rows)[0].avg_cost).toBe(50)
  })
})
