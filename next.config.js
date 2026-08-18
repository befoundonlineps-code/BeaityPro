const { i18n } = require('./next-i18next.config')

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n,
  // ⚠️ `next build` writes into the same .next the dev server is serving from,
  // so running one while the other is up leaves the server hunting for chunks
  // the build replaced — every route 500s with "Cannot find module
  // './chunks/vendor-chunks/next.js'". That happened.
  //
  // The first answer was a rule — "do not build while the server is running" —
  // written for the owner, who never runs a build. The only person who runs one
  // is whoever is working on the code, so the rule was addressed to somebody
  // who would never read it. Same fault as a header describing an inventory or
  // a guard listing names: right rule, wrong reader.
  //
  // A separate directory needs nobody to remember anything:
  //
  //   NEXT_BUILD_DIR=.next-check npx next build
  //
  // Unset it is the ordinary .next, so a real deployment build is unchanged.
  distDir: process.env.NEXT_BUILD_DIR || '.next',

  // ⚠️ THE GATE WAS BLIND TO A WHOLE DIRECTORY. Item 32 installed ESLint so
  // that `next build` would fail on a conditional hook instead of compiling it
  // happily — and `next lint` only ever read Next's defaults (app, pages,
  // components, lib, src). `hooks/` is not among them, so every file in the one
  // directory named after hooks was outside the guard that exists for hooks.
  //
  // Measured, not reasoned: `next lint` reported 13 warnings while
  // lib/hookDepsRatchet.test.js counted 14 over the same tree. The missing one
  // is hooks/useAppointments.js, and it had been invisible to the build since
  // the gate was installed.
  //
  // Same shape as translationKeys being limited by folder and the guard that
  // matched variable names: the rule was right and its reach was not.
  eslint: { dirs: ['app', 'pages', 'components', 'lib', 'hooks'] },

  // 🔴 بلا هذا، **التطبيقُ الحيُّ يعرض مفاتيحَ الترجمة الخامّة بدل الكلمات** —
  // `sections.employees` و`appName` وعشراتٍ غيرها، على كلّ صفحة.
  //
  // ⚠️ **والعطلُ لا يظهر محلّيًّا إطلاقًا**، ولهذا عاش من أوّل نشرةٍ ولم يُرَ:
  // `next dev` و`next start` يقرآن من الشجرة نفسِها، **والدالّةُ الخادمةُ على
  // Vercel تُحزَم وحدَها.**
  //
  // **والآليّةُ مقيسةٌ لا مرجَّحة، بثلاثة قياسات:**
  //
  //   ١. الصفحةُ الحيّةُ تشحن `initialI18nStore` بالنطاقات الستّة **وكلُّها
  //      صفرُ مفاتيح** — فالدالّةُ عملت ولم تقرأ شيئًا.
  //   ٢. `https://…/locales/ar/products.json` يردّ **200 بـ69901 بايت** —
  //      فالملفّاتُ مرفوعةٌ ومخدومةٌ من الـCDN.
  //   ٣. `products.js.nft.json` بعد البناء **صفرُ ذكرٍ لـ`locales`** — فهي
  //      ليست في حزمة الدالّة.
  //
  //   ⇒ مرفوعةٌ أصولًا ساكنة، وغائبةٌ عن نظام ملفّات الدالّة. و
  //   `serverSideTranslations` تقرأ بـ`fs` من `process.cwd()/public/locales`
  //   **وقتَ الطلب**، لأن الصفحاتِ السبعَ كلَّها `getServerSideProps` ولا
  //   `getStaticProps` فيها واحدة — **فلا شيءَ يُخبز وقتَ البناء.**
  //
  // ⚠️ **وتتبّعُ الملفّات لا يستطيع اكتشافَها بنفسه:** `next-i18next` يقرأ
  // بمسارٍ مبنيٍّ وقتَ التشغيل، والتتبّعُ ساكنٌ يقرأ `require` الظاهرة. **فما
  // لا يُذكر صراحةً لا يُحزَم**، ولا شيءَ يشتكي — لا في البناء ولا في السجلّ.
  //
  // 🔴 **وهذا ليس من دمج اليوم:** `login.json` و`topBar.json` فارغتان في
  // المتجر كذلك، ولم يمسّهما شيءٌ منذ ٢٨ تمّوز. **العطلُ من أوّل نشرة، وأوّلُ
  // مَن فتح الرابطَ الحيَّ رآه.**
  //
  // و`experimental` هو موضعُه في Next 14 (صار جذريًّا في 15).
  experimental: {
    outputFileTracingIncludes: {
      '/**': ['./public/locales/**/*.json'],
    },
  },
}

module.exports = nextConfig
