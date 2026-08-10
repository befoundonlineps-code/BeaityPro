const fs = require('fs')
const path = require('path')

// rgb(195, 217, 248) means one thing: "you type here".
//
// It was measured by the pixel across three reference documents — Packages
// carries it in all three, Amount carries it in the supply document alone and
// is white in the write-off and the order. So the rule is commercial rather
// than cosmetic: the price is typed in the document that decides the price, and
// computed everywhere else. The user does not read column headings; they see
// the colour.
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
// that rgb(195,217,248), rgb(195, 217, 248) and #c3d9f8 are all one thing —
// three spellings would otherwise be three ways to smuggle it in.
const SPELLINGS = [
  /rgb\(\s*195\s*,\s*217\s*,\s*248\s*\)/gi,
  /#c3d9f8\b/gi,
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
          const line = text.slice(0, m.index).split('\n').length
          hits.push(`${path.relative(ROOT, file)}:${line}`)
        }
      }
    }

    // ⚠️ The whole list is asserted, not the count. A count of one would pass
    // while the single use had MOVED out of the token definition and into a
    // component — which is the same failure wearing the right number.
    // ⚠️ The path is built with path.sep rather than typed, so this reads the
    // same on either platform — and the line number is asserted too, which is
    // what pins it to the definition rather than merely to the file.
    expect(hits).toEqual([path.join('design', 'TOKENS.md') + ':13'])
  })
})
