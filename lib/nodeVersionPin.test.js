/**
 * 🔴 **نسخةُ Node — الحارسُ الذي كان غيابُه أربعين تشغيلًا أحمر.**
 *
 * الـCI سقطت في **٤٠ تشغيلًا من ٤٠**، من أوّل تشغيلٍ لها، **والرسالةُ لم تكن
 * تقول «نسخةُ Node»**: كانت `npx jest --ci ⟵ exit 1`. والسببُ الحقيقيّ:
 *
 * ```
 * @supabase/supabase-js@2.110.8 · engines: { node: '>=22.0.0' }
 * «Node.js detected but native WebSocket not found … Node.js 22+»
 * ```
 *
 * و`createClient` تنادي `WebSocketFactory` **في المُنشئ**، فـ
 * `lib/supabaseClient.js` يرمي **وقتَ التحميل** — و٦٣ ملفًّا يستوردونه.
 *
 * ⚠️ **ولم يظهر محلّيًّا** لأن الجهازَ كان على v24 بينما `ci.yml` تثبّت `20`
 * بيد. **والمخاطرةُ كانت مكتوبةً في ترويسة `ci.yml` نفسِها** ثمّ شُحنت —
 * **فالإعلانُ عن مخاطرةٍ ليس تخفيفًا لها.**
 *
 * ⇒ **وهذا الحارسُ لا يعدّ ممنوعًا، يصف شكلًا:** كلُّ `engines.node` مثبَّتةٍ
 * في الشجرة تُسأل عن النسخة المعلَنة. **فحزمةٌ تطلب ٢٤ غدًا تُسقط الحزمةَ
 * باسمها، لا بعد أربعين تشغيلًا غامضًا.**
 *
 * ⚠️ **و`semver` مستعارةٌ من الشجرة لا معلَنةٌ اعتماديّةً** — فتُجرَّب قبل أن
 * تُصدَّق (الفحصُ الأوّل)، **وغيابُها يُسقط الملفَّ لا يُمرّره.**
 */

const fs = require('fs')
const path = require('path')
const semver = require('semver')

const ROOT = path.join(__dirname, '..')

// ⚠️ **الحدُّ الأدنى داخل المجال قد يفوق `X.0.0`** — والمستثنى بأسبابه، لا
// بصمت. **يفشل مغلقًا: حزمةٌ جديدةٌ ترفع الأرضيّة تُسقط الفحصَ فينظر إنسانٌ
// مرّة.** و`.nvmrc` تُقرأ «أحدثَ ٢٢» عند nvm وsetup-node معًا، **فالأرضيّةُ
// مستوفاةٌ عمليًّا — والذي لا يفرضها هو `engines.node: "22.x"` وحدَها.**
const FLOOR_ABOVE_ZERO = {
  'validate-npm-package-name': '^20.17.0 || >=22.9.0 — تطلب 22.9 لا 22.0',
  // 🔴 **هذه وجدها الحارسُ نفسُه، ولم يجدها المسحُ اليدويُّ قبله** — لأنها
  // نسخةٌ **متداخلة**، والمسحُ كان يقرأ المستوى الأعلى وحدَه.
  // ⇒ **فأرضيّةُ المجال الحقيقيّةُ `22.13.0` لا `22.9.0`.**
  'eslint-visitor-keys': '^20.19.0 || ^22.13.0 || >=24 — تطلب 22.13 لا 22.0',
}

/** يمشي الشجرةَ كلَّها بما فيها `node_modules` المتداخلة. */
function installedEngines() {
  const out = []
  let nestedDirs = 0
  const walk = (dir, depth) => {
    if (depth > 4) return
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const names = entry.name.startsWith('@')
        ? fs.readdirSync(path.join(dir, entry.name)).map((s) => `${entry.name}/${s}`)
        : [entry.name]
      for (const name of names) {
        const pkgDir = path.join(dir, name)
        const manifest = path.join(pkgDir, 'package.json')
        if (fs.existsSync(manifest)) {
          let json = null
          try { json = JSON.parse(fs.readFileSync(manifest, 'utf8')) } catch { json = null }
          const range = json && json.engines && json.engines.node
          if (range) out.push({ name, version: json.version, range, depth })
        }
        const nested = path.join(pkgDir, 'node_modules')
        if (fs.existsSync(nested)) { nestedDirs += 1; walk(nested, depth + 1) }
      }
    }
  }
  walk(path.join(ROOT, 'node_modules'), 0)
  return { packages: out, nestedDirs }
}

function rejectedBy(version, packages) {
  return packages.filter((p) => {
    // ⚠️ **مدًى لا يُحلَّل يُعدّ رفضًا** — فالجهلُ لا يمرّ صامتًا.
    try { return !semver.satisfies(version, p.range, { includePrerelease: true }) } catch { return true }
  })
}

const pinned = fs.readFileSync(path.join(ROOT, '.nvmrc'), 'utf8').trim()
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8')
const { packages, nestedDirs } = installedEngines()
const major = semver.coerce(pinned).major

