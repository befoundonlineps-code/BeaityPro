const fs = require('fs')
const path = require('path')

// 🔴 حقنٌ مُعلَّقٌ لا يمكن أن يُودَع.
//
// `scripts/counter-evidence.mjs` يحفظ نسخةً قبل الحقن ويحذفها عند الإرجاع.
// فوجودُ النسخة معناه **أن هناك عطلًا متعمَّدًا في شجرة العمل الآن** — وهذا
// الملفّ يُسقط الحزمة عليه.
//
// ⚠️ وهو النصفُ الثاني من الحادثة التي بنت الأداة. النصفُ الأوّل — `git
// checkout` يمحو ما لم يُودَع — عولج بإزالة `git` من طريق الاسترجاع أصلًا.
// وهذا النصف — أن يُنسى الحقنُ في مكانه ويُودَع معه — **لم يقع بعد**، ويُسدّ
// قبل أن يقع لأنه من نفس العائلة تمامًا: خطوةٌ يدويّةٌ تُتذكَّر.
//
// والفرقُ بين الاثنين يستحقّ أن يُقال: الأوّل حارسٌ كشف علّةً وقعت مرّتين،
// والثاني حارسٌ لحالةٍ قادمة. **وخلطُهما يجعل الملفّ يبدو أثقل مما هو.**
const ROOT = path.join(__dirname, '..')
const SNAPSHOT_DIR = path.join(ROOT, '.counter-evidence')
const SCRIPT = path.join(ROOT, 'scripts', 'counter-evidence.mjs')

describe('no counter-evidence injection is left in the tree', () => {
  it('has no pending snapshot', () => {
    const pending = fs.existsSync(path.join(SNAPSHOT_DIR, 'manifest.json'))
    if (pending) {
      const manifest = JSON.parse(fs.readFileSync(path.join(SNAPSHOT_DIR, 'manifest.json'), 'utf8'))
      // The message names the files, because a failure that says only «pending»
      // sends somebody hunting for what they broke.
      throw new Error(
        'حقنٌ معلَّقٌ منذ ' + manifest.takenAt + ' على: '
        + manifest.files.map((f) => f.rel).join(', ')
        + ' — شغّل: node scripts/counter-evidence.mjs restore'
      )
    }
    expect(pending).toBe(false)
  })
})

describe('the tool that replaced `git checkout` is still there', () => {
  const source = fs.readFileSync(SCRIPT, 'utf8')

  it('exists and offers the three commands', () => {
    // ⚠️ A guard for a WORKFLOW, so what it can check is that the workflow's
    // tool has not quietly gone. The rule it enforces lives in CLAUDE.md and
    // points here by name.
    for (const command of ['snapshot', 'restore', 'status']) {
      expect(source).toContain(`command === '${command}'`)
    }
  })

  it('restores from its own copy rather than from git', () => {
    // 🔴 THE ONE PROPERTY THE WHOLE THING EXISTS FOR. A «tidy-up» that swapped
    // the copy for `git checkout` would restore the file just as well in the
    // happy case and destroy uncommitted work in exactly the case this was
    // written after — twice.
    expect(source).toContain('fs.copyFileSync(e.bak, e.abs)')
    expect(source).not.toMatch(/git\s+checkout/)
    expect(source).not.toMatch(/execSync|spawnSync|child_process/)
  })

  it('verifies the bytes after restoring rather than assuming', () => {
    // A restore that fails silently leaves the injection in place while the
    // report says «restored» — worse than not restoring, because the next step
    // is built on a tree the reader believes is clean.
    expect(source).toContain('a.equals(b)')
  })

  it('refuses to start a second snapshot over a pending one', () => {
    // Otherwise the second snapshot captures the INJECTED file as the baseline,
    // and «restore» writes the injection back permanently.
    expect(source).toMatch(/if \(pending\)/)
  })
})

describe('CLAUDE.md sends the reader to the tool, not to git checkout', () => {
  const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8')

  it('names the script where the procedure is written down', () => {
    // ⚠️ The rule and the tool have to be one thing. A rule that still reads
    // «commit first, then git checkout» beside a tool that exists is two
    // procedures, and the next reader picks the one they remember.
    expect(claude).toContain('scripts/counter-evidence.mjs')
  })
})
