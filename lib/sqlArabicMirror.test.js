import fs from 'fs'
import path from 'path'

// Two files hold one sentence, and that is a shape this project has already
// been burned by twice.
//
// 079a DEPOSITS four Arabic strings into the database — two `comment on`
// statements and two `using hint` sentences. 079b_2 reads them back and
// compares them CHARACTER BY CHARACTER against literals of its own, because a
// survey that merely displays a four-hundred-character Arabic paragraph is not
// a check: the incident the read-back rule exists for was eighteen sentences
// silently TRANSLATED, each of which still contained Arabic and still read
// fluently.
//
// ⚠️ But a comparison against a hand-copied literal has its own failure, and it
// is the worse one: if the expected text drifts, the survey reports 🔴 on a
// database that is correct, and whoever reads it "fixes" the database to match
// the typo. A false ✗ costs time; this one ships a corruption.
//
// ⚠️ And drift between two files holding one thing is not hypothetical here.
// The descendant walk lived in 068a and 068b_3 and diverged inside a SINGLE
// round — the dry run computed a different condition from the guard it existed
// to preview. 069a was written to end that by making one definition. The same
// cure is not available here: the expected value has to be written down
// somewhere for a comparison to mean anything. So the mirror is guarded
// instead, and it is guarded where it is cheap — at `npx jest`, rather than by
// the owner running SQL and reading four red rows.
describe('079b_2 expects exactly the Arabic that 079a deposits', () => {
  const sqlDir = path.join(__dirname, '..', 'docs', 'sql')
  const change = fs.readFileSync(path.join(sqlDir, '079a-live-documents-and-consignment-freeze.sql'), 'utf8')
  const survey = fs.readFileSync(path.join(sqlDir, '079b_2_objects_and_their_arabic.sql'), 'utf8')

  // Arabic strings only. A needle on the Latin identifiers would drift with
  // any rename, and the thing being protected is the text that leaves the
  // repository — not the SQL around it.
  const arabicLiterals = (text) =>
    [...text.matchAll(/'([^']*[؀-ۿ][^']*)'/g)]
      .map((m) => m[1])
      .filter((s) => s.length > 60)

  const deposited = arabicLiterals(change)
  const expected = arabicLiterals(survey)

  it('reads both files rather than passing on an empty scan', () => {
    // ⚠️ A guard that scans nothing reports nothing wrong, and two empty lists
    // compare equal. This is the assertion that makes the next one mean
    // something: four strings are deposited — two comments and two hints.
    expect(deposited).toHaveLength(4)
    expect(expected.length).toBeGreaterThanOrEqual(4)
  })

  it('finds every deposited sentence quoted back in the survey', () => {
    // Set membership rather than order: the survey lists them in its own
    // sequence and may carry other Arabic of its own. What must hold is that
    // nothing 079a ships is missing from what 079b_2 checks.
    const missing = deposited.filter((s) => !expected.includes(s))
    expect(missing.map((s) => s.slice(0, 70) + '…')).toEqual([])
  })

  it('would notice a single character', () => {
    // Counter-evidence on copies, touching nothing — the cheap half of
    // CLAUDE.md's procedure. One character is the realistic drift: a comma
    // added while editing a comment, a تاء مربوطة corrected in one file.
    const before = 'ما بينفع تغيير خانة «منتج أمانة» على منتج تحرّك فعلًا وحركته لسّه قائمة اليوم'
    const after = before.replace('فعلًا', 'فعليًّا')
    expect(arabicLiterals(`x '${before}' y`)).toEqual([before])
    expect(arabicLiterals(`x '${after}' y`).includes(before)).toBe(false)
  })

  it('ignores short Arabic that is not a deposited sentence', () => {
    // The filter is length, not location, so a short Arabic word inside an
    // ordinary SQL literal does not become a thing to mirror. Stated because
    // the number 60 is otherwise unexplained.
    expect(arabicLiterals("select 'نعم' as x")).toEqual([])
  })
})
