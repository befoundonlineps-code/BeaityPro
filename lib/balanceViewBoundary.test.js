const fs = require('fs')
const path = require('path')

// The balance screen's display grouping must not be imported by anything else.
//
// ⚠️ Written BEFORE the stocktake exists, because that is the only time it can
// prevent anything. I wrote "the stocktake needs the same sections" in a report
// and the reviewer corrected it: the two screens need the same INTERPRETATION
// and the opposite grouping.
//
//   the balance screen asks  what do I have, and what is wrong with my record?
//   the stocktake asks       what is actually on the shelf?
//
// They treat one section in opposite ways. "Never moved" is a reference on the
// balance screen — nothing to act on, so it folds. On a counting sheet it is
// the richest column there is: a wrong positive balance is caught by counting,
// but goods the system never knew about are found ONLY by somebody standing at
// the shelf. Folding it there does not make them harder to find, it makes them
// impossible — what is not in front of the counter is not counted.
//
// So the risk is not disagreement, it is CONVENIENCE: the grouping will be
// sitting in a file the stocktake already imports for the row meanings, and
// importing it will look like reuse. A comment does not stop that. This does.
//
// What IS shared stays freely importable: balanceRows, hasKnownValue,
// BALANCE_STATE, COST_STATE, problemKind, storageValueSummary — the meaning of
// a row, which must never be copied.
const ROOT = path.join(__dirname, '..')

// Named for the screen they belong to, and allowed only there.
const SCREEN_ONLY = ['balanceScreenSections', 'balanceScreenSectionOf', 'BALANCE_SCREEN_SECTION']

const ALLOWED = [
  'components/StorageBalances.js',
  'lib/balanceView.js',
  'lib/balanceView.test.js',
  'lib/balanceViewBoundary.test.js',
]

const SKIP = new Set(['node_modules', '.next', '.next-check', '.git', 'out', 'coverage'])

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('the balance screen’s grouping stays in the balance screen', () => {
  const files = sourceFiles(ROOT)

  it('reads the tree', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('is imported by nothing outside the screen that owns it', () => {
    const offenders = []
    for (const file of files) {
      const relative = path.relative(ROOT, file).split(path.sep).join('/')
      if (ALLOWED.includes(relative)) continue
      const source = fs.readFileSync(file, 'utf8')
      for (const name of SCREEN_ONLY) {
        if (new RegExp(`\\b${name}\\b`).test(source)) offenders.push(`${relative} → ${name}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('still exports what IS shared, so the stocktake can read a row’s meaning', () => {
    // The failure this guard must not cause: pushing somebody to re-derive
    // "never moved is not zero" because the file felt off-limits.
    const shared = require('./balanceView')
    for (const name of [
      'balanceRows', 'hasKnownValue', 'storageValueSummary', 'problemKind',
      'lowSupplyThreshold', 'counterpartBalances', 'BALANCE_STATE', 'COST_STATE',
    ]) {
      expect(shared[name]).toBeDefined()
    }
  })
})
