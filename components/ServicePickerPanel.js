import { useMemo, useState } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Minus, Zap } from 'lucide-react'
import { servicePickerTree, filterServiceTree, servicePriceState } from '../lib/servicePicker'
import { Input } from '@/components/ui/input'

// One service row: what it is on one side, what it costs on the other.
function ServiceRow({ service, selected, onPick, t }) {
  const price = servicePriceState(service)
  return (
    <button
      type="button"
      onClick={() => onPick(service)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors ${
        selected ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
      }`}
    >
      <Zap className="size-3.5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{service.name}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {t('services:minutesShort', { count: service.duration_minutes })}
      </span>
      {/* A price when there is one to charge, and the sentence when there is
          not. Zero counts as "not set": the catalogue cannot tell free from
          nobody-filled-this-in, so the screen answers the question the salon
          actually asks. */}
      <span className={`shrink-0 text-xs ${price.known ? 'font-medium' : 'text-muted-foreground'}`}>
        {price.known
          ? t('services:priceShort', { price: price.price.toLocaleString('ar') })
          : t('appointments:servicePicker.noPriceSet')}
      </span>
    </button>
  )
}

// A folder that opens. Closed by default and opened by its own button, which
// is the whole point of a folder here: a salon with two hundred services
// needs the list to start as a page of headings rather than a page of
// services.
function Folder({ node, depth, expanded, onToggle, selectedId, onPick, t }) {
  const open = expanded.has(node.id)
  const count = (node.services || []).length
    + (node.children || []).reduce((sum, c) => sum + (c.services || []).length, 0)

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm font-medium hover:bg-muted"
        style={{ paddingInlineStart: `${depth * 12 + 8}px` }}
      >
        <span className="flex size-4 shrink-0 items-center justify-center rounded border border-border text-muted-foreground">
          {open ? <Minus className="size-2.5" /> : <Plus className="size-2.5" />}
        </span>
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        <span className="shrink-0 text-xs font-normal text-muted-foreground">{count}</span>
      </button>

      {open && (
        <div style={{ paddingInlineStart: `${depth * 12 + 12}px` }}>
          {(node.services || []).map((s) => (
            <ServiceRow key={s.id} service={s} selected={s.id === selectedId} onPick={onPick} t={t} />
          ))}
          {(node.children || []).map((sub) => (
            <Folder
              key={sub.id}
              node={sub}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedId={selectedId}
              onPick={onPick}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// The panel a booking picks its service out of.
//
// Three tabs, and only the first has anything behind it. Products and
// certificates are shapes: there is no products table and no certificates
// table in this database, and the tabs are here so the screen matches the one
// it was drawn from, not because there is anything to show.
export default function ServicePickerPanel({ categories, services, selectedServiceId, onPick }) {
  const { t } = useTranslation(['appointments', 'services', 'common'])
  const [tab, setTab] = useState('services')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())

  const tree = useMemo(() => servicePickerTree(categories, services), [categories, services])
  const searching = search.trim().length > 0
  const shown = useMemo(() => filterServiceTree(tree, search), [tree, search])

  // While searching every folder is open: the point of typing is to see the
  // matches, and leaving them behind a closed folder would hide the answer
  // behind the same press the search was meant to save.
  const openFolders = useMemo(() => {
    if (!searching) return expanded
    const all = new Set()
    for (const root of shown) {
      all.add(root.id)
      for (const sub of root.children || []) all.add(sub.id)
    }
    return all
  }, [searching, shown, expanded])

  function toggle(id) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const TABS = [
    ['services', t('appointments:servicePicker.servicesTab')],
    ['products', t('appointments:servicePicker.productsTab')],
    ['certificates', t('appointments:servicePicker.certificatesTab')],
  ]

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm transition-colors ${
              tab === key
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'services' ? (
        <>
          <Input
            placeholder={t('appointments:servicePicker.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {shown.map((root) => (
              <Folder
                key={root.id}
                node={root}
                depth={0}
                expanded={openFolders}
                onToggle={toggle}
                selectedId={selectedServiceId}
                onPick={onPick}
                t={t}
              />
            ))}
            {shown.length === 0 && (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                {searching ? t('common:noResults') : t('appointments:servicePicker.emptyHint')}
              </div>
            )}
          </div>
        </>
      ) : (
        // Nothing behind either tab, and it says so rather than showing an
        // empty list that looks like missing data.
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
          {t('common:sectionInDevelopmentNotice', {
            label: tab === 'products'
              ? t('appointments:servicePicker.productsTab')
              : t('appointments:servicePicker.certificatesTab'),
          })}
        </div>
      )}
    </div>
  )
}
