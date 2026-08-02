import fs from 'fs'
import path from 'path'

// Every component named in JSX has to be in scope where it is named.
//
// This exists because deleting a component and missing one of its call sites
// is invisible to everything else here: the file still compiles, the server
// still answers 200, and the crash only happens in the browser, at the moment
// that component would have rendered. For a screen behind a login that means
// nobody without a session can see it at all — which is exactly how a dead
// <BulkReleaseDialog> reference reached a branch that had been called
// verified.
//
// ESLint's react/jsx-no-undef is the usual home for this rule. There is no
// ESLint in this project, so it lives here instead, where `npm test` runs it.

const ROOTS = ['components', 'pages']

function sourceFiles(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, found)
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) found.push(full)
  }
  return found
}

// Comments are stripped first: a `// <Foo> used to go here` is prose, not a
// reference, and counting it would make the check cry wolf until someone
// switched it off.
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

// The root identifier of every JSX element written with a capital letter.
// <Dialog.Content> is a use of Dialog; lowercase tags are plain HTML.
function jsxIdentifiers(source) {
  return new Set(
    [...source.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1])
  )
}

// Anything that could put a name in scope: an import in any of its forms, a
// declaration, or a parameter destructured out of props.
function namesInScope(source) {
  const names = new Set()

  for (const m of source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"]/g)) {
    for (const part of m[1].split(/[,{}]/)) {
      const name = part.replace(/\*\s+as\s+/, '').trim().split(/\s+as\s+/).pop()
      if (name) names.add(name.trim())
    }
  }
  for (const m of source.matchAll(/(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g)) {
    names.add(m[1])
  }
  // Destructured props: `function X({ Icon, ... })`, and the renamed form
  // `{ icon: IconComp }` where the name that ends up in scope is the one on
  // the right of the colon, not the key on the left.
  for (const m of source.matchAll(/\{([^{}]*)\}\s*\)/g)) {
    for (const part of m[1].split(',')) {
      const sides = part.split(':')
      const name = (sides.length > 1 ? sides[1] : sides[0]).split('=')[0].trim()
      if (/^[A-Za-z0-9_$]+$/.test(name)) names.add(name)
    }
  }
  // The same thing one bracket over: `([key, Icon]) => <Icon />`, which is how
  // a table of components gets rendered. Anchored on the arrow so an array
  // literal that merely happens to sit before a `)` puts nothing in scope.
  for (const m of source.matchAll(/\[([^[\]]*)\]\s*\)?\s*=>/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split('=')[0].trim()
      if (/^[A-Za-z0-9_$]+$/.test(name)) names.add(name)
    }
  }
  return names
}

describe('every JSX component reference is in scope', () => {
  const files = ROOTS.flatMap((r) => sourceFiles(r))

  it('finds the source files at all', () => {
    // Without this, a broken walk would make the whole check pass by
    // examining nothing — the failure mode this file exists to prevent.
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(files)('%s', (file) => {
    const source = stripComments(fs.readFileSync(file, 'utf8'))
    const scope = namesInScope(source)
    const undefined_ = [...jsxIdentifiers(source)].filter((name) => !scope.has(name))
    expect(undefined_).toEqual([])
  })
})
