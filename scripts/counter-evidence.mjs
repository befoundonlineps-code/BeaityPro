#!/usr/bin/env node
//
// البيّنة المضادّة — والاسترجاعُ لا يمرّ بنظام الإصدارات إطلاقًا.
//
// 🔴 السببُ حادثةٌ وقعت مرّتين في هذا المشروع، والثانيةُ بعد أن كُتبت القاعدة:
//
//   حُقن عطلٌ متعمَّد في ملفّ، ثمّ أُرجع الملفُّ إلى آخر نسخةٍ مُودَعة —
//   **فمُحي معه إصلاحٌ لم يكن قد أُودع بعد.** المرّةُ الأولى ضاع إصلاحٌ
//   للمخالفة نفسها التي كان الاختبار يفحصها. المرّةُ الثانية ضاع تصديرُ
//   دالّةٍ وحدٌّ كُتبا قبل الحقن بدقائق.
//
// والقاعدةُ المكتوبة كانت «أودِع أوّلًا ← اكسر ← استرجع». **قاعدةٌ تُتذكَّر،
// وقد فشلت مرّتين.** وCLAUDE.md نفسه يقول ما يجب فعله عندئذٍ: «لو كانت لنفسك،
// فأفضل مكان إلها مش نصًّا يُتذكَّر بل إعدادًا أو حارسًا بيمنع الغلط بلا ما حدا
// يتذكّر شي».
//
// ⇒ فالحلُّ ليس تذكُّرًا أفضل، بل **قطعُ الطريق على الأمر الذي محا الشغل**:
// الاسترجاعُ يأتي من نسخةٍ بايتًا ببايت أخذَتها الأداةُ بنفسها، فلا شيء غير
// المحقون يمكن أن يُمسّ — سواءٌ أكان مُودَعًا أم لا.
//
// ⚠️ **ولا يُكتب اسمُ ذلك الأمر في هذا الملفّ**، ولا حتى شرحًا.
// lib/counterEvidencePending.test.js يبحث عن شكله هنا ليمنع عودتَه، وعدّادٌ
// نصّيّ لا يفرّق بين استعمالٍ وشرحٍ يحذّر منه — وهو §2ب من CLAUDE.md: النثرُ
// لا يسمّي المعرِّفَ الذي يمنعه فحصُ ملفّه. **والعلاجُ تغييرُ النثر لا الإبرة**،
// لأن توسيعَ الإبرة لتتجاهل التعليقات يجعلها تتجاهل استعمالًا داخل تعليقٍ
// مُعطَّلٍ يومًا ما.
//
// ═══════════════════════════════════════════════════════════════════════════
// الاستعمال
// ═══════════════════════════════════════════════════════════════════════════
//
//   node scripts/counter-evidence.mjs snapshot lib/a.js lib/b.js
//   … احقن ما شئت، وشغّل ما شئت …
//   node scripts/counter-evidence.mjs restore
//
//   node scripts/counter-evidence.mjs status     ← ما المعلَّق الآن
//
// ⚠️ و`snapshot` يرفض أن يبدأ وهناك نسخةٌ معلَّقة، و`restore` يتحقّق من تطابق
// البايتات بعد الإرجاع — لأن استرجاعًا يفشل بصمتٍ أسوأ من عدم الاسترجاع.
//
// ⚠️ ونسخةٌ معلَّقةٌ منسيّة **تُسقط الحزمة**:
// lib/counterEvidencePending.test.js يقرأ نفس المجلّد. فالحقنُ الذي يُنسى في
// مكانه لا يمكن أن يُودَع — وهو الفشلُ الثاني من نفس العائلة، مسدودًا قبل أن
// يقع مرّةً أولى.
//
// 🔴 **ومداها ليس الحقنَ وحدَه — بل كلَّ أمرٍ يقدر يعيد كتابة شجرة العمل.**
//
// وقعت ثالثةٌ من نفس العائلة **بعد بناء هذه الأداة**: أُودع إيداعُ تجربةٍ
// لقياس الخطّاف، ثمّ تُراجع عنه بأمرٍ يعيد الشجرة إلى الإيداع السابق — **فمُحيت
// معه ثلاثةُ ملفّاتٍ مُعدَّلةٍ ولم تكن مودَعة.** الأداةُ كانت جاهزةً بالمستودع
// ولم تُستعمل، لأنها كانت تُقرأ «أداةَ حقن» لا «أداةَ حفظٍ قبل الخطر».
//
// ⇒ فالقاعدة: `snapshot` **قبل أيّ أمرٍ يقدر يرجّع الشجرة**، لا قبل الحقن
// فقط. الكلفةُ ثانيةٌ واحدة، والبديلُ شغلُ ساعةٍ لا سبيل إلى استرداده.
//
// ⚠️ ويصرخ إن كان خطّافُ الإيداع غيرَ موصولٍ بهذه البيئة (`hooksPathWarning`
// تحت). وموضعُ الصراخ مقصود: **لحظةَ أخذِ النسخة**، أي قبل الخطر بلحظة — لا
// عند الإيداع، حيث يكون الخطّافُ الغائبُ قد فاته دورُه أصلًا.
//
// ⚠️ **ويصرخ ولا يرفض، وذلك قرارٌ لا تهاون:** عملُ هذه الأداة حفظُ البايتات،
// ورفضُها أن تحفظها لأن إعدادًا لا يخصّها غيرُ مضبوط يدفع صاحبَها إلى العمل
// **بلا نسخةٍ أصلًا** — وهي بالضبط الحادثةُ التي بُنيت لأجلها. الرفضُ هنا
// يشتري طبقةً ويخسر الطبقةَ الأصل.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const SNAPSHOT_DIR = path.join(ROOT, '.counter-evidence')
const MANIFEST = path.join(SNAPSHOT_DIR, 'manifest.json')

