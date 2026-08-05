// ⚠️ `reloadOnPrerender` exists to DELETE a rule, not to state it better.
//
// `next-i18next` reads public/locales once at boot. So a key written while the
// dev server runs reaches the browser AS ITS OWN NAME — indistinguishable on
// screen from a key that was never written, which sends you looking in the
// wrong place.
//
// That cost six rounds: written as a rule, then as an action paired with
// another action ("Write on a locale file ⇒ restart immediately"), then into
// CLAUDE.md. It came back every time, and the sixth reached the owner's screen
// rather than mine. Something that survives three wordings is not a memory
// problem. NEXT_BUILD_DIR solved the same class by removing the need to
// remember instead of remembering harder — this is that move again.
//
// WHAT IT ACTUALLY DOES, measured on this server rather than read in the docs:
// serverSideTranslations calls i18n.reloadResources() before each render, and
// the merge is `{ ...old, ...new }` — a SHALLOW spread (i18next.js:1517 passes
// deep = undefined). So:
//
//   add a key, root or nested      →  live, no restart   ✓ measured
//   change a value, root or nested →  live, no restart   ✓ measured
//   delete a NESTED key            →  live, no restart   ✓ measured
//                                     (the parent object is replaced whole)
//   delete a ROOT-LEVEL leaf key   →  SURVIVES until restart   ✗ measured
//
// ⚠️ That last line is a real remaining hole and I had written the opposite
// here before measuring it. It is narrow and it fails in a different, weaker
// way: the symptom is STALE TEXT, never a raw key. Which is the point —
//
//   a raw key on screen can now only mean the key is missing from the file,
//   and lib/translationKeys.test.js fails on exactly that.
//
// Development only. In production the files cannot change after the build, so
// rereading them on every request is cost for a case that cannot happen.
// lib/i18nReload.test.js keeps this line from quietly going away.
module.exports = {
  i18n: {
    defaultLocale: 'ar',
    locales: ['ar'],
  },
  reloadOnPrerender: process.env.NODE_ENV === 'development',
}
