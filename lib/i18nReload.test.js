const path = require('path')

// The dev server must reread public/locales on every render.
//
// ⚠️ This guards a single config line, and that is exactly why it exists. The
// line is the whole fix for something that came back six times — a key written
// while the server runs reaching the browser as its own name — and a fix that
// can vanish in a one-line edit without anything failing is a fix on parole.
//
// It is written as BEHAVIOUR, not as a string search of the file: NODE_ENV is
// forced and the config is required, so renaming the variable or inverting the
// condition is caught while reformatting the file is not.
const CONFIG = path.join(__dirname, '..', 'next-i18next.config.js')

function configUnder(nodeEnv) {
  const previous = process.env.NODE_ENV
  jest.resetModules()
  process.env.NODE_ENV = nodeEnv
  try {
    delete require.cache[require.resolve(CONFIG)]
    return require(CONFIG)
  } finally {
    process.env.NODE_ENV = previous
  }
}

describe('locale files are reread while the dev server runs', () => {
  it('reloads on every prerender in development', () => {
    expect(configUnder('development').reloadOnPrerender).toBe(true)
  })

  it('does not pay for it in production, where the files cannot change', () => {
    // Not cosmetic: this would reread every locale file on every request of a
    // live salon, for an edit that is impossible after the build.
    expect(configUnder('production').reloadOnPrerender).toBe(false)
  })

  it('still declares the locale it is pinned to', () => {
    // lib/localePinned.test.js explains why 'ar' and not 'ar-EG' or 'ar-PS':
    // those return Arabic-Indic digits, which the bidi isolate cannot fix.
    const config = configUnder('development')
    expect(config.i18n.defaultLocale).toBe('ar')
    expect(config.i18n.locales).toEqual(['ar'])
  })
})
