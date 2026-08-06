const fs = require('fs')
const path = require('path')
const { ESLint } = require('eslint')

// react-hooks/exhaustive-deps is the only guard in this project that does not
// bite.
//
// ⚠️ Six guards fail the build or the suite — pagesParse, translationKeys,
// arabicCounts, oneErrorEntryPoint, i18nReload, uiPrimitivesHaveNoWords. This
// rule prints a line and the build succeeds. And it guards the SILENT class:
// a stale closure reads a value that died, produces a plausible wrong answer,
// and nothing crashes.
//
// Fourteen warnings today are forty in six months, and then nobody reads them —
// a number that grows without preventing anything becomes visual background.
// That is the same fault as the header comment which "was true the day it was
// written", wearing output instead of a comment.
//
// So this does not fix them and does not fail on them. It fixes their COUNT.
//
//   Every new exhaustive-deps warning is either fixed, or disabled with a line
//   saying why:
//     // eslint-disable-next-line react-hooks/exhaustive-deps — القيمة مقصودة ثابتة عند التركيب
//   A commented disable is not an escape. It converts "nobody knows which of
//   these is deliberate" into "all of them are, and the reason is written" —
//   exactly what was done for the one react/jsx-key false positive.
//
//   ⚠️ WHEN THIS REACHES ZERO, RAISE THE RULE TO "error" IN .eslintrc.json —
//   and not before, or the build breaks on something nobody has decided yet.
//
// The baseline is a MAP, not a total: fixing one warning while adding another
// elsewhere would cancel out in a total and slip through. Any change to this
// map fails, and somebody looks once.
const BASELINE = {
  'components/AppointmentCalendar.js': 1,
  'components/AppointmentFormDialog.js': 1,
  'components/ClientFilesTab.js': 1,
  'components/ClientForm.js': 2,
  'components/ClientQuickViewDialog.js': 2,
  'components/ClientRelationships.js': 1,
  'components/ClientsApp.js': 1,
  'components/ProfessionalShiftsDialog.js': 1,
  'components/RescheduleConfirmDialog.js': 1,
  'hooks/useAppointments.js': 1,
  'pages/clients/[id].js': 2,
}

const ROOT = path.join(__dirname, '..')

// ⚠️ THE DIRECTORIES THE BUILD'S GATE READS, taken from next.config.js rather
// than written out again here. They were written out again here, and they
// disagreed: this file linted `hooks` and `next lint` did not, so a warning
// counted by the ratchet was invisible to `next build` — and so would a
// rules-of-hooks ERROR have been, in the one directory named after hooks.
//
// Reading the config makes the disagreement impossible rather than unlikely: a
// directory dropped from the gate drops out of the ratchet in the same edit,
// and the count moves, and the baseline below says so.
const CONFIG_DIRS = require('../next.config').eslint.dirs

// `next lint` skips a configured directory that does not exist; ESLint's own
// API throws on a pattern matching nothing. 'app' is listed in the gate for the
// day this project grows one — filtered here rather than dropped from there,
// because a directory absent today is exactly the one that arrives ungated.
const LINT_DIRS = CONFIG_DIRS.filter((dir) => fs.existsSync(path.join(ROOT, dir)))

async function currentWarnings() {
  const eslint = new ESLint({ cwd: ROOT })
  const results = await eslint.lintFiles(LINT_DIRS)
  const tally = {}
  for (const result of results) {
    for (const message of result.messages) {
      if (message.ruleId !== 'react-hooks/exhaustive-deps') continue
      const relative = path.relative(ROOT, result.filePath).split(path.sep).join('/')
      tally[relative] = (tally[relative] || 0) + 1
    }
  }
  return tally
}

describe('the hook-dependency warnings do not grow', () => {
  // Linting the whole tree takes about ten seconds.
  jest.setTimeout(120000)

  it('matches the recorded baseline exactly', async () => {
    // Failing because a warning was FIXED is the good direction: lower the
    // number here in the same commit, and when the object is empty raise the
    // rule to "error".
    expect(await currentWarnings()).toEqual(BASELINE)
  })

  it('reports zero errors, which is what actually stops the build', async () => {
    // The ratchet is about warnings; errors are already fatal at next build.
    // If this ever fails, the build is broken too.
    const eslint = new ESLint({ cwd: ROOT })
    // The same LINT_DIRS as above, and not the list written out again: this
    // test asserting "zero errors" over a narrower tree than the build reads
    // would be the original fault with a cheerier result.
    const results = await eslint.lintFiles(LINT_DIRS)
    const errors = results.flatMap((r) => r.messages.filter((m) => m.severity === 2))
      .map((m) => `${m.ruleId}: ${m.message}`)
    expect(errors).toEqual([])
  })
})

describe('the gate reads every directory that has hooks in it', () => {
  // ⚠️ THE RULE THAT WOULD HAVE FOUND THIS, written after it was found the slow
  // way — by noticing `next lint` said 13 while this file counted 14.
  //
  // Item 32 installed ESLint so `next build` would fail on a conditional hook.
  // But `next lint` read Next's defaults (app, pages, components, lib, src) and
  // `hooks/` is not among them, so twenty-six files in the directory named
  // after hooks sat outside the guard that exists for hooks — not only for
  // warnings: a rules-of-hooks ERROR there would have compiled clean.
  //
  // Counting the warnings could never have caught it. A directory nobody lints
  // contributes zero warnings, which looks exactly like a directory with none.
  it('lists every top-level directory whose files call a hook', () => {
    const skip = new Set(['node_modules', '.next', '.next-check', '.git', 'public', 'docs'])
    const holdsHooks = fs.readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !skip.has(entry.name))
      .filter((entry) => filesUnder(path.join(ROOT, entry.name))
        .some((file) => /\buse[A-Z]\w*\(/.test(fs.readFileSync(file, 'utf8'))))
      .map((entry) => entry.name)

    expect(holdsHooks.length).toBeGreaterThan(0)
    for (const dir of holdsHooks) expect(CONFIG_DIRS).toContain(dir)
  })
})

function filesUnder(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return filesUnder(full)
    return entry.name.endsWith('.js') || entry.name.endsWith('.jsx') ? [full] : []
  })
}
