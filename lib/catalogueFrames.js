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
// not: «مبرد ومهدئ ليزر» has a factor of 15 and a balance of 28660, so
// 28660 ÷ 15 = 1910.6667, the cell shows 1910.67, and 1910.67 × 15 is
// 28660.05. The frame does not read back.
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
// ⚠️ AND ONE FIGURE TO RECONCILE, NOT SWALLOWED: that balance is quoted as
// 28660, while 070 and PROJECT_HANDOFF:624 measured 28650 with the arithmetic
// closing exactly (150 + 1800 + 26700). Ten units appeared between the two
// readings, or one of them is off by ten. It changes nothing here — the point
// holds at either value, since 28650 ÷ 15 is exact and 28660 ÷ 15 is not, and
// the rule has to survive the inexact one — but a number that moved without a
// document is the shape this module exists to notice.

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
// the one product where they differ (1910 against 28650) and does not look.
//
// So the rule exists to prevent a misreading, and applying it literally here
// manufactures one. The frames appear when they carry two facts.
export function showsPackageFrame(product) {
  return Number(product && product.units_per_package) !== 1
}
