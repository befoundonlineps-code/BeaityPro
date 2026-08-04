const fs = require('fs')
const path = require('path')

// Arabic makes a counted noun agree with its number, in four different ways:
//
//   1        مسؤول واحد          singular
//   2        مسؤولان اثنان       dual
//   3–10     خمسة مسؤولين        plural, genitive
//   11–99    ١٥ مسؤولًا           singular, accusative
//   100+     ٢٥٠ مسؤولٍ           singular, genitive
//
// One string cannot satisfy all of them. "{{count}} مسؤولًا" is right for 11–99
// and wrong for every other range — including 1 and 2, which are the commonest
// counts a confirmation dialog ever names. That one shipped, and the owner read
// "2 مسؤولًا" on their own screen.
//
// The fix is not plural forms and not i18next's plural machinery. Six Arabic
// plural categories with any of them missing falls back to one string and puts
// us back here. The fix is to write what does not change with the number: put
// it after a colon, or inside brackets, where no grammar governs it.
//
//   ✗  لهذا المستودع {{n}} مسؤولًا ماليًا
//   ✓  لهذا المستودع مسؤولون ماليًا مسجّلون (العدد: {{n}})
//
// This test is here rather than a line in CLAUDE.md because that line would be
// read once and the next sentence with a number in it would be written a month
// later by somebody who never saw it.
const DIR = path.join(__dirname, '..', 'public', 'locales', 'ar')

// A numeral followed by Arabic script is the shape that goes wrong: the word
// after it is a counted noun taking one of the five forms above.
//
// ⚠️ Which placeholders count as numbers is decided by their NAMES, and that is
// the weak joint. The first version knew only `count` and `n`, and the very
// next key written after it used `{{lines}}` — which would have walked past.
// A placeholder named something outside this list still escapes, so the list
// grows when a new name appears rather than being trusted to be complete.
const NUMERIC = 'count|n|num|lines|total|qty|amount|days|hours|minutes|price'
const GOVERNING = new RegExp(`\\{\\{(?:${NUMERIC})\\}\\}\\s*([؀-ۿ]+)`)

// Unit symbols are not counted nouns. An abbreviation has no plural and no
// case, so "45 د" and "3 د" are equally right — which is the whole reason
// abbreviations exist. Spelled-out units are NOT on this list: "3 دقيقة" is
// wrong and has to be written "3 د" or moved out of the governing slot.
const UNIT_SYMBOLS = new Set(['د', 'س', 'ث', 'كغ', 'غ', 'مل', 'سم', 'م'])

// A separate exception, and not the same one. A particle after a number is not
// a counted noun at all and never inflects for it: "متبقي 3 من 5" is right at
// every count, the same as "3 و4". This is not a unit and not a licence — it
// is the observation that the rule is about المعدود, and من is not one.
const PARTICLES = new Set(['من', 'إلى', 'في', 'على', 'مع', 'و', 'أو', 'عن', 'حتى', 'بـ'])

function stringsIn(value, prefix, out) {
  for (const [key, child] of Object.entries(value)) {
    const at = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object') stringsIn(child, at, out)
    else if (typeof child === 'string') out.push([at, child])
  }
}

describe('no Arabic sentence lets a number govern the word after it', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))

  it('reads every namespace, so a pass cannot mean it found nothing', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  it('finds no counted noun standing straight after a number', () => {
    const offenders = []
    let numbered = 0

    for (const file of files) {
      const parsed = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'))
      const strings = []
      stringsIn(parsed, '', strings)

      for (const [key, value] of strings) {
        if (!new RegExp(`\\{\\{(?:${NUMERIC})\\}\\}`).test(value)) continue
        numbered += 1
        const match = value.match(GOVERNING)
        if (match && !UNIT_SYMBOLS.has(match[1]) && !PARTICLES.has(match[1])) {
          offenders.push(`${file.replace('.json', '')}:${key} → "${match[1]}"`)
        }
      }
    }

    // Non-empty, so a walk that silently read nothing cannot pass by comparing
    // one empty list against another.
    expect(numbered).toBeGreaterThan(20)
    expect(offenders).toEqual([])
  })
})
