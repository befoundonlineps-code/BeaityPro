import fs from 'fs'
import path from 'path'
import { browserScreen } from './servicesScreen'

describe('browserScreen', () => {
  it('shows the browser while the catalogue is still arriving', () => {
    expect(browserScreen({ loading: true, typeCount: 3 })).toBe('browser')
  })

  it('shows the browser once it has arrived', () => {
    expect(browserScreen({ loading: false, typeCount: 3 })).toBe('browser')
  })

  // The regression, stated as the thing that must not happen again: the screen
  // changed identity in the middle of a refetch, so React unmounted the
  // component holding the selected folder, the expanded branches and the
  // search box, and every save came back to a blank screen.
  it('is the same screen before, during and after a reload', () => {
    const before = browserScreen({ loading: false, typeCount: 3 })
    const during = browserScreen({ loading: true, typeCount: 3 })
    const after = browserScreen({ loading: false, typeCount: 3 })

    expect(during).toBe(before)
    expect(after).toBe(before)
  })

  it('never answers with a loading screen at all', () => {
    // Loading is something the browser says about itself. A separate screen
    // for it is what took the browser down.
    for (const typeCount of [0, 1, 7]) {
      for (const loading of [true, false]) {
        expect(browserScreen({ loading, typeCount })).not.toBe('loading')
      }
    }
  })

  it('explains an empty business-type list, but only once loading has settled', () => {
    expect(browserScreen({ loading: false, typeCount: 0 })).toBe('noTypes')
    // Before the answer is known, "no types" would be a guess that flashes.
    expect(browserScreen({ loading: true, typeCount: 0 })).toBe('browser')
  })
})

// A component may hold state and it may be replaced by something else while
// loading, but not both — and the two halves of that sentence live in two
// different files, so nothing about either one on its own looks wrong.
describe('the wrapper does not decide anything on a loading flag', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'components', 'ServicesBrowser.js'),
    'utf8'
  )
  const wrapper = source.slice(
    source.indexOf('export default function ServicesBrowser'),
    source.indexOf('export function ServicesBrowserView')
  )

  it('found the wrapper to check', () => {
    expect(wrapper.length).toBeGreaterThan(100)
  })

  it('has no early return guarded by a loading flag', () => {
    const guards = [...wrapper.matchAll(/if\s*\(([^)]*)\)\s*\{?\s*\n?\s*return/g)].map((m) => m[1])
    expect(guards.filter((condition) => /loading/i.test(condition))).toEqual([])
  })

  it('renders the browser exactly once, and passes loading to it as a prop', () => {
    expect(wrapper.match(/<ServicesBrowserView/g)).toHaveLength(1)
    expect(wrapper).toMatch(/loading=\{/)
  })
})
