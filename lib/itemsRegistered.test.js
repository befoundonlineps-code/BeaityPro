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
const CITATION = /(?:البند|بند)\s*([٠-٩0-9]+)|item\s+([0-9]+)/gi

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
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(CITATION)) {
      const number = toLatin(match[1] || match[2])
      if (!cited.has(number)) cited.set(number, new Set())
      cited.get(number).add(path.relative(ROOT, file).split(path.sep).join('/'))
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
