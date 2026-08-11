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
// ⚠️ What made the price case fail was a ROUND TRIP through a rounded store —
// unit_cost keeps four decimals, so 100/15 = 6.6667 and 6.6667 × 15 = 100.0005.
// There is no round trip here: both inputs are exact stored values and the
// division happens once, for display. 190 ÷ 20 is 9.5 and reads back as 190.
//
// ⇒ So this is judged INSIDE the rule's purpose and outside its letter, and it
// is flagged for review rather than settled quietly. If review reads it the
// other way, the package frame comes out and only the base frame stays — one
// call site, and the tests below say what would change.

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
