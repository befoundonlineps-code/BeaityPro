import { useState, useEffect } from 'react'
import { useTranslation } from 'next-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { reportDbError } from '../lib/dbErrors'
import { saveSupplier, saveSupplierContacts } from '../lib/inventoryAdminIO'
import { validateSupplier, supplierPayload, validateSupplierContacts } from '../lib/supplierForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const FIELD = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30'

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

// The supplier window.
//
// Four fields and a list of people, against the reference's fifteen. Its
// Requisites block (legal and actual address, bank account type and number,
// bank name) and its per-supplier currency are absent by decision, not by
// omission: those are what a Russian accounting package needs to file a payment
// order, nothing here files anything, and a form that collects data no code
// reads teaches people that filling boxes is optional.
export default function SupplierFormDialog({
  open, onOpenChange, supplier, contacts: allContacts, salonId, onSaved,
}) {
  const { t } = useTranslation(['products', 'common'])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [notes, setNotes] = useState('')
  const [contacts, setContacts] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState(null)

  const isEdit = !!supplier
  const effectiveId = supplier ? supplier.id : createdId
  const existingRows = supplier
    ? (allContacts || []).filter((c) => c.supplier_id === supplier.id)
    : []

  useEffect(() => {
    if (!open) return
    setError('')
    setCreatedId(null)
    setName(supplier ? supplier.name || '' : '')
    setPhone(supplier ? supplier.phone || '' : '')
    setEmail(supplier ? supplier.email || '' : '')
    setWebsite(supplier ? supplier.website || '' : '')
    setNotes(supplier ? supplier.notes || '' : '')
    setContacts(supplier
      ? (allContacts || [])
          .filter((c) => c.supplier_id === supplier.id)
          .map((c) => ({
            id: c.id,
            lastName: c.last_name || '',
            firstName: c.first_name || '',
            position: c.position || '',
            phone: c.phone || '',
            email: c.email || '',
            notes: c.notes || '',
          }))
      : [])
  }, [open, supplier, allContacts])

  function setContactAt(index, patch) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  async function handleSave() {
    const validationKey = validateSupplier({ name })
    if (validationKey) {
      setError(t(validationKey))
      return
    }

    const contactsKey = validateSupplierContacts(contacts)
    if (contactsKey) {
      setError(t(contactsKey))
      return
    }

    setError('')
    setSaving(true)

    const { ok, error: saveError, row } = await saveSupplier({
      id: effectiveId,
      payload: supplierPayload({ name, phone, email, website, notes }),
      salonId,
    })

    if (!ok) {
      setSaving(false)
      setError(saveError
        ? t(reportDbError(saveError, 'SupplierFormDialog.save'))
        : t('products:supplierDialog.noRowsError'))
      return
    }

    const supplierId = row.id
    setCreatedId(supplierId)

    const { ok: contactsOk, error: contactsError } = await saveSupplierContacts({
      supplierId, salonId, existingRows, contacts,
    })

    if (!contactsOk) {
      setSaving(false)
      onSaved()
      setError(contactsError
        ? t(reportDbError(contactsError, 'SupplierFormDialog.contacts'))
        : t('products:supplierDialog.contactsFailedError'))
      return
    }

    setSaving(false)
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col overflow-hidden max-w-[calc(100%-2rem)] lg:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('products:supplierDialog.editTitle') : t('products:supplierDialog.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pe-1">
          <Section title={t('products:supplierDialog.sectionInfo')}>
            <Field label={t('products:supplierDialog.nameLabel')}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('products:supplierDialog.phoneLabel')}>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label={t('products:supplierDialog.emailLabel')}>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <Field label={t('products:supplierDialog.websiteLabel')}>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} />
            </Field>
            <Field label={t('products:supplierDialog.notesLabel')}>
              <textarea
                className={`${FIELD} h-20 resize-none py-2`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </Section>

          <Section title={t('products:supplierDialog.sectionContacts')}>
            <p className="text-xs text-muted-foreground">{t('products:supplierDialog.contactsHint')}</p>

            {contacts.map((c, index) => (
              <div key={c.id || index} className="flex flex-col gap-2 rounded-lg border border-border/60 p-2.5">
                {/* Labels, not placeholders. A placeholder disappears the
                    moment the box is filled, so somebody reopening a supplier
                    next month cannot tell the family name from the given one —
                    and the two swapped is a mistake that never shows at all. */}
                <div className="flex items-start gap-2">
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
                    <Field label={t('products:supplierDialog.lastNameLabel')}>
                      <Input value={c.lastName}
                        onChange={(e) => setContactAt(index, { lastName: e.target.value })} />
                    </Field>
                    <Field label={t('products:supplierDialog.firstNameLabel')}>
                      <Input value={c.firstName}
                        onChange={(e) => setContactAt(index, { firstName: e.target.value })} />
                    </Field>
                    <Field label={t('products:supplierDialog.positionLabel')}>
                      <Input value={c.position}
                        onChange={(e) => setContactAt(index, { position: e.target.value })} />
                    </Field>
                  </div>
                  <Button
                    type="button" variant="outline" size="icon" className="mt-6 size-8 shrink-0"
                    title={t('products:supplierDialog.contactRemove')}
                    onClick={() => setContacts((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Field label={t('products:supplierDialog.phoneLabel')}>
                    <Input value={c.phone} onChange={(e) => setContactAt(index, { phone: e.target.value })} />
                  </Field>
                  <Field label={t('products:supplierDialog.emailLabel')}>
                    <Input value={c.email} onChange={(e) => setContactAt(index, { email: e.target.value })} />
                  </Field>
                </div>
                <Field label={t('products:supplierDialog.notesLabel')}>
                  <Input value={c.notes} onChange={(e) => setContactAt(index, { notes: e.target.value })} />
                </Field>
              </div>
            ))}

            <Button
              type="button" variant="outline" size="sm" className="self-start"
              onClick={() => setContacts((prev) => [...prev, {
                lastName: '', firstName: '', position: '', phone: '', email: '', notes: '',
              }])}
            >
              <Plus className="size-3.5" />
              {t('products:supplierDialog.contactAdd')}
            </Button>
          </Section>
        </div>

        {error && <div className="shrink-0 text-sm text-destructive">{error}</div>}

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common:discard')}</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? t('common:saving') : t('common:save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
