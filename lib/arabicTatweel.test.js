const fs = require('fs')
const path = require('path')

// U+0640 ARABIC TATWEEL in a UI string must be deliberate.
//
// ⚠️ Found on a real screen, not by reading: the quantity line was shipping
// "بالـ{{unit}}" and drew as بالـعبوة — a visible kashida in the middle of a
// word whose correct spelling is بالعبوة. It was on every quantity line in the
// module, and it survived a screenshot review because a stretched letter reads
// as a font quirk rather than as a defect.
//
// The tatweel is a SOURCE-FILE habit that leaks into the product: writing
// "بال{{unit}}" in a JSON editor shows the ل detached from a Latin "{{", so a
// tatweel makes the source look right and makes the render wrong.
//
// It is genuinely correct in one shape — a prefix before something that is NOT
// an Arabic word: a name, a number, or a quoted literal. لـ"طقم" and لـ11:29
// are right; بالـعبوة is not. That distinction cannot be read off the string,
// because it depends on what the placeholder will hold.
//
// So this list is of what is ALLOWED, which fails CLOSED (CLAUDE.md): a new
// tatweel is caught, somebody looks at it once, and either deletes it or adds
// a line here with its reason. A list of what is forbidden would fail open.
const LOCALES = path.join(__dirname, '..', 'public', 'locales', 'ar')
const TATWEEL = 'ـ'

const ALLOWED = {
  // "من {{from}} لـ{{to}}" — from/to are times in Latin digits (10:44).
  'appointments:actionsDialog.confirmEffect': 'prefix before Latin digits',
  // "لـ{{name}}" — an employee's name, which may itself start detached.
  'appointments:adjustDialog.conflictError': 'prefix before an interpolated name',
  // لـ"طقم" — prefix before a quotation mark, not before a letter.
  'products:productDialog.dropComponentsConfirm': 'prefix before a quoted literal',
  'products:storageDialog.ownerRequiredError': 'prefix before a quoted literal',
  'products:storageDialog.dropResponsiblesConfirm': 'prefix before a quoted literal',
}

function walk(node, prefix, out) {
  for (const [key, value] of Object.entries(node)) {
    const at = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object') walk(value, at, out)
    else if (typeof value === 'string' && value.includes(TATWEEL)) out.push({ at, value })
  }
  return out
}

