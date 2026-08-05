import {
  movement, fixtureIsConsistent, historyMovements, productBalances, stocktakeAdjustment,
  balanceRowsForStorage, BALANCE_STATE, COST_STATE, productTotalAcrossStorages,
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

  it('refuses a null cost, because unit_cost is NOT NULL in the schema', () => {
    // ⚠️ Measured in the schema, not assumed. A fixture with no cost depicts a
    // row the database cannot hold — the same fault as an impossible quantity,
    // pointed at a constraint instead of an arithmetic relation.
    expect(() => movement({
      id: 'm1', documentId: 'd1', product: 'p-laser', enteredPackages: 1, unitCostPerBase: null,
    })).toThrow(/NOT NULL in the schema/)
  })

  it('allows it only when asked for by name, as a counterfactual', () => {
    expect(movement({
      id: 'm1', documentId: 'd1', product: 'p-laser', enteredPackages: 1,
      unitCostPerBase: null, counterfactualNullCost: true,
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
    // -75 in the GENERAL storage, +75 in the test one — both sides of an
    // ordinary transfer. The first "recorded" figure the stocktake shows for
    // the general storage is below zero, and counting an empty shelf there
    // produces a +75 adjustment. Undecided, not wrong.
    const rows = historyMovements('cooler')
    expect(balanceOf(rows.filter((m) => m.storage_id === 'stor-general'))).toBe(-75)
    expect(balanceOf(rows.filter((m) => m.storage_id === 'stor-test'))).toBe(75)
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
    expect(productBalances(historyMovements('cooler')))
      .toContainEqual({ storage_id: 'stor-general', product_id: 'p-cooler', balance_base: -75, avg_cost: null })
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

  it('COUNTERFACTUAL: why unit_cost must stay NOT NULL', () => {
    // ⚠️ This state cannot exist in the database, and that is the finding.
    // quantity_base * NULL is NULL and sum() ignores it, so a nullable column
    // would let a movement leave the NUMERATOR and stay in the DENOMINATOR:
    // 10 pieces at 100 plus 10 unpriced averages 50, not 100.
    //
    // That is poisoning in its cleanest form — a figure smaller than the truth,
    // consistent with itself, with no error and no row — and HARDER to see than
    // a zero, because a zero shows up on the line and a depressed average shows
    // up nowhere. So "make it nullable" is worse than the problem it solves.
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: 100 }),
      movement({
        id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 10,
        unitCostPerBase: null, counterfactualNullCost: true,
      }),
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

describe('the case a mutation could not find — all COUNTERFACTUAL, see above', () => {
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
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: null, counterfactualNullCost: true }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: null, counterfactualNullCost: true }),
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
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 10, unitCostPerBase: null, counterfactualNullCost: true }),
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
      product_id: 'p-cooler',
      balanceState: BALANCE_STATE.NEVER_MOVED,
      costState: COST_STATE.NONE,
      archived: false,
      // Not "about to run out" — restocking is a signal about something you
      // stock, and never-moved is already its own state.
      lowSupply: false,
      needsAttention: false,
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

describe('summing across storages erases the signal', () => {
  it('shows the owner’s two wrong storages summing to a clean zero', () => {
    // ⚠️ Not constructed — this is his database now, reached by an ordinary
    // transfer nobody got wrong. General -75, test +75, sum 0.
    //
    // A zero in a SUM is worse than a zero on a line: a line's zero says "free"
    // or "unknown", a sum's zero says "no problem" — the one meaning that must
    // never be said here.
    const result = productTotalAcrossStorages({
      productId: 'p-cooler', movements: historyMovements('cooler'),
    })
    expect(result.total).toBe(0)
    expect(result.hidesOpposingBalances).toBe(true)
    expect(result.perStorage.map((r) => r.balance_base).sort((a, b) => a - b)).toEqual([-75, 75])
  })

  it('loses the average too, so the screen would say "no data" about two faults', () => {
    // sum(qty × cost) / sum(qty) over a zero denominator is no average at all.
    const result = productTotalAcrossStorages({
      productId: 'p-cooler', movements: historyMovements('cooler'),
    })
    expect(result.perStorage.find((r) => r.balance_base < 0).avg_cost).toBeNull()
  })

  it('does not cry wolf when the storages agree in direction', () => {
    const rows = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 4, unitCostPerBase: 25 }),
      movement({ id: 'b', documentId: 'd', product: 'p-laser', enteredPackages: 6, unitCostPerBase: 25, storageId: 'stor-test' }),
    ]
    const result = productTotalAcrossStorages({ productId: 'p-laser', movements: rows })
    expect(result).toMatchObject({ total: 10, hidesOpposingBalances: false })
  })

  it('never returns a bare total — the composition always travels with it', () => {
    // The API cannot be used to show a sum without what it is made of.
    const result = productTotalAcrossStorages({
      productId: 'p-cooler', movements: historyMovements('cooler'),
    })
    expect(Object.keys(result).sort()).toEqual(['hidesOpposingBalances', 'perStorage', 'total'])
    expect(result.perStorage).toHaveLength(2)
  })
})

