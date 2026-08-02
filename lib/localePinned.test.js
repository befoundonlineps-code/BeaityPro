import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// The app is pinned to `ar`, and the ltr isolate depends on it.
//
// Measured in Chrome, with the browser asking for ar-EG:
//
//   ar     → "9:00 ص"    European digits
//   ar-EG  → "٩:٠٠ ص"    Arabic-Indic
//   ar-PS  → "٩:٠٠ ص"    Arabic-Indic
//
// European digits are bidi class EN and an isolate reorders them. Arabic-
// Indic digits are AN, which never takes its parent's direction: "١٠:٤٤ –
// ١١:٢٩" is painted identically with the isolate and without it. That is not
// a defect today — an Arabic-Indic line reads right to left correctly by
// itself — but it means TimeRange would quietly stop doing anything the day
// a second locale arrived, and the guard beside it would still pass.
//
// Two things keep it from arriving, and both are asserted here: one locale
// in the config, and no formatter anywhere that lets the browser choose.
//
// What the second one can and cannot see. It reads source text, so it covers
// both spellings of the same mistake — `x.toLocaleTimeString()` and
// `new Intl.DateTimeFormat()` — and today the app uses only the first, eight
// times, each with its locale written out. It cannot see a locale that
// arrives in a variable and turns out to be something else at run time, nor
// a formatter reached through an alias. Neither exists here; both would need
// a different kind of check than reading a file.
const ROOT = join(__dirname, '..')
const read = (rel) => readFileSync(join(ROOT, ...rel.split('/')), 'utf8')

function sourceFiles(dir, out = []) {
  for (const e of readdirSync(join(ROOT, ...dir.split('/')), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) sourceFiles(rel, out)
    else if (/\.jsx?$/.test(e.name) && !/\.test\./.test(e.name)) out.push(rel)
  }
  return out
}

// One list, used by both checks below. They disagreed once — the sweep read
// pages and the count that keeps it honest did not — which would have let
// the count fall silently to zero if the formatters ever moved.
const SOURCES = [...sourceFiles('components'), ...sourceFiles('pages'), ...sourceFiles('lib')]

// Both spellings of "format this for a locale", with whatever was passed as
// the first argument captured.
const FORMATTERS = [
  /\.toLocale(?:Time|Date)?String\(\s*([^\s,)]*)/g,
  /\bIntl\.[A-Za-z]+\(\s*([^\s,)]*)/g,
]

function formatterCalls() {
  const calls = []
  for (const rel of SOURCES) {
    const source = read(rel)
    for (const pattern of FORMATTERS) {
      for (const m of source.matchAll(pattern)) calls.push({ rel, call: m[0], firstArg: m[1] })
    }
  }
  return calls
}

describe('the locale that reaches the formatters', () => {
  it('is the only one configured', () => {
    // eslint-disable-next-line global-require
    const { i18n } = require('../next-i18next.config')
    expect(i18n.locales).toEqual(['ar'])
    expect(i18n.defaultLocale).toBe('ar')
  })

  it('is never left for the browser to pick', () => {
    // A formatter with no locale follows navigator.languages, which is how
    // ar-EG gets in without anyone editing the config above.
    const loose = formatterCalls()
      .filter(({ firstArg }) => firstArg === '' || firstArg.startsWith('{') || firstArg === 'undefined')
      .map(({ rel, call }) => `${rel} :: ${call}`)

    expect(loose).toEqual([])
  })

  it('has formatters to check in the first place', () => {
    // Otherwise a rename turns the assertion above into a statement about an
    // empty list, which is the shape every hollow check in this project has
    // taken so far. Same file list as the sweep, deliberately.
    expect(formatterCalls().length).toBeGreaterThan(3)
  })
})
