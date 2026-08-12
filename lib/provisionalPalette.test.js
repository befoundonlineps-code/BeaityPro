const fs = require('fs')
const path = require('path')

// 🔴 THE COLOURS ARE NOT DECIDED, SO THE DECISION MUST COST ONE FILE.
//
// Every value in styles/globals.css is a neutral standing in for a colour
// nobody has chosen yet. That is only true for as long as the components read
// TOKENS rather than colours — one `#fea20f` pasted into a component and the
// eventual decision becomes a hunt, and the hunt misses one, and the screen
// ends up half-decided with nothing saying which half.
//
// ⚠️ AND THIS IS WHAT THE LAST ROUND ACTUALLY GOT WRONG. Not the measuring: the
// measuring was right. What was wrong was depositing a measurement as a
// decision — the owner asked for the reference's STRUCTURE and got its palette
// entered as settled fact. So the guard is not «are these the right colours»,
// which no test can ask. It is «is changing them still one edit», which is the
// property that keeps the question open.
//
// ⇒ The exception list is explicit, carries a reason each, and FAILS CLOSED: a
// new literal drops the suite, somebody looks at it once, and it either becomes
// a token or earns a line here.
const ROOT = path.join(__dirname, '..')
const REF_DIR = path.join(ROOT, 'components', 'ref')

// Anything that names a colour rather than a role.
//
// ⚠️ Written as a shape, not as a list of colours. A list would find `#fea20f`
// and miss `#FEA20F`, `rgb(254,162,15)` and `bg-orange-400` — three ways in for
// the price of one, which is the failure mode this project has paid for in
// every guard it has written by hand.
const COLOUR_SHAPES = [
  /#[0-9a-fA-F]{3,8}\b/g,
  /\brgba?\([^)]*\)/g,
  /\b(?:bg|text|border|fill|stroke|ring|from|to|via)-(?:white|black|slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?(?:\/\d{1,3})?\b/g,
]

// ⚠️ NEUTRALS THAT CARRY NO DECISION ARE ALLOWED, AND THE LINE IS DRAWN AT
// «would this change when the palette is chosen?».
//
//   bg-white     the paper a grid is printed on — it does not become teal
//   bg-black/5   a wash whose only job is «this is behind something»
//
// Both survive any palette. What does not survive is a HUE, and a hue is
// exactly what the shapes above catch.
const ALLOWED = new Set(['bg-white', 'bg-black/5', 'bg-black/10'])

// ⚠️ EMPTY TODAY, AND IT HELD ONE ENTRY UNTIL AN HOUR AGO: an `rgba(255,255,
// 255,0.28)` in a reference-styled tab strip, for the lighter box behind the
// active tab. The bars turned out not to be part of the conversion, the strip
// was deleted, and the exception went with it — so the list emptied by the
// component leaving rather than by anybody tidying it.
//
// ⇒ Kept as machinery rather than deleted, because the next legitimate
// exception should meet a list that already knows what it wants: a file, a
// literal, and a reason somebody wrote down.
const EXCEPTIONS = []

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('the reference shell reads tokens, not colours', () => {
  const files = walk(REF_DIR)

  it('searched a real tree', () => {
    // A walk that found nothing would find no violations either, and pass
    // loudest of all.
    //
    // ⚠️ A FLOOR, NOT A COUNT — and it was written as five, which is the number
    // of files that happened to be there. Deleting two of them for a good
    // reason then failed this, which is a guard crying at an innocent edit: the
    // kind whose number gets "corrected" until one day the correction hides an
    // empty walk. What it needs to know is that the walk reached the directory.
    expect(files.length).toBeGreaterThanOrEqual(3)
  })

  it('names no colour outside the exception list', () => {
    const found = []
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8')
      for (const line of text.split('\n')) {
        // Comments explain the rule and have to be able to say «orange».
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
        for (const shape of COLOUR_SHAPES) {
          shape.lastIndex = 0
          let m
          while ((m = shape.exec(line)) !== null) {
            if (ALLOWED.has(m[0])) continue
            found.push({ file: path.basename(file), literal: m[0] })
          }
        }
      }
    }

    // ⚠️ The whole list, not the count — the same reason writeColourToken
    // compares lists: a count of one passes while the one has MOVED.
    expect(found).toEqual(EXCEPTIONS.map(({ file, literal }) => ({ file, literal })))
  })

  it('has no exceptions at all right now', () => {
    // ⚠️ ASSERTED RATHER THAN LEFT IMPLIED, because the loop below it is
    // DORMANT while the list is empty and a dormant check reads exactly like a
    // passing one. This is the assertion that is awake: today the reference
    // components name no colour whatsoever, and the day one earns an exception
    // this fails and somebody looks at it once.
    expect(EXCEPTIONS).toEqual([])
  })

  it('gives every exception a reason', () => {
    // ⚠️ Dormant today — see above. Kept because an exception list without
    // reasons becomes a list of things nobody remembers agreeing to, which is
    // how «fails closed» quietly turns into «fails open one entry at a time»,
    // and the entry that would do that is the one added in a hurry.
    for (const e of EXCEPTIONS) expect(e.why.length).toBeGreaterThan(20)
  })
})

describe('the screen says the colours are provisional', () => {
  const badge = fs.readFileSync(path.join(REF_DIR, 'ProvisionalPaletteBadge.js'), 'utf8')
  const page = fs.readFileSync(path.join(ROOT, 'pages', 'products', 'index.js'), 'utf8')
  const common = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'public', 'locales', 'ar', 'common.json'), 'utf8')
  )

  it('carries the flag, and it is on', () => {
    // 🔴 A comment in the code is not enough and that is the point of the
    // badge. A neutral screen still looks like SOMEBODY'S neutral screen, and
    // the owner comparing it against the reference has no way to tell a
    // placeholder from a choice — which is the exact misreading that produced
    // the palette-as-decision in the first place.
    expect(badge).toMatch(/export const PROVISIONAL_PALETTE = true/)
    expect(badge).toContain('data-provisional-palette')
  })

  it('is actually rendered, not merely defined', () => {
    // ⚠️ THE HALF THAT WOULD FAIL SILENTLY. A flag set to true in a file
    // nothing imports says nothing to anybody, and every other assertion here
    // would still pass — a guard agreeing with itself about a badge that is on
    // no screen.
    expect(page).toContain('<ProvisionalPaletteBadge />')
  })

  it('says it in words that are in the dictionary', () => {
    // Otherwise the badge draws a raw key beside the breadcrumb — visible,
    // permanent, and saying nothing.
    expect(typeof common.provisionalPalette).toBe('string')
    expect(typeof common.provisionalPaletteHint).toBe('string')
    expect(common.provisionalPaletteHint.length).toBeGreaterThan(60)
  })

  it('is one line to remove', () => {
    // The badge returns null under the flag and nothing else, so the day the
    // colours are decided the removal is `true` -> `false` and nothing has to
    // be hunted for.
    expect(badge).toMatch(/if \(!PROVISIONAL_PALETTE\) return null/)
  })
})