describe('the balance screen filters by BALANCE, not by is_active', () => {
  // Measured: no trigger stops a product with stock from being archived. And
  // the remedy is not the storage guard's mirror — an archived STORAGE is
  // unreachable (only the database can save it), an archived PRODUCT is merely
  // filtered (the screen can). Access problem versus display problem.
  const archived = (id) => OWNER_PRODUCTS.map((p) => (p.id === id ? { ...p, is_active: false } : p))

  it('SHOWS an archived product that still has stock, and labels it', () => {
    // "Archived" means "stop buying this", not "the shelf is empty". Forcing a
    // write-off of three remaining bottles is friction that buys nothing.
    const rows = balanceRowsForStorage({
      storageId: 'stor-general',
      products: archived('p-shampoo'),
      movements: historyMovements('shampoo'),
    })
    expect(rows.find((r) => r.product_id === 'p-shampoo')).toMatchObject({
      balance_base: 20, balanceState: BALANCE_STATE.IN_STOCK, archived: true,
    })
  })

  it('drops it BY ITSELF once the balance reaches zero', () => {
    // ⚠️ The self-healing property, and the reason no trigger and no cleanup
    // step are needed: the row leaves the screen the moment the stock runs out.
    const emptied = [
      movement({ id: 'a', documentId: 'd', product: 'p-shampoo', enteredPackages: 4, unitCostPerBase: 25 }),
      movement({ id: 'b', documentId: 'd', product: 'p-shampoo', enteredPackages: 4, unitCostPerBase: 25, direction: -1 }),
    ]
    const rows = balanceRowsForStorage({
      storageId: 'stor-general', products: archived('p-shampoo'), movements: emptied,
    })
    expect(rows.some((r) => r.product_id === 'p-shampoo')).toBe(false)
  })

  it('hides an archived product that never moved', () => {
    const rows = balanceRowsForStorage({
      storageId: 'stor-general', products: archived('p-cooler'), movements: historyMovements('shampoo'),
    })
    expect(rows.some((r) => r.product_id === 'p-cooler')).toBe(false)
  })

  it('SHOWS an archived product whose balance went NEGATIVE', () => {
    // Not zero, so it stays — and a negative balance on a discontinued line is
    // exactly the row somebody needs to see.
    const rows = balanceRowsForStorage({
      storageId: 'stor-general', products: archived('p-cooler'), movements: historyMovements('cooler'),
    })
    expect(rows.find((r) => r.product_id === 'p-cooler')).toMatchObject({
      balance_base: -75, balanceState: BALANCE_STATE.NEGATIVE, archived: true,
    })
  })

  it('keeps an ACTIVE product that never moved, which is a different question', () => {
    // Never-moved and archived-and-empty both produce no view row, and they are
    // not the same thing: one is "created, not supplied yet", the other is
    // "discontinued and gone". Only the first belongs on screen.
    const rows = balanceRowsForStorage({
      storageId: 'stor-general', products: OWNER_PRODUCTS, movements: historyMovements('shampoo'),
    })
    expect(rows.find((r) => r.product_id === 'p-cooler')).toMatchObject({
      balanceState: BALANCE_STATE.NEVER_MOVED,
    })
  })

  it('means an archived product on the shelf is COUNTABLE by the stocktake', () => {
    // ⚠️ The heaviest of the three consequences. A stocktake that filters by
    // is_active cannot see it, so "I counted this storage" is false BY
    // CONSTRUCTION and nothing reveals it — item 44 from its other side: there
    // the ledger cannot record verification, here verification cannot happen.
    const countable = balanceRowsForStorage({
      storageId: 'stor-general',
      products: archived('p-shampoo'),
      movements: historyMovements('shampoo'),
    }).map((r) => r.product_id)
    expect(countable).toContain('p-shampoo')
  })
})