describe('نسخةُ Node مثبَّتةٌ في موضعٍ واحد وتُرضي الشجرةَ كلَّها', () => {
  // ① **الأداةُ تُجرَّب قبل أن تُصدَّق** — بيّنةٌ مضادّةٌ داخل الحارس نفسِه.
  test('semver تحكم في الاتّجاهين قبل الاعتماد عليها', () => {
    expect([
      `22 ⟵ >=22.0.0 : ${semver.satisfies('22.0.0', '>=22.0.0')}`,
      `20 ⟵ >=22.0.0 : ${semver.satisfies('20.19.0', '>=22.0.0')}`,
    ].join(' · ')).toBe('22 ⟵ >=22.0.0 : true · 20 ⟵ >=22.0.0 : false')
  })

  // ② **الموضعان يعلنان نفسَ المجال** — `.nvmrc` لـnvm وللـCI،
  // و`engines.node` لـVercel ولـnpm.
  test('.nvmrc و engines.node يعلنان نفسَ المجال الرئيس', () => {
    const declared = pkg.engines && pkg.engines.node
    expect(`engines.node = ${declared}`).not.toBe('engines.node = undefined')
    expect(`.nvmrc=${major} · engines=${semver.minVersion(declared).major}`)
      .toBe(`.nvmrc=${major} · engines=${major}`)
  })

  // ③ **ولا رقمَ ثالثًا في `ci.yml`** — وهو الرقمُ الذي أوقع العطلَ أصلًا.
  test('ci.yml تقرأ .nvmrc ولا تكتب رقمًا', () => {
    expect(`node-version-file: ${workflow.includes("node-version-file: '.nvmrc'")}`)
      .toBe('node-version-file: true')
    const literal = workflow.match(/^\s*node-version:\s*.+$/m)
    expect(`رقمٌ مكتوبٌ بيد: ${literal ? literal[0].trim() : 'لا'}`).toBe('رقمٌ مكتوبٌ بيد: لا')
  })

  // ④ **مدى الحارس يُقاس منفصلًا عن حكمه** — مشيةٌ لا تبلغ شيئًا تمرّ خضراء.
  test('المشيةُ تبلغ الشجرةَ كلَّها وتسمّي ما تعرفه', () => {
    const names = new Set(packages.map((p) => p.name))
    expect([
      `حزمٌ تعلن engines ≥ 400 : ${packages.length >= 400}`,
      `مجلّداتٌ متداخلةٌ مقروءة : ${nestedDirs > 0}`,
      `عمقٌ أكبرُ من صفر : ${packages.some((p) => p.depth > 0)}`,
      `@supabase/supabase-js : ${names.has('@supabase/supabase-js')}`,
      `jest : ${names.has('jest')}`,
    ].join(' · ')).toBe([
      'حزمٌ تعلن engines ≥ 400 : true',
      'مجلّداتٌ متداخلةٌ مقروءة : true',
      'عمقٌ أكبرُ من صفر : true',
      '@supabase/supabase-js : true',
      'jest : true',
    ].join(' · '))
  })

  // ⑤ **أعلى المجال المعلَن يُرضي الجميعَ بلا استثناء** — وهذا ما يسقط يومَ
  // تطلب حزمةٌ مجالًا أعلى.
  test('أحدثُ نسخةٍ في المجال المعلَن تُرضي كلَّ engines.node', () => {
    const rejected = rejectedBy(`${major}.999.999`, packages)
    expect(rejected.map((p) => `${p.name}@${p.version} ⟵ ${p.range}`).join('\n') || 'لا شيء')
      .toBe('لا شيء')
  })

  // ⑥ **وأدنى المجال يُرضيهم إلّا المسمَّين** — فأرضيّةُ `engines.node: "X.x"`
  // مكشوفةٌ لا مخفيّة.
  test('أدنى المجال المعلَن يُرضيهم إلّا المستثنى بأسبابه', () => {
    const rejected = rejectedBy(`${major}.0.0`, packages)
      .filter((p) => !FLOOR_ABOVE_ZERO[p.name])
    expect(rejected.map((p) => `${p.name}@${p.version} ⟵ ${p.range}`).join('\n') || 'لا شيء')
      .toBe('لا شيء')
  })

  // ⑦ **والنسخةُ التي تشغّل هذه الحزمةَ الآن** — هذا وحدَه كان يكفي لإسقاط
  // التشغيلات الأربعين برسالةٍ مسمّاة.
  test('النسخةُ التي تشغّل الفحوصَ الآن تُرضي كلَّ engines.node', () => {
    const running = process.version.replace(/^v/, '')
    const rejected = rejectedBy(running, packages)
    expect(`${running} ⟵ ${rejected.map((p) => `${p.name} (${p.range})`).join(' · ') || 'لا رافض'}`)
      .toBe(`${running} ⟵ لا رافض`)
  })
})
