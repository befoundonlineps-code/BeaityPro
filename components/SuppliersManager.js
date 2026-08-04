import { useState } from 'react'
import { useTranslation } from 'next-i18next'
import { AlertTriangle, Plus, Archive, Pencil } from 'lucide-react'
import SupplierFormDialog from './SupplierFormDialog'
import { dbErrorSentence } from '../lib/dbErrors'
import { setSupplierArchived } from '../lib/inventoryAdminIO'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// The suppliers screen.
//
// No delete button: suppliers has no RLS delete policy, and products holds
// supplier_id with ON DELETE RESTRICT anyway, so a supplier that ever appeared
// on a consignment product could never have been removed.
//
// Archiving one does not detach it from the products that name it. That is on
// purpose — a consignment product must have a supplier (there is a CHECK), so
// clearing the reference would leave rows the database refuses to accept. The
// product window keeps showing an archived supplier that was already chosen,
// which is what supplierChoices is for.
export default function SuppliersManager({
  suppliers, contacts, loading, error, reload, salonId,
}) {
  const { t } = useTranslation(['products', 'common'])
  const [dialog, setDialog] = useState(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  function contactCount(supplierId) {
    return (contacts || []).filter((c) => c.supplier_id === supplierId).length
  }

  async function toggleArchived(supplier) {
    setBusy(true)
    setActionError('')
    const { ok, error: writeError } = await setSupplierArchived(
      supplier.id, supplier.is_active !== false
    )
    setBusy(false)
    if (!ok) {
      setActionError(writeError
        ? dbErrorSentence(writeError, t, 'SuppliersManager.archive')
        : t('products:suppliers.archiveFailed'))
      return
    }
    reload()
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-destructive" />
          <span className="text-sm font-medium text-destructive">{t('products:loadFailedTitle')}</span>
          <span className="text-xs text-muted-foreground">
            {dbErrorSentence(error, t, 'SuppliersManager.load')}
          </span>
          <Button type="button" variant="outline" size="sm" className="ms-auto" onClick={reload}>
            {t('products:retry')}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('products:suppliers.hint')}</p>
        <Button onClick={() => setDialog({ supplier: null })}>
          <Plus />
          {t('products:suppliers.addButton')}
        </Button>
      </div>

      {actionError && <div className="text-sm text-destructive">{actionError}</div>}

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{t('common:loading')}</div>
      ) : suppliers.length === 0 ? (
        <div className="flex flex-col gap-1 py-10 text-center text-sm text-muted-foreground">
          <span>{t('products:suppliers.emptyTitle')}</span>
          <span className="text-xs">{t('products:suppliers.emptyHint')}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className={`truncate font-medium ${s.is_active === false ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                    {s.name}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="outline" size="icon" className="size-7"
                      title={t('products:suppliers.edit')}
                      onClick={() => setDialog({ supplier: s })}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="size-7"
                      disabled={busy}
                      title={t(s.is_active === false ? 'products:suppliers.restore' : 'products:suppliers.archive')}
                      onClick={() => toggleArchived(s)}>
                      <Archive className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {s.phone && <span className="truncate text-sm text-muted-foreground">{s.phone}</span>}

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {t('products:suppliers.contactsBadge', { count: contactCount(s.id) })}
                  </Badge>
                  {s.is_active === false && (
                    <Badge variant="outline">{t('products:archivedBadge')}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SupplierFormDialog
        open={!!dialog}
        onOpenChange={(open) => { if (!open) setDialog(null) }}
        supplier={dialog?.supplier}
        contacts={contacts}
        salonId={salonId}
        onSaved={reload}
      />
    </div>
  )
}