// مجلّدُ خطّافات الإيداع — مكتوبٌ هنا مرّةً واحدة، و`npm run setup-hooks`
// يوجّه إليه. اسمان لمجلّدٍ واحدٍ هما الخطأُ الذي يجعل الصراخَ يقول «غيرُ
// موصول» عن بيئةٍ موصولة، والحارسُ يقابل الاثنين.
export const HOOKS_DIR = '.githooks'

const die = (message) => { console.error('✗ ' + message); process.exit(1) }

// هل خطّافُ الإيداع موصولٌ بهذه البيئة؟ يُقرأ إعدادُ المستودع كملفّ نصّيّ،
// بلا تشغيل أيّ أمرٍ خارجيّ — الأداةُ كلُّها لا تُشغّل شيئًا، وذلك محروسٌ
// باختبار.
//
// ⚠️ ويرجع تحذيرًا عند العجز عن القراءة كما يرجعه عند الغياب، ولا يسكت:
// «ما قدرتُ أفحص» و«مفحوصٌ وسليم» جوابان مختلفان، وخلطُهما هو §1ج بعينه.
function hooksPathWarning() {
  const config = path.join(ROOT, '.git', 'config')
  if (!fs.existsSync(config)) {
    return 'ما قدرتُ أقرأ إعدادات المستودع، فما بعرف إذا خطّافُ الإيداع موصول.'
  }
  const found = /^\s*hookspath\s*=\s*(.+?)\s*$/im.exec(fs.readFileSync(config, 'utf8'))
  if (found && found[1] === HOOKS_DIR) return null
  return found
    ? `خطّافُ الإيداع موجَّهٌ إلى «${found[1]}» لا إلى «${HOOKS_DIR}».`
    : 'خطّافُ الإيداع مش موصولٍ بهذه البيئة، فالإيداعُ بحقنٍ معلَّقٍ ما بينمنع.'
}

function readManifest() {
  if (!fs.existsSync(MANIFEST)) return null
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
}

function snapshot(files) {
  if (!files.length) die('snapshot يحتاج ملفًّا واحدًا على الأقلّ')
  const pending = readManifest()
  if (pending) {
    die(`في نسخةٌ معلَّقةٌ من قبل (${pending.files.length} ملفًّا). شغّل restore أوّلًا.`)
  }

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const entries = files.map((rel, i) => {
    const abs = path.resolve(ROOT, rel)
    if (!fs.existsSync(abs)) die(`ما في ملفّ اسمه ${rel}`)
    // ⚠️ يُنسخ بايتًا ببايت — لا قراءةً نصّيّةً وإعادةَ كتابة. ملفّاتُ هذا
    // المستودع تُخزَّن بنهايات سطور CRLF، وأيُّ دورةِ قراءةٍ/كتابةٍ نصّيّة قد
    // تُعيدها LF فيبدو الملفُّ «مُعادًا» وهو مُغيَّرٌ في كلّ سطر.
    const bak = path.join(SNAPSHOT_DIR, `${i}-${path.basename(rel)}.bak`)
    fs.copyFileSync(abs, bak)
    return { rel, abs, bak, bytes: fs.statSync(abs).size }
  })

  fs.writeFileSync(MANIFEST, JSON.stringify({ takenAt: new Date().toISOString(), files: entries }, null, 2))
  console.log(`✓ انحفظت ${entries.length} نسخة:`)
  for (const e of entries) console.log(`    ${e.rel}  (${e.bytes} بايت)`)
  console.log('  احقن الآن. وللإرجاع: node scripts/counter-evidence.mjs restore')

  // آخرُ سطرٍ يُقرأ، لأنه الوحيدُ الذي يحتاج فعلًا الآن.
  const warning = hooksPathWarning()
  if (warning) {
    console.log('')
    console.log('⚠️ ' + warning)
    console.log('   شغّل مرّةً واحدةً بهذه البيئة:  npm run setup-hooks')
  }
}

