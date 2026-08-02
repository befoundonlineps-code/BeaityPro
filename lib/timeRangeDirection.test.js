import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// One component prints ranges, and this is what keeps it that way.
//
// A range of European digits is painted backwards on a right-to-left page:
// the dash between them is neutral, so the bidi algorithm gives it the
// paragraph's direction and swaps the halves. "10:44 – 11:29" is stored, is
// in the DOM, and reaches the eye as "11:29 – 10:44". Six call sites each
// had their own copy of the formatting and every one of them got it wrong,
// because the rule is invisible from the call site and no value anywhere is
// wrong to read.
//
// Counting isolates in six named files would have said nothing about the
// seventh, so none of these tests names a call site. They say instead that
// there is one formatter, one isolate, and nothing hand-rolled beside them.
//
// The isolate is for European digits only. Arabic-Indic digits are a
// different bidi class and never take their parent's direction — an isolate
// does not move them at all, measured. lib/localePinned.test.js is what
// keeps them out of the app.

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

const ALL = [...sourceFiles('components'), ...sourceFiles('pages'), ...sourceFiles('lib')]

describe('the one component that prints a range', () => {
  it('wraps its label in an ltr isolate', () => {
    expect(read('components/TimeRange.js')).toMatch(/<span dir="ltr"[^>]*>\{label\}<\/span>/)
  })

  it('never puts the isolate on the block wrapper', () => {
    // dir on a block resolves text-align: start against ltr and drags the
    // range to the far edge, away from whatever it sits under.
    expect(read('components/TimeRange.js')).not.toMatch(/<div[^>]*dir="ltr"/)
  })

  it('is the only thing that formats one', () => {
    const importers = ALL.filter((f) => /from '[^']*lib\/timeRange'/.test(read(f)))
    expect(importers).toEqual(['components/TimeRange.js'])
  })
})

describe('nothing hand-rolls an isolate or a range beside it', () => {
  it('keeps dir="ltr" to the two places that own a direction decision', () => {
    // TimeRange owns clock ranges. WorkPhoneDialog owns phone numbers, which
    // are the same problem in a different shape.
    const withIsolate = ALL.filter((f) => read(f).includes('dir="ltr"'))
    expect(withIsolate.sort()).toEqual([
      'components/TimeRange.js',
      'components/WorkPhoneDialog.js',
    ])
  })

  it('finds no dash-joined pair that has not been looked at', () => {
    // Every entry below joins text to text, where the dash takes the
    // direction of the Arabic beside it and lands correctly on its own. A
    // new line here is the question this file exists to force: are the two
    // sides numbers? If they are, it belongs in TimeRange.
    const REVIEWED = [
      // a label and a "soon" badge
      "components/CalendarToolbar.js :: title={`${t('appointments:quickSaleButton')} — ${t('topBar:soonBadge')}`}",
      "components/ClientsSecondaryBar.js :: title={soon ? `${label} — ${soonLabel}` : label}",
      "components/Sidebar.js :: title={s.active ? label : `${label} — ${t('common:inDevelopmentSuffix')}`}",
      // hover titles assembled from whole phrases
      "components/AppointmentCalendar.js :: ].filter(Boolean).join(' — ')}",
      "components/EmployeeColumnBody.js :: ].filter(Boolean).join(' — ')}",
      "components/EmployeeColumnBody.js :: ].filter(Boolean).join(' — ')}",
      // a service name and its length, not two ends of anything
      "components/AppointmentFormDialog.js :: <option key={s.id} value={s.id}>{s.name} — {s.duration_minutes} {t('appointments:formDialog.minutesShort')}</option>",
      // a client's name and their phone
      "components/ClientPickerDialog.js :: <span>{c.first_name} {c.last_name} — {c.phone_number}</span>",
      "components/ClientRelationships.js :: {c.first_name} {c.last_name} — {c.phone_number}",
      // The one range deliberately left alone: ICU gives it ص/م, which makes
      // the line an Arabic line, and an Arabic line reads right to left
      // correctly by itself. An isolate garbles it — measured, both ways.
      "lib/shiftSummary.js :: export function shiftSummary(windows, locale, separator = ' – ', between = '، ') {",
    ]

    const RANGE = /\}\s*[–—]\s*[{$]|['"`]\s[–—]\s['"`]/
    const found = []
    for (const rel of ALL) {
      if (rel === 'lib/timeRange.js') continue // the formatter itself
      for (const line of read(rel).split('\n')) {
        if (RANGE.test(line) && !line.includes('TimeRange')) {
          found.push(`${rel} :: ${line.trim()}`)
        }
      }
    }

    // Non-empty, so a walk that silently found nothing cannot pass by
    // comparing one empty list against another.
    expect(found.length).toBeGreaterThan(5)
    expect(found.sort()).toEqual([...REVIEWED].sort())
  })
})
