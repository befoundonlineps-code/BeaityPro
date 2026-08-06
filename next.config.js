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
}

module.exports = nextConfig