function restore() {
  const manifest = readManifest()
  if (!manifest) die('ما في نسخةٌ معلَّقة — ما في شي يُرجَّع')

  const failures = []
  for (const e of manifest.files) {
    fs.copyFileSync(e.bak, e.abs)
    // 🔴 يُتحقَّق من التطابق بعد النسخ، لا يُفترض. استرجاعٌ يفشل بصمتٍ يترك
    // الحقنَ في مكانه بينما التقريرُ يقول «انرجّع» — وهي أسوأُ من عدم
    // الاسترجاع، لأن الخطوةَ التالية تُبنى على شجرةٍ يظنّها القارئ نظيفة.
    const a = fs.readFileSync(e.abs)
    const b = fs.readFileSync(e.bak)
    if (!a.equals(b)) failures.push(e.rel)
  }
  if (failures.length) die('الإرجاعُ ما طابق: ' + failures.join(', '))

  fs.rmSync(SNAPSHOT_DIR, { recursive: true, force: true })
  console.log(`✓ رجعت ${manifest.files.length} ملفًّا، مطابقةً بايتًا ببايت`)
  console.log('  ⚠️ وشغّل الحزمة كاملة الآن — «Tests: 1 failed» وحدها كانت تمرّ.')
}

function status() {
  const manifest = readManifest()
  if (!manifest) { console.log('✓ ما في نسخةٌ معلَّقة'); return }
  console.log(`⚠️ نسخةٌ معلَّقةٌ منذ ${manifest.takenAt}:`)
  for (const e of manifest.files) console.log(`    ${e.rel}`)
}

// 🔴 التخلّي عن النسخة **بلا استرجاع** — وهذا الأمرُ غاب فوقعت الحالةُ التي
// وُجد لأجلها.
//
// ⚠️ **رسالةُ الحارس نفسُها كانت تقول «شغّل restore»**، وقد تُقرأ بعد ساعةٍ من
// الشغل على نفس الملفّ — **وعندها `restore` يمحو الشغلَ لا الحقن.** صار فعلًا:
// نسخةٌ أُخذت لقياس حقنةٍ صغيرة، ثمّ كُتب فوق الملفّ خمسُمئة سطرٍ جديدة، ثمّ
// سقطت الحزمةُ على «نسخةٌ معلَّقة» **وطريقُ الخروج الوحيدُ المعروضُ كان الأمرَ
// المدمِّر**.
//
// **والفرقُ بين الأمرين سؤالٌ واحدٌ يُسأل قبلهما:** هل الملفُّ الآن يحمل الحقنَ
// (⟵ `restore`) أم عملًا جديدًا (⟵ `discard`)؟ فالأداةُ تعرض الاثنين بدل أن
// تعرض واحدًا وتترك الثاني لِمن يعرف أن يحذف المجلّدَ بيده.
function discard() {
  const manifest = readManifest()
  if (!manifest) { console.log('✓ ما في نسخةٌ معلَّقة'); return }
  fs.rmSync(SNAPSHOT_DIR, { recursive: true, force: true })
  console.log('✓ انشالت النسخة بلا استرجاع — الملفّات متل ما هي الآن:')
  for (const e of manifest.files) console.log(`    ${e.rel}`)
}

const [command, ...rest] = process.argv.slice(2)
if (command === 'snapshot') snapshot(rest)
else if (command === 'restore') restore()
else if (command === 'discard') discard()
else if (command === 'status') status()
else die('الأوامر: snapshot <files…> | restore | discard | status')
