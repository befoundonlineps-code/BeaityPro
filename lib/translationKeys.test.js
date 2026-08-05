const fs = require('fs')
const path = require('path')

// Every literal translation key a screen asks for must exist.
//
// ⚠️ Written after two raw keys reached the OWNER's screen, not mine:
// `documents.fromStorage` and `documents.direction_out`, drawn as their own
// names beside real data. Both were in the file and in the pushed commit — the
// cause was a dev server that had not been restarted after the pull, which is
// the sixth time that has happened this session and the first time it reached
// somebody other than me.
//
// This guard does not distinguish the two causes, and that is deliberate: a key
// missing from the file and a key the server has not loaded look identical on
// screen and are equally wrong to ship. What it does is remove the first cause
// entirely, so a raw key on a screen can only ever mean "restart".
//
// ⚠️ AND ITS LIMIT, stated rather than left to be discovered: it reads LITERAL
// keys only. A key built at runtime — t(`products:docs.${type}.title`) — is
// invisible here, and this module has many. Those are covered by naming the
// finite set they can produce and checking that set explicitly, below. Any new
// template key needs a line adding; a guard that silently skipped them would be
// the same fault as the count guard that listed variable names.
const ROOT = path.join(__dirname, '..')
const LOCALES = path.join(ROOT, 'public', 'locales', 'ar')

const dictionaries = Object.fromEntries(
  fs.readdirSync(LOCALES)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace('.json', ''), JSON.parse(fs.readFileSync(path.join(LOCALES, f), 'utf8'))])
)

const resolve = (ns, key) =>
  key.split('.').reduce((node, part) => (node == null ? node : node[part]), dictionaries[ns])

// ⚠️ The scope is DERIVED, not listed — and that correction is the point.
//
// This first read components/ and pages/. lib/ was added after a mutation found
// 109 unchecked keys there. hooks/ and constants.js were still missing, and
// nothing would have said so: a guard with a hand-written directory list
// reports ✓ about the directories it happens to know.
//
// That is the third guard in this session corrected at the same place — the
// count guard assumed variables are named `count`/`n`, the ui-primitives guard
// assumed text is the only child, this one assumed keys live in two folders.
// None was a logic error. All three were SCOPE errors, and none announced its
// own limit.
//
// So: everything that is source and is not a test. A new top-level directory
// is guarded the day it appears, without anybody remembering to add it.
const SKIP = new Set(['node_modules', '.next', '.next-check', '.git', 'out', 'coverage'])

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.jsx?$/.test(entry.name) && !/\.test\.jsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

// The keys assembled at runtime, listed by the finite set each can produce.
// Adding a template key without adding a line here is the gap this list exists
// to make visible.
const TEMPLATE_KEYS = [
  ...['pcs', 'ml', 'g'].map((u) => ['products', `units.${u}`]),
  ...['package', 'portion', 'unit'].map((u) => ['products', `docs.uom_${u}`]),
  ...['supply', 'write_off', 'return_to_supplier', 'transfer'].flatMap((d) =>
    ['hint', 'postButton', 'posted', 'title'].map((s) => ['products', `docs.${d}.${s}`])),
  ...['stocktake', 'opening', 'reversal', 'sale', 'service_consumption'].map((d) =>
    ['products', `docs.${d}.title`]),
  ...['in', 'out'].map((d) => ['products', `documents.direction_${d}`]),
  ...['common', 'professional'].map((k) => ['products', `storageDialog.kind_${k}`]),
  ...['purchase_price', 'sales_price'].map((b) => ['products', `storageDialog.fineBasis_${b}`]),
  ...['storages', 'suppliers', 'supply', 'writeOff', 'returnToSupplier', 'transfer', 'documents']
    .map((s) => ['products', `secondaryItems.${s}`]),
  ...['cosmetologist', 'hairdresser', 'makeup_artist', 'manicure_professional', 'masseur',
    'pedicure_professional', 'stylist', 'administrator', 'executive', 'owner']
    .map((r) => ['employees', `roles.${r}`]),
]

// ⚠️ lib/ was missing here, and a mutation found it: deleting a key that only
// lib/ names killed nothing. 109 keys across 11 files had never been checked —
// every error key the pure modules return (products:stock.unitCostRequired and
// its kind) and every label table they hold.
//
// The blind spot came from the name: this was written as "keys a SCREEN asks
// for", so it read the screens. But a key does not have to be typed in a
// component to reach one — lib/ returns keys and the screen only forwards
// them, which is the whole design of dbErrorSentence. Guarding by where a
// string is WRITTEN rather than where it is USED left the half that moved.
//
// Test files are excluded: they name keys to assert about them, including
// deliberately absent ones.
describe('every translation key a screen asks for exists', () => {
  const files = sourceFiles(ROOT)

  it('reads the screens and the dictionaries', () => {
    expect(files.length).toBeGreaterThan(30)
    expect(Object.keys(dictionaries).length).toBeGreaterThan(5)
  })

  it('resolves every literal key', () => {
    const missing = []
    let checked = 0
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      for (const [, ns, key] of source.matchAll(/['"`](common|products|services|appointments|employees|settings|clientForm|clientProfile|clientsList|login|topBar):([A-Za-z0-9_.]+)['"`]/g)) {
        checked += 1
        if (!dictionaries[ns]) { missing.push(`${path.relative(ROOT, file)} → unknown namespace ${ns}`); continue }
        if (resolve(ns, key) === undefined) missing.push(`${path.relative(ROOT, file)} → ${ns}:${key}`)
      }
    }
    expect(checked).toBeGreaterThan(200)
    expect(missing).toEqual([])
  })

  it('resolves every key a template can build', () => {
    // The two that reached the owner's screen were of this kind — one literal,
    // one built — so both halves are checked or the guard only half works.
    const missing = TEMPLATE_KEYS
      .filter(([ns, key]) => resolve(ns, key) === undefined)
      .map(([ns, key]) => `${ns}:${key}`)
    expect(TEMPLATE_KEYS.length).toBeGreaterThan(40)
    expect(missing).toEqual([])
  })
})
