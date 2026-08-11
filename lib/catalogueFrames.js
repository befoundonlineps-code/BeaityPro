// How the catalogue's "remaining here" column reads a balance.
//
// ⚠️ AND IT SITS AGAINST A WRITTEN RULE, SO THE TENSION IS NAMED RATHER THAN
// PASSED OVER. CLAUDE.md says: «إطاران فقط لما يكون الاثنان مخزَّنَين» — two
// frames only when both are stored. A movement earns two because
// entered_quantity and quantity_base are both columns; a price earns one,
// because the second has to be derived, and the first real render of the
// derived one printed 100.0005 ₪ for a price somebody typed as 100.
//
// Here the package frame is DERIVED: balance_base ÷ units_per_package.
//
// ⚠️ AND THE FIRST DEFENCE OF THIS GENERALISED FROM AN EXACT CASE. It said:
// there is no round trip here, both inputs are exact and the division happens
// once — 190 ÷ 20 is 9.5 and reads back as 190.
//
// That is true because THAT division is exact. Measured on a real row, one is
// not: «مبرد ومهدئ ليزر» has a factor of 15 and a balance of 28660 ACROSS ALL
// STORAGES (28650 in تجريبي and 10 in العامّ), so 28660 ÷ 15 = 1910.6667, the
// cell shows 1910.67, and 1910.67 × 15 is 28660.05. The frame does not read
// back.
//
// ⚠️ And the grain is written into that sentence on purpose — see the note at
// the end of this block.
//
// ⇒ SO THE FRACTION IS NOT A CLAIM THAT THE NUMBER RETURNS. It is the same
// quantity stated in another unit — a CONVERSION, not a count — and that is a
// different kind of statement from the two stored frames on a movement, which
// really are two recorded facts.
//
// ✅ The cure is the one already implemented rather than a new one: the decimal
// is always visible, so the cell reads as a conversion and not as a countable
// number of boxes. «1910.67 عبوة» is nobody's idea of a tally.
//
// ⇒ Still judged inside the rule's purpose and outside its letter, and still
// flagged rather than settled. If review reads it the other way the package
// frame comes out — one call site, and the tests say what changes.
//
// ⚠️ AND 28660 AGAINST 28650 WAS FLAGGED HERE AS "ten units appeared without a
// document". It was not. Both numbers are right and neither moved; the two
// readings have different GRAINS, and this comment quoted one without its own.
//
//     067_1, grouped by (storage, product)   عام      3 movements      10.000
//                                            تجريبي   5 movements   28650.000
//     079b_3, summed across storages         8 movements            28660.000
//
// 150 + 1800 + 26700 = 28650 is the arithmetic IN تجريبي — three stocktakes —
// and the other two movements there are the transfer leg and its reversal
// (+75, −75, net zero). العامّ holds the other three: the same pair, and the
// ten. Every number closes, and movements_ever = 8 = 3 + 5 is the same row
// saying so.
//
// 🔴 SO THE RULE, AND IT IS THE SECOND TIME IN TWO ROUNDS: A NUMBER IS QUOTED
// WITH ITS GRAIN ATTACHED. «28650 in تجريبي», never «28650». The grain is part
// of the number, not context around it — because a number carried without one
// gets read at whatever grain the reader is holding.
//
// Both instances are the same shape and one is ours each:
//
//     low supply   a threshold whose grain is the PRODUCT, compared against
//                  ONE STORAGE's balance
//     this         ONE STORAGE's balance, read as the PRODUCT's
//
// And the original records had it right — 070's header says "holds 28650 IN
// THE TEST STORAGE" and PROJECT_HANDOFF:619 names the storage too. The grain
// was dropped in the RETELLING, which is where it always goes.

// Never floor, and always at least one decimal.
//
// ⚠️ floor wrote «بالعبوة: 9 · بالقطعة: 190» for a factor of 20, and 9 × 20 is
// 180. The first row of the table (5 × 15 = 75) teaches the reader the two
// frames are equivalent, and a later row breaks that promise without saying so
// — not a rounding, a silent claim.
//
// And the decimal stays visible even when the division is exact, because «5»
// alone does not say whether it is exact or rounded.
export function packageFraction(balanceBase, unitsPerPackage) {
  const factor = Number(unitsPerPackage)
  if (!Number.isFinite(factor) || factor <= 0) return null
  const packages = Number(balanceBase) / factor
  if (!Number.isFinite(packages)) return null
  const rounded = Math.round(packages * 100) / 100
  return Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded)
}

// ⚠️ ONE FRAME WHEN THE PACKAGE IS ONE UNIT, and the rule above is what asks
// for it rather than what forbids it.
//
// Measured on the owner's data: seven of eight products have
// units_per_package = 1, so both frames print the same number — «بالعبوة: 7 ·
// بالقطعة: 7». A reader learns the two boxes are a repetition, and then meets
// the one product where they differ — 1910.67 packages against 28660 pieces,
// across all storages — and does not look.
//
// So the rule exists to prevent a misreading, and applying it literally here
// manufactures one. The frames appear when they carry two facts.
export function showsPackageFrame(product) {
  return Number(product && product.units_per_package) !== 1
}