describe('low_supply_units — collected by the form, read by nothing', () => {
  // Measured: every occurrence in the repo is the product dialog writing it,
  // its validation, the schema doc, or a test of the form. Its only possible
  // home is this screen, since nowhere else knows a balance to compare against.
  const withThreshold = (id, threshold) =>
    OWNER_PRODUCTS.map((p) => (p.id === id ? { ...p, low_supply_units: threshold } : p))

  const rowsFor = (products, movements) =>
    balanceRowsForStorage({ storageId: 'stor-general', products, movements })

  it('flags a balance at or below the threshold', () => {
    const rows = rowsFor(withThreshold('p-shampoo', 20), historyMovements('shampoo'))
    expect(rows.find((r) => r.product_id === 'p-shampoo')).toMatchObject({
      balance_base: 20, lowSupply: true,
    })
  })

  it('does not flag one comfortably above it', () => {
    const rows = rowsFor(withThreshold('p-shampoo', 5), historyMovements('shampoo'))
    expect(rows.find((r) => r.product_id === 'p-shampoo').lowSupply).toBe(false)
  })

  it('NEVER flags a product with no threshold, and does not read it as zero', () => {
    // ⚠️ numberOrNull already stores an empty field as null (measured), so the
    // data is right and only a screen could break it. Treating null as 0 would
    // mean "alert when the balance drops to or below zero" — an alarm that
    // fires exactly when it is far too late.
    const rows = rowsFor(withThreshold('p-shampoo', null), historyMovements('shampoo'))
    expect(rows.find((r) => r.product_id === 'p-shampoo').lowSupply).toBe(false)

    const emptied = [
      movement({ id: 'a', documentId: 'd', product: 'p-shampoo', enteredPackages: 4, unitCostPerBase: 25 }),
      movement({ id: 'b', documentId: 'd', product: 'p-shampoo', enteredPackages: 4, unitCostPerBase: 25, direction: -1 }),
    ]
    expect(rowsFor(withThreshold('p-shampoo', null), emptied)
      .find((r) => r.product_id === 'p-shampoo').lowSupply).toBe(false)
  })

  it('keeps the two alarms INDEPENDENT — value unknown vs quantity low', () => {
    // ⚠️ needsAttention says its VALUE is unknown; lowSupply says its QUANTITY
    // is small. Two different facts, and one glyph for both would rebuild
    // exactly what this module spent itself taking apart.
    const poisonedAndPlentiful = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 500, unitCostPerBase: 0 }),
    ]
    expect(rowsFor(withThreshold('p-laser', 10), poisonedAndPlentiful)
      .find((r) => r.product_id === 'p-laser')).toMatchObject({
      needsAttention: true, lowSupply: false,
    })

    const pricedAndScarce = [
      movement({ id: 'a', documentId: 'd', product: 'p-laser', enteredPackages: 2, unitCostPerBase: 30 }),
    ]
    expect(rowsFor(withThreshold('p-laser', 10), pricedAndScarce)
      .find((r) => r.product_id === 'p-laser')).toMatchObject({
      needsAttention: false, lowSupply: true,
    })
  })

  it('flags a negative balance as low too, because it truthfully is', () => {
    // It is already flagged NEGATIVE for a different reason; being below the
    // threshold is a separate true statement, and the screen decides how to
    // show two true things at once.
    const rows = rowsFor(withThreshold('p-cooler', 10), historyMovements('cooler'))
    expect(rows.find((r) => r.product_id === 'p-cooler')).toMatchObject({
      balanceState: BALANCE_STATE.NEGATIVE, lowSupply: true,
    })
  })
})
