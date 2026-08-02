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

describe('the locale that reaches the formatters', () => {
  it('is the only one configured', () => {
    // eslint-disable-next-line global-require
    const { i18n } = require('../next-i18next.config')
    expect(i18n.locales).toEqual(['ar'])
    expect(i18n.defaultLocale).toBe('ar')
  })

  it('is never left for the browser to pick', () => {
    // toLocaleTimeString() with no locale follows navigator.languages, which
    // is how ar-EG would get in without anyone editing the config.
    const loose = []
    for (const rel of [...sourceFiles('components'), ...sourceFiles('pages'), ...sourceFiles('lib')]) {
      const source = read(rel)
      for (const m of source.matchAll(/toLocale(?:Time|Date)?String\(\s*([^\s,)]*)/g)) {
        const firstArg = m[1]
        if (firstArg === '' || firstArg === ')' || firstArg.startsWith('{') || firstArg === 'undefined') {
          loose.push(`${rel} :: ${m[0]}`)
        }
      }
    }
    expect(loose).toEqual([])
  })

  it('has formatters to check in the first place', () => {
    // Otherwise a rename turns the assertion above into a statement about an
    // empty list, which is the shape every hollow check in this project has
    // taken so far.
    const calls = [...sourceFiles('components'), ...sourceFiles('lib')]
      .flatMap((rel) => [...read(rel).matchAll(/toLocale(?:Time|Date)?String\(/g)].map(() => rel))
    expect(calls.length).toBeGreaterThan(3)
  })
})
