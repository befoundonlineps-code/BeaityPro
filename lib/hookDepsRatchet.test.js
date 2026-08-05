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

async function currentWarnings() {
  const eslint = new ESLint({ cwd: ROOT })
  const results = await eslint.lintFiles(['components', 'pages', 'hooks', 'lib'])
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
    const results = await eslint.lintFiles(['components', 'pages', 'hooks', 'lib'])
    const errors = results.flatMap((r) => r.messages.filter((m) => m.severity === 2))
      .map((m) => `${m.ruleId}: ${m.message}`)
    expect(errors).toEqual([])
  })
})
