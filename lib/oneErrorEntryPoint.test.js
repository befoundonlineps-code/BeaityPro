const fs = require('fs')
const path = require('path')

// One way to turn a database error into a sentence on a screen.
//
// ⚠️ There were three, and I built the third. `t(reportDbError(e, ctx))` was
// the original; `t(reportRpcError(...))` grew beside it for functions that
// raise; then dbErrorSentence was added so a trigger's own hint could reach the
// screen at all — and for a while only sixteen call sites in one module used
// it, while forty elsewhere did not. Which meant the fix landed for products
// and nowhere else, and somebody writing a screen next month would have found
// two precedents with nothing to choose between them.
//
// That is the same fault written down for saveSetComponents and the multi-row
// writes: two answers to one question, neither marked. So it is a test rather
// than a note, because a note is what failed there.
const ROOTS = ['components', 'pages', 'hooks'].map((d) => path.join(__dirname, '..', d))

// The shapes that mean "a screen is building its own sentence".
const OLD_PATTERNS = [
  /t\(\s*reportDbError\(/,
  /t\(\s*reportRpcError\(/,
  /t\(\s*rpcErrorKey\(/,
  /t\(\s*dbErrorKey\(/,
]

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('screens have one way to say what went wrong', () => {
  const files = ROOTS.flatMap((r) => sourceFiles(r))

  it('reads the screens, so a pass cannot mean it found nothing', () => {
    expect(files.length).toBeGreaterThan(30)
  })

  it('finds no screen wrapping an error key in t() by hand', () => {
    // Wrapping a key is exactly what loses the hint: a key cannot carry the
    // Arabic sentence the trigger already wrote.
    const offenders = []
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      for (const [index, line] of source.split('\n').entries()) {
        if (OLD_PATTERNS.some((p) => p.test(line))) {
          offenders.push(`${path.relative(path.join(__dirname, '..'), file)}:${index + 1}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('still lets the libraries themselves use the pieces', () => {
    // dbErrors.js composes them; this is about screens, not about the layer
    // that builds the answer.
    const lib = fs.readFileSync(path.join(__dirname, 'dbErrors.js'), 'utf8')
    expect(lib).toMatch(/export function dbErrorSentence/)
    expect(lib).toMatch(/reportDbError/)
  })
})
