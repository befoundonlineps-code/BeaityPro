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
