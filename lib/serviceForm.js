import { BUSINESS_TYPES } from './serviceTree'

export const SEX_OPTIONS = ['all', 'men', 'women']

// The accounting direction a service's revenue counts towards: the seven
// business types plus a shared one for anything that belongs to no single
// department.
//
// It is not the same thing as business_type even though the values overlap.
// business_type decides who sees the service (ADR-019); this decides which
// department the money lands in, and a service can perfectly well be offered
// by the nails folder while its revenue counts as common. The overlap is why
// they need saying apart rather than merging.
export const ACCOUNTING_DIRECTIONS = ['common', ...BUSINESS_TYPES]

const trimmedOrNull = (value) => {
  const text = String(value ?? '').trim()
  return text === '' ? null : text
}

const numberOrNull = (value) => {
  const text = String(value ?? '').trim()
  return text === '' ? null : Number(text)
}

// Returns a translation key, or '' when the form is fit to send.
//
// Keys rather than sentences so the rule stays testable without a translator
// loaded, which is how lib/dbErrors.js already reports.
export function validateServiceForm(values) {
  const v = values || {}

  if (!String(v.name ?? '').trim()) return 'services:serviceDialog.nameRequiredError'

  const duration = Number(v.duration)
  if (!Number.isFinite(duration) || duration <= 0) return 'services:serviceDialog.durationInvalidError'

  const price = Number(v.price)
  if (!Number.isFinite(price) || price < 0) return 'services:serviceDialog.priceInvalidError'

  // Empty is allowed and means "not worked out yet". A typed value has to be a
  // real non-negative number, matching services_planned_cost_check — better to
  // say so here than to let the database refuse in a language nobody reads.
  const plannedCost = numberOrNull(v.plannedCost)
  if (plannedCost !== null && (!Number.isFinite(plannedCost) || plannedCost < 0)) {
    return 'services:serviceDialog.plannedCostInvalidError'
  }

  return ''
}

// Every column the form owns, always all of them.
//
// No key is ever left out, the same rule saveCategory follows and for the same
// reason: a key missing from an update leaves the old value in place, so
// clearing a barcode or removing a picture would look like it worked and
// change nothing. Blank means null here, deliberately — an empty string in a
// text column is a value, and two kinds of "nothing" in one column is a
// distinction no screen would ever be able to explain.
//
// image_path is not here. It is settled after the row exists, because the
// storage path contains the service id and a new service has none until it
// has been inserted.
export function serviceFormPayload(values) {
  const v = values || {}
  return {
    name: String(v.name ?? '').trim(),
    duration_minutes: Number(v.duration),
    price: Number(v.price),
    color: v.color,
    sex: v.sex,
    abbreviation: trimmedOrNull(v.abbreviation),
    bar_code: trimmedOrNull(v.barCode),
    description: trimmedOrNull(v.description),
    planned_cost: numberOrNull(v.plannedCost),
    accounting_direction: trimmedOrNull(v.accountingDirection),
    price_proportional_to_duration: !!v.priceProportionalToDuration,
    anyone_can_sell: !!v.anyoneCanSell,
  }
}
