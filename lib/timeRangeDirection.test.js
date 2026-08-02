import { readFileSync } from 'fs'
import { join } from 'path'

// A range of Latin digits is painted backwards on a right-to-left page.
//
// The numbers are European and the dash between them is neutral, so the bidi
// algorithm hands that neutral the paragraph's direction and swaps the two
// halves: "10:44 – 11:29" is stored, and "11:29 – 10:44" is what a reader
// sees. Measured in headless Chrome at every site below, before and after.
//
// None of that is visible to a unit test. Jest has no layout, and the string,
// the DOM and every value in between are already correct — which is exactly
// how it shipped. What a test can hold onto is the one thing that keeps the
// painting honest: the dir="ltr" isolate has to still be there.
//
// Two places deliberately have no isolate and are not listed here, because
// measuring said they are already right and that an isolate would break them:
// shiftSummary's output carries ص/م, and the week heading carries an Arabic
// month name. Strong Arabic text makes the line an Arabic line, and it reads
// correctly right to left on its own.
const SITES = [
  {
    file: 'components/EmployeeColumnBody.js',
    // Two blocks draw a card: the pending one with its buttons, and the plain
    // one.
    render: '{timeLabel}',
    count: 2,
  },
  {
    file: 'components/AppointmentActionsDialog.js',
    // A node in the label/value array, since the row renderer cannot know
    // which of its values is a number.
    render: '{timeRange(appointment)}',
    count: 1,
  },
  {
    file: 'components/AdjustDurationDialog.js',
    // Only the range: the minute count beside it is an Arabic phrase.
    render: '{hhmm(start)} – {hhmm(currentEnd)}',
    count: 1,
  },
  {
    file: 'components/AppointmentClusterDialog.js',
    render: '{timeLabel(a.start_time)} — {timeLabel(a.end_time)}',
    count: 1,
  },
  {
    file: 'components/ResourceBookingsDialog.js',
    render: '{timeLabel(a.start_time)} — {timeLabel(a.end_time)}',
    count: 1,
  },
  {
    file: 'components/ReleasePreviewList.js',
    // This one already had a span, so the isolate is an attribute among
    // others rather than a new element — hence the loose open tag below.
    render: '{timeRange(a)}',
    count: 1,
  },
]

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('every range on the page keeps its ltr isolate', () => {
  it.each(SITES)('$file', ({ file, render, count }) => {
    const source = readFileSync(join(__dirname, '..', ...file.split('/')), 'utf8')

    const rendered = source.match(new RegExp(escape(render), 'g')) || []
    const isolated = source.match(new RegExp(`<span[^>]*dir="ltr"[^>]*>\\s*${escape(render)}`, 'g')) || []

    // Counting the render sites first means a rename that quietly removes
    // them all cannot let this pass by finding nothing left to check.
    expect(rendered).toHaveLength(count)
    expect(isolated).toHaveLength(count)
  })

  it('keeps the card’s isolate on the span rather than on the line’s own div', () => {
    // dir on the div would resolve text-align: start against ltr and push the
    // time to the left edge, away from the name and service above it.
    const source = readFileSync(join(__dirname, '..', 'components', 'EmployeeColumnBody.js'), 'utf8')
    expect(source).not.toMatch(/<div[^>]*dir="ltr"[^>]*>\s*\{timeLabel\}/)
  })
})
