import type {
  CampBookingAddOn,
  CampBookingAddOnSelection,
  CampBookingAddOnSelectionMode,
} from '@/types/camp-booking'

export type AddOnPricingUnit =
  | 'per_child'
  | 'per_hour'
  | 'per_session'
  | 'per_week'
  | 'per_bag'
  | 'one_time'

export const isOneTimeAddOn = (addOn: Pick<CampBookingAddOn, 'pricingUnit'>): boolean =>
  addOn.pricingUnit === 'one_time'

export const getAddOnMode = (
  addOn: Pick<CampBookingAddOn, 'pricingUnit'>
): CampBookingAddOnSelectionMode => {
  switch (addOn.pricingUnit) {
    case 'per_child':
    case 'one_time':
      return 'per_child'
    case 'per_hour':
    case 'per_session':
    case 'per_week':
    case 'per_bag':
      return 'per_child_qty'
    default:
      return 'per_child_qty'
  }
}

const DEFAULT_UNIT_NOUN: Record<string, string> = {
  per_child: 'child',
  per_hour: 'hour',
  per_session: 'session',
  per_week: 'week',
  per_bag: 'bag',
  one_time: 'item',
}

export const getAddOnUnitNoun = (
  addOn: Pick<CampBookingAddOn, 'pricingUnit' | 'quantityUnit'>
): string => {
  const override = addOn.quantityUnit?.trim()
  if (override) return override.replace(/^per\s+/i, '')
  return DEFAULT_UNIT_NOUN[addOn.pricingUnit] ?? 'item'
}

export const getAddOnTileLabel = (
  addOn: Pick<CampBookingAddOn, 'pricingUnit' | 'quantityUnit'>
): string => {
  if (isOneTimeAddOn(addOn)) return 'one-time fee'
  const mode = getAddOnMode(addOn)
  const noun = getAddOnUnitNoun(addOn)
  if (mode === 'per_child') return 'per child'
  if (mode === 'per_child_qty') return `per ${noun}/child`
  return `per ${noun}`
}

export const calcAddOnSelectionTotal = (
  addOn: Pick<CampBookingAddOn, 'price'> | undefined,
  selection: CampBookingAddOnSelection | undefined
): number => {
  if (!addOn || !selection) return 0
  if (selection.mode === 'per_child') return addOn.price * (selection.childIds?.length ?? 0)
  if (selection.mode === 'per_child_qty') {
    const qty = (selection.childQuantities ?? []).reduce((s, cq) => s + (cq.quantity ?? 0), 0)
    return addOn.price * qty
  }
  return addOn.price * (selection.quantity ?? 0)
}

export const calcExtrasTotal = (
  addOns: Pick<CampBookingAddOn, 'addOnId' | 'price'>[],
  selectionsById: Record<string, CampBookingAddOnSelection>
): number =>
  Object.values(selectionsById).reduce((sum, selection) => {
    const addOn = addOns.find(a => a.addOnId === selection.addOnId)
    return sum + calcAddOnSelectionTotal(addOn, selection)
  }, 0)
