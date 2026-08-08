import { renderToStaticMarkup } from 'react-dom/server'
import TwoPaneBrowser from './TwoPaneBrowser'

// ⚠️ THIS COMPONENT HAS TWO CONSUMERS AND I CHANGED ITS DEFAULT FOR ONE OF THEM.
//
// The products catalogue now means "nothing selected shows everything", and the
// services browser still means "nothing selected shows nothing". The widening
// was made opt-in so services would keep its behaviour — and then it was left
// resting on "we did not touch it", which is exactly the reasoning that lets a
// shared component break a consumer nobody was looking at.
//
// So the CONTRACT is tested here rather than either consumer: a hint present
// means the hint replaces the content, a hint absent means the content is drawn.
// Testing it at the component covers both callers by construction, and covers
// the third caller nobody has written yet.
jest.mock('next-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
}))

const HINT = 'اختر مجلّدًا من الشجرة'
const CONTENT = 'THE-TABLE-CONTENT'

const render = (over) => renderToStaticMarkup(
  <TwoPaneBrowser
    loading={false}
    tree={[]}
    selectedCategoryId={null}
    onSelectCategory={() => {}}
    search=""
    onSearchChange={() => {}}
    searchPlaceholder="ابحث"
    {...over}
  >
    <div>{CONTENT}</div>
  </TwoPaneBrowser>
)

describe('what an unselected folder shows', () => {
  it('shows the hint instead of the content when a hint is given', () => {
    // The services browser's contract, unchanged. If this fails, that screen
    // has started listing every service the moment it loads.
    const html = render({ pickCategoryHint: HINT })
    expect(html).toContain(HINT)
    expect(html).not.toContain(CONTENT)
  })

  it('shows the content when no hint is given', () => {
    // The products catalogue's contract, and the whole point of the change:
    // nothing selected means everything.
    const html = render({})
    expect(html).toContain(CONTENT)
    expect(html).not.toContain(HINT)
  })

  it('shows the content once a folder is selected, hint or not', () => {
    // The hint must not survive a selection — it is about the absence of one.
    for (const hint of [HINT, undefined]) {
      const html = render({ pickCategoryHint: hint, selectedCategoryId: 'c1' })
      expect(html).toContain(CONTENT)
      expect(html).not.toContain(HINT)
    }
  })

  it('treats an empty hint as no hint, not as a blank message', () => {
    // ⚠️ A caller passing t() for a key that does not exist gets '' back, and an
    // empty hint drawn INSTEAD of the table is a screen that looks broken and
    // says nothing. Falling through to the content is the recoverable failure.
    const html = render({ pickCategoryHint: '' })
    expect(html).toContain(CONTENT)
  })
})

describe('the two consumers still mean different things', () => {
  it('services asks for the hint and products does not', () => {
    // ⚠️ Read from the sources, because the contract above is only protective
    // while the callers keep using it the way they mean to. A products screen
    // that started passing a hint again would go back to opening empty, and
    // nothing else here would notice.
    const fs = require('fs')
    const path = require('path')
    const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8')

    expect(read('ServicesBrowser.js')).toMatch(/pickCategoryHint=\{/)
    expect(read('ProductsBrowser.js')).not.toMatch(/pickCategoryHint=\{/)
  })
})
