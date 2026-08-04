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

// ⚠️ THE SHAPE, NOT A LIST OF NAMES — and the first version got this wrong in
// a way that proved itself within a day.
//
// It matched placeholders called `count` or `n`. The very next key written
// after it said "{{lines}} سطرًا" and walked straight past, because `lines` was
// not on the list. Widening the list to eleven names would have fixed that one
// case and left `{{qty}}`, `{{items}}`, `{{units}}`, `{{docs}}` to be found the
// same way — by accident, or never.
//
// A list of the known fails OPEN: every new name is a silent hole and nothing
// announces it. A description of the shape fails CLOSED: any placeholder
// followed by an Arabic word is caught by default, and a genuine exception is
// added by hand where it can be read. The two exception sets below are that
// hand — they were already right and did not need rebuilding.
const GOVERNING = /\{\{\s*([\w.]+)\s*\}\}\s*([؀-ۿ]+)/g

// The exception list is on the NON-numeric side, and the side matters more than
// the contents. Listing which placeholders are numbers fails open: a new name
// escapes and nothing says so. Listing which are not fails closed: a new name
// is flagged, somebody looks at it once, and it joins this list deliberately.
// Same rule, opposite direction, opposite consequence when it is incomplete.
const NON_NUMERIC = new Set(['name', 'unit', 'from', 'to', 'date', 'time', 'service', 'client', 'employee', 'storage', 'supplier'])

// ⚠️ And the other door, which this guard had quietly bolted shut.
//
// Avoiding plurals is the project's answer — put the number where no grammar
// governs it — and it is a good one. But a guard that also rejects the correct
// spelled-out forms decides that the other answer may never be used, and
// nobody decided that: "{{count}} مسؤولين" under key_few is right for 3–10 and
// was being flagged as a fault.
//
// A key ending in an i18next plural suffix is exempt, because the suffix is an
// explicit statement of intent rather than an incidental variable name. It is
// the one place where the author has said, in the key itself, "this string is
// written for exactly this range".
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other|plural)$/

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
        if (!/\{\{/.test(value)) continue
        // A key that names its plural range is exempt: the suffix says the
        // string was written for that range on purpose.
        if (PLURAL_SUFFIX.test(key)) continue
        numbered += 1
        // Every occurrence, not the first. A sentence with a safe placeholder
        // early and a counted noun later would otherwise pass on the strength
        // of the one that was fine.
        for (const [, placeholder, word] of value.matchAll(GOVERNING)) {
          if (NON_NUMERIC.has(placeholder)) continue
          if (UNIT_SYMBOLS.has(word) || PARTICLES.has(word)) continue
          offenders.push(`${file.replace('.json', '')}:${key} → {{${placeholder}}} ${word}`)
        }
      }
    }

    // Non-empty, so a walk that silently read nothing cannot pass by comparing
    // one empty list against another.
    expect(numbered).toBeGreaterThan(20)
    expect(offenders).toEqual([])
  })
})
