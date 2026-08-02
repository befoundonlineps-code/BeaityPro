import { readFileSync } from 'fs'
import { join } from 'path'

// A time range on an RTL page is painted backwards unless it is isolated.
//
// The digits are European numbers and the dash between them is neutral, so
// the bidi algorithm gives the dash the paragraph's direction and swaps the
// halves: "10:44 – 11:29" is stored, and "11:29 – 10:44" is what a reader
// sees. Measured in Chrome, both before and after the fix.
//
// Nothing about that is visible to a unit test — jest has no layout, and the
// string, the DOM and every value in between are already correct. What a
// test can hold onto is the one thing that keeps the painting honest: the
// dir="ltr" isolate has to still be there. This shipped once without it.
describe('the calendar card’s time range', () => {
  const source = readFileSync(join(__dirname, '..', 'components', 'EmployeeColumnBody.js'), 'utf8')

  it('renders every time label inside an ltr isolate', () => {
    const rendered = source.match(/\{timeLabel\}/g) || []
    const isolated = source.match(/<span dir="ltr">\{timeLabel\}<\/span>/g) || []

    // Two blocks draw a card: the pending one with its buttons and the plain
    // one. Counting them first means a rename that quietly removes both
    // cannot let this pass by finding nothing left to check.
    expect(rendered).toHaveLength(2)
    expect(isolated).toHaveLength(rendered.length)
  })

  it('keeps the isolate on the span rather than on the line’s own div', () => {
    // dir on the div would resolve text-align: start against ltr and push
    // the time to the left edge, away from the name and service above it.
    expect(source).not.toMatch(/<div[^>]*dir="ltr"[^>]*>\s*\{timeLabel\}/)
  })
})
