const fs = require('fs')
const path = require('path')

// The "you type here" fill means one thing, and this guards that it is spelled
// in exactly one place.
//
// The RULE is settled and is not about colour at all: a cell a person types a
// number into is marked, and a cell the system computes is not. Which cells
// those are is a commercial fact rather than a cosmetic one — the price is
// typed in the document that DECIDES the price and computed everywhere else —
// and it stays true whatever the fill turns out to be. Nobody reads column
// headings; they see the difference.
//
// 🔴 THE VALUE, HOWEVER, IS A PLACEHOLDER AND THIS FILE ONCE PRETENDED
// OTHERWISE. It pinned a colour measured off the reference screenshots, under a
// header explaining how carefully it had been measured — and the owner had
// never asked for the reference's colours. He asked for its STRUCTURE. So a
// correct measurement was deposited as a decision that was never taken, which
// is a worse failure than a wrong measurement: a wrong number invites doubt and
// a right one forecloses it.
//
// ⇒ What is guarded is the SINGLE DEFINITION POINT, not the number. When the
// real colour is chosen, one line moves in globals.css and one moves here — and
// the day somebody pastes the fill into a component to "match", this still
// fails. That was always the useful half.
//
// ⚠️ WHICH IS EXACTLY WHY A SECOND USE WOULD BE SILENT. Borrowing it for a
// selection, a hover, a link or a focus ring breaks nothing that any test would
// notice, and the screen still looks fine — the colour just stops meaning
// anything, gradually, and nobody can point at the commit that did it.
//
// ⚠️ AND THE RULE WAS ONLY EVER A SENTENCE. This file is the smallest thing
// that makes it a rule: the value may appear ONCE, where it is defined. The
// design system's other tokens are not guarded and do not need to be — this is
// the one the whole document-grid design rests on, and the one that was written
// down as "never used for anything else, ever".
const ROOT = path.join(__dirname, '..')

// Any spelling of the same colour. Written as a pattern rather than a string so
// that the oklch form, rgb(216,226,243), rgb(216, 226, 243) and #d8e2f3 are all
// one thing — four spellings would otherwise be four ways to smuggle it in.
//
// ⚠️ THE VALUE MOVED ONCE ALREADY, AND THIS FILE'S OWN HEADER PREDICTED IT: the
// neutral placeholder became the theme's blue on request, still provisional. So
// the edit was «one line in globals.css and one here», exactly as promised —
// which is the guard working, not the guard breaking.
//
// ⚠️ AND THE sRGB SPELLINGS ARE COMPUTED FROM THE oklch, NOT EYEBALLED.
// `oklch(0.91 0.025 262)` → `rgb(216, 226, 243)` → `#d8e2f3`, through
// OKLab → linear sRGB → gamma. They are here because a colour picker hands
// somebody the hex, never the oklch — so the hex is the likelier smuggling
// route, and leaving it out would make this guard blind in the one direction it
// is actually used.
const SPELLINGS = [
  /oklch\(\s*0?\.91\s+0?\.025\s+262\s*\)/gi,
  /rgb\(\s*216\s*,\s*226\s*,\s*243\s*\)/gi,
  /#d8e2f3\b/gi,
]

const SEARCH_DIRS = ['components', 'lib', 'pages', 'styles', 'design']
const EXTENSIONS = ['.js', '.jsx', '.css', '.html', '.md']

// ⚠️ Derived by walking, not a list of files. A hand-written file list is the
// fault this whole thread has been paying for; it would also miss the next
// screen, which is precisely where a second use would appear.
function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(full, out)
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      // ⚠️ Except this file, which has to spell the colour to look for it. Not
      // a general "skip tests" rule — one named exclusion, so a second test
      // that borrowed the colour would still be caught.
      if (path.basename(full) !== 'writeColourToken.test.js') out.push(full)
    }
  }
  return out
}

describe('the "you type here" blue is used for one thing', () => {
  const files = SEARCH_DIRS.flatMap((d) => walk(path.join(ROOT, d)))

  it('searched a real tree rather than an empty one', () => {
    // A walk that quietly found nothing would find no violations either, and
    // pass loudest of all.
    expect(files.length).toBeGreaterThan(50)
  })

  it('appears exactly once, at its definition', () => {
    const hits = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const re of SPELLINGS) {
        re.lastIndex = 0
        let m
        while ((m = re.exec(text)) !== null) {
          const before = text.slice(0, m.index).split('\n')
          const lineText = text.split('\n')[before.length - 1]
          hits.push({ file: path.relative(ROOT, file), line: lineText.trim() })
        }
      }
    }

    // ⚠️ The whole list is asserted, not the count. A count of one would pass
    // while the single use had MOVED out of the token definition and into a
    // component — which is the same failure wearing the right number.
    //
    // 🔴 AND WHAT PINS IT TO THE DEFINITION IS THE LINE'S TEXT, NOT ITS NUMBER.
    // It used to be `design/TOKENS.md:13`, which held only because that file
    // never changed above line 13. The definition now lives in globals.css,
    // which is edited constantly — a line number there would fail on every
    // unrelated token added above it, and a guard that cries at innocent edits
    // gets its number "corrected" until one day the correction is hiding a real
    // move. The condition, not the count: the hit is the declaration itself.
    expect(hits).toEqual([
      { file: path.join('styles', 'globals.css'), line: '--write: oklch(0.91 0.025 262);' },
    ])
  })
})
