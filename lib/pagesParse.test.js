const fs = require('fs')
const path = require('path')

// Every page module must at least parse.
//
// ⚠️ Written the moment it was needed. A JSX comment placed between two
// attributes — `{/* … */}` where only props may go — took every route in the
// app to a 500, and the whole suite passed: 867 tests, all green, on a build
// that would not compile. Nothing here loads a page, so nothing here noticed.
//
// This is not a substitute for rendering. It catches the one class the unit
// tests are structurally blind to: a file that is not valid JavaScript. That
// class costs the whole application rather than one screen, which is what
// makes the cheapest possible check worth having.
const PAGES = path.join(__dirname, '..', 'pages')

function pageFiles(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...pageFiles(full))
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('every page parses', () => {
  const files = pageFiles(PAGES)

  it('finds the pages, so a pass cannot mean it walked an empty tree', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files.map((f) => [path.relative(PAGES, f), f]))('%s', (_name, file) => {
    // require() runs the module, so a syntax error throws here. Anything the
    // module does at import time runs too, which is why jest.setup.js exists.
    expect(() => require(file)).not.toThrow()
  })
})
