import fs from 'fs'
import path from 'path'

// A comment that says the project has not built something yet is a comment with
// an expiry date and no alarm on it.
//
// 🔴 IT DOES NOT MERELY GO STALE — IT BLOCKS THE WORK IT DESCRIBES. Whoever
// reads «there are no movements, so a column of zeros would say "nothing left"»
// does not build the column: the sentence reads as a decision rather than as a
// date. Five were found in one week:
//
//   ProductsBrowser      «no movements yet, so no balance column»
//   useProductCatalog    «the screen has nothing to do with storages until
//                          there are stock movements»
//   storageForm          «the fine is computed on a shortage — that code does
//                          not exist»            ← it does, 056c, run
//   079a                 «081 will measure this; until they run it is a claim»
//                                                ← they ran
//   stockDocumentForm    «a rule written for a screen that does not exist yet»
//                                                ← StocktakeScreen.js exists
//
// Four of the five were found BY ACCIDENT, one at a time. This file is the
// difference between that and counting them.
//
// ---------------------------------------------------------------------------
// ⚠️ THE NEEDLE TARGETS A SUBCLASS, AND SAYING SO IS THE POINT.
//
// A first sweep on «yet» / «not yet» / «بعد» returned eleven, and most were
// RIGHT and permanent:
//
//   «a salon with no staff yet» · «no documents yet» · «no saved slots yet»
//
// Those describe a RUNTIME STATE the code handles. They never expire, and a
// guard that failed on them would need an eleven-line exception list — which
// teaches people to add a twelfth without reading.
//
//   describes DATA the code handles   →  permanent, not this file's business
//   describes what the PROJECT has    →  expires, and nothing rings
//
// The two are not reliably separable by text, so this needle takes the clearest
// phrasings of the second and accepts that it misses others. It fails CLOSED
// for what it does cover: a new one has to be looked at once, and either fixed
// or given a line here with its reason.
//
// ⚠️ It is not a substitute for reading. It is a floor.
//
// ⚠️ AND ITS FIRST CATCH AFTER BEING WRITTEN WAS A FALSE POSITIVE ON FRESH
// PROSE: «a button that vanishes reads as a feature that does not exist» — the
// phrase used to describe how a UI READS, not to claim anything about the
// project. The fix was the sentence, not the needle («missing feature»), and
// not an exception entry.
//
// That choice is the rule CLAUDE.md item 2ب already states, and it matters
// most here: an exception added for one's own new writing is the cheapest thing
// in the world and it is how a three-line list becomes a twelve-line list
// nobody reads. The list is short because reaching for it is meant to be
// slightly annoying.
const NEEDLES = [
  [/does\s+not\s+exist/i, 'does not exist'],
  [/doesn[’']t\s+exist/i, "doesn't exist"],
  [/not\s+(yet\s+)?implemented|not\s+implemented\s+yet/i, 'not implemented'],
  [/until\s+(there\s+(are|is)|they\s+run|it\s+exists|that\s+exists)/i, 'until <future event>'],
  [/\bno\s+\w{0,12}\s?(code|screen|module|feature)\b[^.]{0,20}\byet\b/i, 'no such code yet'],
  [/لسّه ما|لسا ما|مش موجود/, 'Arabic: not there yet'],
]

// Keyed by `file:line-ish` is too brittle — a line above shifts and the list
// rots. Keyed by the file and a distinctive fragment of the line, so it survives
// reformatting and dies when the sentence does.
const ALLOWED = [
  {
    file: 'lib/raisedCodes.js',
    fragment: 'never "does not exist"',
    why: 'quotes the phrase AS THE RULE — "absence means NOT MEASURED, never does not exist". It is the thing this file is about, not an instance of it.',
  },
  {
    file: 'hooks/useProductCatalog.js',
    fragment: 'the screen has nothing to do with them until there are stock',
    why: 'the retired sentence, quoted inside its own correction so the next reader can see what was wrong. A corpse on display rather than a live claim.',
  },
]

describe('no comment claims the project has not built something', () => {
  const ROOT = path.join(__dirname, '..')
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith('.js') && !entry.name.endsWith('.test.js') ? [full] : []
  })

  const files = ['components', 'lib', 'hooks', 'pages'].flatMap((d) => walk(path.join(ROOT, d)))

  const hits = []
  for (const full of files) {
    const rel = path.relative(ROOT, full).split(path.sep).join('/')
    fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
      const trimmed = line.trim()
      // Comment lines only. A needle over whole files would match a string
      // literal or an identifier and report the code as prose — the fault
      // CLAUDE.md item 2ب is written about.
      if (!(trimmed.startsWith('//') || trimmed.startsWith('*'))) return
      for (const [re, name] of NEEDLES) {
        if (re.test(line)) hits.push({ rel, line: i + 1, name, text: trimmed })
      }
    })
  }

  it('reads the source rather than passing on an empty walk', () => {
    // A guard that scans nothing reports nothing wrong.
    expect(files.length).toBeGreaterThan(50)
  })

  it('finds no unaccounted claim', () => {
    const unaccounted = hits.filter(
      (h) => !ALLOWED.some((a) => a.file === h.rel && h.text.includes(a.fragment)),
    )
    // The message carries the line, because whoever reads this failure has to
    // decide whether the sentence is now false — and that needs the sentence.
    expect(unaccounted.map((h) => `${h.rel}:${h.line} [${h.name}] ${h.text}`)).toEqual([])
  })

  it('keeps the exception list honest — every entry still exists', () => {
    // ⚠️ Otherwise the list rots into names for sentences that are gone, and the
    // next reader cannot tell a live exception from a dead one. Same rule the
    // tatweel guard already applies to its own list.
    const missing = ALLOWED.filter((a) => {
      const full = path.join(ROOT, a.file)
      if (!fs.existsSync(full)) return true
      return !fs.readFileSync(full, 'utf8').includes(a.fragment)
    })
    expect(missing.map((a) => `${a.file} — ${a.fragment}`)).toEqual([])
  })

  it('would catch a new one', () => {
    // Counter-evidence on a copy, in the real shape rather than an invented
    // one — the exact sentence removed from lib/storageForm.js this week.
    const real = '// the fine is computed when a stocktake finds a shortage, that code does not exist,'
    expect(NEEDLES.some(([re]) => re.test(real))).toBe(true)

    // And it does NOT fire on the permanent kind, which is what keeps the
    // exception list short enough to be read.
    for (const permanent of [
      '// "No documents yet" and "nothing matches what you asked for" are different',
      '// The default shape a pattern gets when it has no saved slots yet',
      '// card long before the toolbar when a salon has no staff yet, so inline there',
    ]) {
      expect(NEEDLES.some(([re]) => re.test(permanent))).toBe(false)
    }
  })
})
