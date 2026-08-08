const fs = require('fs')
const path = require('path')

// An item that lives in a code comment and in no document is an item nobody
// will find on purpose.
//
// ⚠️ THIS CLASS HAS NOW BEEN HIT THREE TIMES, and all three were found by
// accident or by a reviewer's question rather than by anything here:
//
//   the run state of the SQL scripts  -> lived in the conversation
//   the seven-stage plan              -> lived in the conversation
//   item 44 (post_stocktake keeps no  -> cited SIX times in code comments
//   count, so a partial count dies)      and written in no document at all
//
// The remedy proposed was "grep at the end of each stage and compare". A step
// somebody has to remember is the thing that failed three times, so it is a
// test instead: the comparison runs on every suite, and a citation added today
// is either documented today or fails today.
const ROOT = path.join(__dirname, '..')
const CODE_DIRS = ['lib', 'components', 'pages', 'hooks', 'test-utils', 'docs/sql']
const CENTRAL_DOCS = ['docs/PROJECT_HANDOFF.md', 'docs/ARCHITECTURE.md', 'CLAUDE.md']

// This file cites numbers as examples; it must not be its own evidence.
const SELF = 'itemsRegistered.test.js'

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'
const toLatin = (text) => text.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))

// «البند ٤٤» · «بند 32» · «item 44». ADR numbers are a different namespace and
// are deliberately not matched: they live in ARCHITECTURE.md by construction.
//
// ⚠️ DELIBERATELY BROAD ON THE ENGLISH SIDE, and the exposure is measured rather
// than hoped away. "item" is an ordinary English word, so these all match:
//
//   // returns item 404 from the cache      -> 404
//   // the item 2 in this array             -> 2
//   // list item 3 of the RFC               -> 3
//
// Narrowing it fails OPEN, which is the wrong direction. Real citations in this
// codebase read «unlike item 31» and «while breaking item 35, which says» — no
// bracket, no dash, nothing to key on — so any rule tight enough to reject the
// decoys also rejects those, and an item goes undocumented in silence.
//
// The Arabic side needs none of this: «بنود» and «البنود» do not contain «بند»
// as a substring, so the plural cannot trip it. Measured, not assumed.
//
// So the pattern stays wide and the exceptions are named — the shape this
// project uses everywhere a guard must not go quiet. A false positive appears
// ONCE, somebody looks at it once, and it becomes either a documented item or a
// line here saying why it is not. What it cannot do is recur unnoticed, which is
// how a guard stops being believed.
const CITATION = /(?:البند|بند)\s*([٠-٩0-9]+)|item\s+([0-9]+)/gi

// Numbers matched by the pattern that are not project items, by file.
//
// ⚠️ EMPTY TODAY, and that is a measurement: every "item N" now in the codebase
// is a real citation. Kept as a door rather than added when needed, because the
// alternative to an easy door is somebody widening the pattern under deadline.
const NOT_PROJECT_ITEMS = {
  // 'lib/example.js': ['404'],  // an HTTP status, not an item
}

function sourceFiles() {
  const found = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!/node_modules|[.]next/.test(entry.name)) walk(full)
      } else if (/[.](js|sql)$/.test(entry.name) && entry.name !== SELF) {
        found.push(full)
      }
    }
  }
  for (const dir of CODE_DIRS) walk(path.join(ROOT, dir))
  return found
}

function citations() {
  const cited = new Map()
  for (const file of sourceFiles()) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/')
    const excused = NOT_PROJECT_ITEMS[relative] || []
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(CITATION)) {
      const number = toLatin(match[1] || match[2])
      if (excused.includes(number)) continue
      if (!cited.has(number)) cited.set(number, new Set())
      cited.get(number).add(relative)
    }
  }
  return cited
}

const documented = () => toLatin(
  CENTRAL_DOCS.map((doc) => fs.readFileSync(path.join(ROOT, doc), 'utf8')).join('\n')
)

function isDocumented(number, docs) {
  // Named in a sentence, or standing as its own cell in the items table.
  return new RegExp(`(?:البند|بند)\\s*${number}\\b|item\\s+${number}\\b|\\|\\s*${number}\\s*\\|`, 'i')
    .test(docs)
}

function undocumented() {
  const docs = documented()
  return [...citations().keys()]
    .filter((number) => !isDocumented(number, docs))
    .sort((a, b) => Number(a) - Number(b))
}