describe('every tatweel in a locale file is deliberate', () => {
  const files = fs.readdirSync(LOCALES).filter((f) => f.endsWith('.json'))

  it('reads the dictionaries', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('allows only the prefixes that sit before a name, a number or a quote', () => {
    const unexpected = []
    for (const file of files) {
      const ns = file.replace('.json', '')
      const dictionary = JSON.parse(fs.readFileSync(path.join(LOCALES, file), 'utf8'))
      for (const { at, value } of walk(dictionary, '', [])) {
        if (!ALLOWED[`${ns}:${at}`]) unexpected.push(`${ns}:${at} → ${value}`)
      }
    }
    expect(unexpected).toEqual([])
  })

  it('keeps the list honest — every allowed entry still exists', () => {
    // ⚠️ Otherwise the list rots into a set of names for strings that are gone,
    // and the next reader cannot tell a live exception from a dead one. Same
    // fault as a header that counts tables it no longer describes.
    const missing = []
    for (const entry of Object.keys(ALLOWED)) {
      const [ns, keyPath] = entry.split(':')
      const file = path.join(LOCALES, `${ns}.json`)
      if (!fs.existsSync(file)) { missing.push(`${entry} (no such namespace)`); continue }
      const dictionary = JSON.parse(fs.readFileSync(file, 'utf8'))
      const value = keyPath.split('.').reduce((n, p) => (n == null ? n : n[p]), dictionary)
      if (typeof value !== 'string' || !value.includes(TATWEEL)) missing.push(entry)
    }
    expect(missing).toEqual([])
  })

  it('the quantity frames are free of it, which is why this file exists', () => {
    const products = JSON.parse(fs.readFileSync(path.join(LOCALES, 'products.json'), 'utf8'))
    expect(products.documents.inBase).not.toContain(TATWEEL)
    expect(products.documents.inEntered).not.toContain(TATWEEL)
  })
})

// ── The other half of the same rule, and it had no guard ──────────────────
//
// Removing the tatweel left `بال{{unit}}`, which is CORRECT — and correct only
// while the placeholder holds a BARE ARABIC NOUN. The rule above says a tatweel
// is right before a name, a number or a Latin word; this is its inverse, and
// exactly as unreadable from the string itself:
//
//     بال + قطعة   → بالقطعة   ✅
//     بال + ml     → بالml     🔴  needs the tatweel this file bans by default
//     بال + القطعة → بالالقطعة 🔴  the article written twice
//
// ⚠️ The sweep that found this class was prompted by the same fault appearing
// in design/mockup-catalog.html — `'بـ' + noun`, printing بـالقطعة — and the
// rule this project keeps paying for says to read the whole class rather than
// the site that happened to be caught. Three shipped keys compose this prefix
// (documents.inBase · documents.inEntered · stocktake.inBase), and all three
// are RIGHT today. What was missing is anything keeping them right.
//
// ⚠️ AND THIS RETRACTS A RECOMMENDATION MADE ONE ROUND EARLIER — that the
// locale should hold `بالقطعة`, `بالمل`, `بالغرام` composed, because "prefix
// plus noun is a string operation that looks right in the source and breaks in
// the render". Measured, that is true of `بـ` and NOT of `بال`: composition is
// sound here, and the invariant is about what fills the placeholder. Six keys
// to remove an invariant that a guard pins for free is the worse trade.
describe('what fills بال{{…}} must be a bare Arabic noun', () => {
  const products = JSON.parse(fs.readFileSync(path.join(LOCALES, 'products.json'), 'utf8'))
  const units = products.units

  it('reads the unit nouns rather than passing on an empty scan', () => {
    // pcs · ml · g — the three values of the base_unit enum, measured in the
    // catalogue. A fourth arriving with no Arabic noun would fail below.
    expect(Object.keys(units).sort()).toEqual(['g', 'ml', 'pcs'])
  })

  it('has no Latin in any of them', () => {
    // A Latin unit name after بال renders بالml, which is the one case that
    // genuinely needs the tatweel this file bans — so it would arrive as a
    // rendering fault nobody can fix without an exception above.
    const latin = Object.entries(units).filter(([, v]) => /[A-Za-z]/.test(v))
    expect(latin).toEqual([])
  })

  it('has no definite article on any of them', () => {
    // بال + القطعة is بالالقطعة. The noun carries no article precisely because
    // the frame supplies one.
    const doubled = Object.entries(units).filter(([, v]) => v.trimStart().startsWith('ال'))
    expect(doubled).toEqual([])
  })

  it('still finds the frames that depend on it — derived, not listed', () => {
    // ⚠️ If every frame were renamed, this guard would keep passing over an
    // invariant nothing needs any more — a check that outlives its subject.
    //
    // ⚠️ AND NAMING THEM WAS TRIED FIRST AND WAS WRONG TWICE IN ONE LINE. The
    // third frame is balances.inBase and was written here as stocktake.inBase
    // from memory; and the grep that found the class was anchored to the start
    // of the string (`"بال{{`), so it never saw archiveNotice.atStorage —
    // «{{storage}} — بال{{unit}}: {{n}}» — where the prefix sits mid-sentence.
    //
    // So the sweep for a class was itself narrow, in the round whose subject is
    // narrow questions. Derived from the dictionary, it cannot be.
    const found = []
    const walkAll = (node, at) => {
      for (const [k, v] of Object.entries(node)) {
        const p = at ? `${at}.${k}` : k
        if (typeof v === 'string') { if (/بال\{\{/.test(v)) found.push(p) }
        else if (v && typeof v === 'object') walkAll(v, p)
      }
    }
    walkAll(products, '')
    expect(found.sort()).toEqual([
      'archiveNotice.atStorage',
      'balances.inBase',
      'documents.inBase',
      'documents.inEntered',
    ])
  })
})
