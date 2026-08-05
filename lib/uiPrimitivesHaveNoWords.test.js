const fs = require('fs')
const path = require('path')

// A primitive in components/ui must not carry words of its own.
//
// ⚠️ Written after `<span className="sr-only">Close</span>` shipped inside
// DialogContent and reached all 34 dialogs in the product — English, in an
// Arabic UI, read aloud to anybody using a screen reader.
//
// It is the worst shape a defect can have: sr-only text is never seen, so no
// screenshot review can catch it, and the only people who meet it are the ones
// least able to report it. It survived every round of this module.
//
// The fix was to let the primitive read i18n rather than take a label prop —
// "ui/* must not know about translations" is a LIBRARY's rule, and this is one
// product in one language with one copy of these files. A prop would make
// forgetting possible at every call site, silently.
//
// This guard describes the SHAPE (a run of letters sitting as JSX text)
// rather than listing known offenders, so a word nobody thought of is caught
// too. Baseline when written: zero.
const UI = path.join(__dirname, '..', 'components', 'ui')

// A run of letters sitting as JSX text — between a closing `>` and whichever
// comes next, a tag or an expression.
//
// ⚠️ The first version required the text to be the ONLY child (`>word<`) and a
// planted `<div>كلمة{children}</div>` walked straight through it. That is the
// fail-open shape this file exists to prevent, written into the guard itself
// on the first attempt. Measured, then fixed, then measured again.
//
// `(?<![=-])` keeps arrow functions and `->` out: `=>` is a `>` with text after
// it in every callback in the file.
const LITERAL_TEXT = /(?<![=-])>([^<>{}]*)/g
const WORD = /[A-Za-z؀-ۿ][A-Za-z؀-ۿ ,.'’!?-]{2,}/

// Comments explain WHY a rule exists and are not shipped as words. Stripping
// them is not cosmetic: the first version of the check below searched raw file
// text for ">Close<" and failed on a COMMENT that quoted the very string it was
// guarding against. A check that reads a file rather than its code answers
// about the wrong thing.
//
// String literals are blanked for the same reason, and that one was measured
// rather than foreseen: Tailwind arbitrary variants put a `>` INSIDE a class
// string — `has-[>svg]:size-4`, `*:[img:first-child]:rounded-t-xl` — so the
// scanner read "svg", "img" and "last" as drawn words and reported ten
// failures on clean files. Quotes are kept so the code still tokenises.
const withoutComments = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

// ⚠️ Two strips, not one, and keeping them apart was itself a measurement:
// blanking strings for the scanner also blanked t('common:close'), so the
// check that pins the fix started failing on the fixed file. A helper reused
// for two questions answered one of them wrong.
const codeOf = (source) => withoutComments(source)
  .replace(/"(?:[^"\\]|\\.)*"/g, '""')
  .replace(/'(?:[^'\\]|\\.)*'/g, "''")
  .replace(/`(?:[^`\\]|\\.)*`/g, '``')

function files(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files(full, out)
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('the ui primitives carry no words of their own', () => {
  const sources = files(UI)

  it('reads the primitives', () => {
    expect(sources.length).toBeGreaterThan(5)
  })

  it('has no literal text node in any of them', () => {
    const found = []
    for (const file of sources) {
      const code = codeOf(fs.readFileSync(file, 'utf8'))
      for (const match of code.matchAll(LITERAL_TEXT)) {
        const word = (match[1] || '').match(WORD)
        if (word) found.push(`${path.relative(path.join(__dirname, '..'), file)} → "${word[0].trim()}"`)
      }
    }
    expect(found).toEqual([])
  })

  it('both dialog close labels come from the dictionary', () => {
    // TWO of them shipped, not one — the second sat on its own line, so a
    // hand-written single-line grep missed it and the shape check above found
    // it on first run. Pinned by count so removing one does not pass.
    const dialog = withoutComments(fs.readFileSync(path.join(UI, 'dialog.jsx'), 'utf8'))
    expect(dialog.match(/t\('common:close'\)/g)).toHaveLength(2)
  })
})