describe('an item cited in code is an item written in a document', () => {
  it('reads a real amount of code', () => {
    // Guarding an empty scan is the failure this project has paid for before.
    expect(sourceFiles().length).toBeGreaterThan(50)
    expect(citations().size).toBeGreaterThan(5)
  })

  it('has no item living in code alone', () => {
    // The message carries where each one is cited, because the person reading
    // this failure has to decide whether it belongs in PROJECT_HANDOFF, and
    // that decision needs to see what the code says about it.
    const cited = citations()
    expect(undocumented().map((n) => `${n} ← ${[...cited.get(n)].sort().join(', ')}`)).toEqual([])
  })

  // ⚠️ Counter-evidence, because a scan that finds nothing looks identical to a
  // scan that looks nowhere — and this guard exists BECAUSE three things were
  // found by accident rather than by a check.
  it('would report an item that only a comment knows about', () => {
    const docs = documented()
    expect(isDocumented('9999', docs)).toBe(false)
    // And it does not simply say no to everything: 44 is the item that prompted
    // this file, and it is now written down.
    expect(isDocumented('44', docs)).toBe(true)
  })

  it('reads Arabic-Indic digits as the same item as Latin ones', () => {
    // «البند ٤٤» and "item 44" are one item. Treating them as two would let a
    // number be documented in one script and cited in the other, and report
    // nothing.
    expect(toLatin('البند ٤٤')).toBe('البند 44')
    const cited = citations()
    expect(cited.has('44')).toBe(true)
  })
})

describe('the pattern is wide on purpose, and the width is named', () => {
  const numbersIn = (line) => [...line.matchAll(CITATION)].map((m) => toLatin(m[1] || m[2]))

  it('does match ordinary English uses of the word "item"', () => {
    // ⚠️ Asserted rather than apologised for. These are the false positives the
    // width buys, written down so nobody has to rediscover them by watching the
    // suite go red on an unrelated commit.
    expect(numbersIn('// returns item 404 from the cache')).toEqual(['404'])
    expect(numbersIn('// the item 2 in this array')).toEqual(['2'])
    expect(numbersIn('// list item 3 of the RFC')).toEqual(['3'])
  })

  it('does not match a number that merely sits near a word', () => {
    // The other direction, or the test above would be describing a pattern that
    // matches everything.
    expect(numbersIn('// HTTP 404 means not found')).toEqual([])
    expect(numbersIn('// bumped to version 18')).toEqual([])
    expect(numbersIn('// eslint-disable-next-line max-len 120')).toEqual([])
  })

  it('is not tripped by the Arabic plural, which contains no «بند»', () => {
    // «بنود» is ب-ن-و-د and «البنود» likewise: the singular is not a substring
    // of either, so the commonest Arabic false positive cannot occur. Measured
    // here rather than reasoned about in a comment nobody re-checks.
    expect(numbersIn('// بنود الفاتورة ٣ أسطر')).toEqual([])
    expect(numbersIn('// البنود الثلاثة و ٣ أسطر')).toEqual([])
    expect(numbersIn('// البند ٤٤ مسجَّل')).toEqual(['44'])
  })

  it('lets a named exception through, and only for its own file', () => {
    // ⚠️ The door has to work before it is needed, or the first person to need
    // it under pressure widens the pattern instead. Keyed by file so excusing a
    // number in one place cannot silence a real citation somewhere else.
    const excused = { 'lib/a.js': ['404'] }
    const skip = (file, n) => (excused[file] || []).includes(n)
    expect(skip('lib/a.js', '404')).toBe(true)
    expect(skip('lib/b.js', '404')).toBe(false)
    expect(skip('lib/a.js', '44')).toBe(false)
  })

  it('carries no dead exception', () => {
    // ⚠️ NOT "the list is empty". It is empty today, and asserting that would
    // make the first honest entry fail a test — friction pointing straight at
    // the thing this design exists to prevent: widening the pattern instead of
    // naming the case.
    //
    // What is asserted is that every entry still does something: the file
    // exists, and the number really appears in it. An excuse for a line that
    // was deleted or renamed is an excuse silently covering whatever moves in
    // next, which is how an exception list rots into a hole.
    for (const [file, numbers] of Object.entries(NOT_PROJECT_ITEMS)) {
      const full = path.join(ROOT, file)
      expect(fs.existsSync(full)).toBe(true)
      const text = toLatin(fs.readFileSync(full, 'utf8'))
      for (const number of numbers) {
        expect(text).toMatch(new RegExp(`item\\s+${number}\\b|(?:البند|بند)\\s*${number}\\b`, 'i'))
      }
    }
  })
})
