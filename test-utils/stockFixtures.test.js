import {
  movement, fixtureIsConsistent, historyMovements, productBalances, stocktakeAdjustment,
  balanceRowsForStorage, BALANCE_STATE, COST_STATE,
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

describe('the stocktake adjustment, decided before the screen exists', () => {
  const { movementFrames } = require('../lib/stockDocumentList')

  it('computes the difference the way post_stocktake computes it', () => {
    // v_diff := v_counted - v_balance. Counted 10 packages of a factor-15
    // product against a recorded 200 pieces → 150 - 200 = -50.
    expect(stocktakeAdjustment({
      id: 's1', documentId: 'd', product: 'p-cooler',
      countedPackages: 10, recordedBase: 200, unitCostPerBase: 6.6667,
    })).toMatchObject({ quantity_base: '-50' })
  })

  it('claims NO entry frame, because nobody typed a movement', () => {
    // ⚠️ The decision. Passing the COUNT would draw "بالعبوة: 10 · بالقطعة: -5"
    // on every stocktake line — the shape caught as a fixture defect two rounds
    // ago, except produced by the function each time. Passing the DIFF would
    // keep the invariant and silently discard the counted number, which is the
    // only figure a human can check.
    const row = stocktakeAdjustment({
      id: 's1', documentId: 'd', product: 'p-laser',
      countedPackages: 10, recordedBase: 15, unitCostPerBase: 100,
    })
    expect(row.entered_quantity).toBeNull()
    expect(row.entered_uom).toBeNull()
  })

  it('draws as one honest frame through the real display function', () => {
    // Not asserted about the fixture — run through movementFrames itself, so
    // the decision is checked against the code that will draw it.
    const row = stocktakeAdjustment({
      id: 's1', documentId: 'd', product: 'p-laser',
      countedPackages: 10, recordedBase: 15, unitCostPerBase: 100,
    })
    expect(movementFrames(row, OWNER_PRODUCTS[1])).toEqual({
      direction: 'out', entered: null, uom: null, base: 5, baseUnit: 'pcs', sameFrame: false,
    })
  })

  it('writes nothing when the count matches, which is what the function does', () => {
    // `if v_diff = 0 then continue` — so the most successful stocktake leaves
    // no movement at all. Item 44: the ledger records change, and a stocktake's
    // main value is often that nothing changed.
    expect(stocktakeAdjustment({
      id: 's1', documentId: 'd', product: 'p-laser',
      countedPackages: 15, recordedBase: 15, unitCostPerBase: 100,
    }).quantity_base).toBe('0')
  })

  it('refuses a count that is not a whole number of pieces', () => {
    expect(() => stocktakeAdjustment({
      id: 's1', documentId: 'd', product: 'p-laser',
      countedPackages: 2.5, recordedBase: 0, unitCostPerBase: 1,
    })).toThrow(/pieces do not divide/)
  })
})

describe('the balance screen has TWO triples, not one', () => {
  const products = OWNER_PRODUCTS

  it('draws a product that NEVER MOVED — which the view cannot return at all', () => {
    // ⚠️ FROM stock_movements GROUP BY: no movements, no row. A product created
    // today and not yet supplied is absent from the view entirely, so a screen
    // that renders only the view's rows makes it look non-existent.
    const rows = balanceRowsForStorage({
      storageId: 'stor-general', products, movements: historyMovements('shampoo'),
    })
    const cooler = rows.find((r) => r.product_id === 'p-cooler')
    expect(cooler).toEqual({
      product_id: 'p-cooler', balanceState: BALANCE_STATE.NEVER_MOVED, costState: COST_STATE.NONE,
    })
    // and specifically NOT a zero balance
    expect(cooler.balance_base).toBeUndefined()
  })

  it('keeps "never moved" apart from a REAL zero', () => {
    // One means "it ran out, reorder"; the other means "it never arrived".
    // coalesce(balance, 0) collapses them into the first sentence.
    const emptied = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 4, unitCostPerBase: 25 }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 4, unitCostPerBase: 25, direction: -1 }),
    ]
    const rows = balanceRowsForStorage({ storageId: 'stor-general', products, movements: emptied })
    expect(rows.find((r) => r.product_id === 'p-laser')).toMatchObject({
      balance_base: 0, balanceState: BALANCE_STATE.EMPTY, costState: COST_STATE.NONE,
    })
    expect(rows.find((r) => r.product_id === 'p-shampoo').balanceState).toBe(BALANCE_STATE.NEVER_MOVED)
  })

  it('SHOUTS on stock that exists and is recorded as worth nothing', () => {
    // ⚠️ The cross-product, and the reason this screen is not passive: a
    // positive balance at zero cost is exactly what the owner's database held
    // before the cleanup. Distinguishing the states is what makes the screen
    // find poisoning without anybody looking for it.
    const poisoned = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: 0 }),
    ]
    const row = balanceRowsForStorage({ storageId: 'stor-general', products, movements: poisoned })
      .find((r) => r.product_id === 'p-laser')
    expect(row).toMatchObject({
      balanceState: BALANCE_STATE.IN_STOCK, costState: COST_STATE.ZERO, needsAttention: true,
    })
  })

  it('does not shout at a healthy row, or at a negative one', () => {
    // A guard that flags everything flags nothing.
    const healthy = balanceRowsForStorage({
      storageId: 'stor-general', products, movements: historyMovements('shampoo'),
    }).find((r) => r.product_id === 'p-shampoo')
    expect(healthy).toMatchObject({ costState: COST_STATE.KNOWN, needsAttention: false })

    const negative = balanceRowsForStorage({
      storageId: 'stor-general', products, movements: historyMovements('cooler'),
    }).find((r) => r.product_id === 'p-cooler')
    expect(negative).toMatchObject({
      balanceState: BALANCE_STATE.NEGATIVE, costState: COST_STATE.NONE, needsAttention: false,
    })
  })

  it('separates the four combinations that can actually occur', () => {
    // negative+noAverage · empty+noAverage · inStock+zeroCost · inStock+known
    const rows = balanceRowsForStorage({
      storageId: 'stor-general',
      products,
      movements: [
        ...historyMovements('cooler'),
        movement({ id: 'z', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: 0 }),
        ...historyMovements('shampoo'),
      ],
    })
    expect(rows.map((r) => `${r.balanceState}/${r.costState}`)).toEqual([
      'negative/noAverage', 'inStock/zeroCost', 'inStock/known',
    ])
  })
})
