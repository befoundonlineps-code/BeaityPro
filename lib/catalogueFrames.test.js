import { packageFraction, showsPackageFrame } from './catalogueFrames'

describe('the package frame is a fraction, never a floor', () => {
  it('is not a floor, because a floor makes a silent claim', () => {
    // 🔴 floor printed «بالعبوة: 9» for 190 with a factor of 20, and 9 × 20 is
    // 180. Not a rounding — a statement about the shelf that is untrue.
    expect(packageFraction(190, 20)).toBe('9.5')
    expect(packageFraction(75, 15)).toBe('5.0')
  })

  it('is a CONVERSION and does not promise to read back', () => {
    // ⚠️ The first version of this test asserted the round trip — 9.5 × 20 is
    // 190 — and offered it as the justification. It holds only because that
    // division is exact. Measured on a real row it is not: factor 15, balance
    // 28660, cell shows 1910.67, and 1910.67 × 15 is 28660.05.
    //
    // So the frame states the same quantity in another unit rather than a
    // number that returns — a different kind of statement from the two STORED
    // frames on a movement, which are two recorded facts. The visible decimal
    // is what makes it read as a conversion instead of a tally.
    expect(packageFraction(28660, 15)).toBe('1910.67')
    expect(Number(packageFraction(28660, 15)) * 15).not.toBe(28660)
  })

  it('keeps a decimal even when the division is exact', () => {
    // «5» alone does not say whether it is exact or rounded, and the reader
    // cannot tell which rows to trust without it.
    expect(packageFraction(75, 15)).toBe('5.0')
    expect(packageFraction(0, 15)).toBe('0.0')
  })

  it('handles a negative balance without inventing a sign', () => {
    // A negative balance is a real state — BALANCE_STATE.NEGATIVE — and the
    // column shows it rather than clamping it to zero.
    expect(packageFraction(-75, 15)).toBe('-5.0')
  })

  it('answers null rather than Infinity for a factor that cannot divide', () => {
    // units_per_package is CHECK > 0 and NOT NULL in the schema, so this is
    // dead code — measured, and kept for the same reason as the coalesce in
    // 079a: an ALTER is one line and the failure would be a cell reading
    // «بالعبوة: Infinity».
    expect(packageFraction(10, 0)).toBeNull()
    expect(packageFraction(10, null)).toBeNull()
    expect(packageFraction(10, 'x')).toBeNull()
  })
})

describe('when both frames say the same thing, only one is shown', () => {
  it('drops the package frame for a one-to-one product', () => {
    // Measured on the owner's data: seven of eight have units_per_package = 1.
    // Printing «بالعبوة: 7 · بالقطعة: 7» teaches the reader the two boxes
    // repeat each other, and then the one product where they differ (1910
    // against 28650) goes unread.
    expect(showsPackageFrame({ units_per_package: 1 })).toBe(false)
    expect(showsPackageFrame({ units_per_package: 15 })).toBe(true)
    expect(showsPackageFrame({ units_per_package: '20' })).toBe(true)
  })

  it('shows it when the factor is missing rather than guessing', () => {
    // A missing factor is not a one-to-one product. Suppressing the frame here
    // would hide the anomaly instead of letting the cell say something odd.
    expect(showsPackageFrame({})).toBe(true)
    expect(showsPackageFrame(null)).toBe(true)
  })
})
