import type { Camp } from '@/types/camps'
import { type Child, getChildAge } from '@/types/child'
import type { Session } from '@/types/sessions'
import type { CampBookingAddOn, CampBookingAddOnSelection } from '@/types/camp-booking'

export function getSessionFallbackUnitPrice(session: Session | null | undefined): number {
  if (!session) return 0
  if (session.pricingType === 'single') return Number(session.price ?? 0)
  if (session.pricingType === 'age_group') {
    const prices = session.ageGroupPrices ?? []
    return prices.length ? Math.min(...prices.map(p => Number(p.price ?? 0))) : 0
  }
  return 0
}

function getCampAgeGroupIdForChildAge(
  camp: Camp | null | undefined,
  childAge: number
): string | null {
  const ageGroups = (camp?.ageGroups ?? []) as Array<any>
  const match = ageGroups.find(
    ag =>
      typeof ag?.min === 'number' &&
      typeof ag?.max === 'number' &&
      childAge >= ag.min &&
      childAge <= ag.max
  )
  const id = match?.id ?? match?.ageGroupId
  return id ? String(id) : null
}

export function getChildUnitPrice(
  session: Session | null | undefined,
  camp: Camp | null | undefined,
  child: Child | null | undefined
): number {
  if (!session || !child) return 0

  if (session.pricingType === 'single') return Number(session.price ?? 0)

  if (session.pricingType === 'age_group') {
    const age = getChildAge(child)
    if (age === null) return getSessionFallbackUnitPrice(session)

    const ageGroupId = getCampAgeGroupIdForChildAge(camp, age)
    if (!ageGroupId) return getSessionFallbackUnitPrice(session)

    const prices = session.ageGroupPrices ?? []
    const match = prices.find(p => String(p.ageGroupId) === ageGroupId)
    if (match) return Number(match.price ?? 0)

    return getSessionFallbackUnitPrice(session)
  }

  return getSessionFallbackUnitPrice(session)
}

export function getSelectedChildrenSubtotal(args: {
  session: Session | null | undefined
  camp: Camp | null | undefined
  children: Child[]
  selectedChildIds: string[]
}): number {
  const { session, camp, children, selectedChildIds } = args
  if (!session) return 0
  if (!selectedChildIds.length) return 0

  let total = 0
  for (const child of children) {
    if (!selectedChildIds.includes(child.id)) continue
    total += getChildUnitPrice(session, camp, child)
  }
  return total
}

export type SelectedChildrenPriceBreakdownRow = {
  unitPrice: number
  count: number
  lineTotal: number
}

export function getSelectedChildrenPriceBreakdown(args: {
  session: Session | null | undefined
  camp: Camp | null | undefined
  children: Child[]
  selectedChildIds: string[]
}): SelectedChildrenPriceBreakdownRow[] {
  const { session, camp, children, selectedChildIds } = args
  if (!session) return []
  if (!selectedChildIds.length) return []

  const countsByUnit = new Map<number, number>()
  for (const child of children) {
    if (!selectedChildIds.includes(child.id)) continue
    const unit = getChildUnitPrice(session, camp, child)
    countsByUnit.set(unit, (countsByUnit.get(unit) ?? 0) + 1)
  }

  return Array.from(countsByUnit.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([unitPrice, count]) => ({
      unitPrice,
      count,
      lineTotal: unitPrice * count,
    }))
}

export type AddOnExtrasRow = {
  key: string
  label: string
  total: number
}

export function getAddOnExtrasRows(args: {
  addOns: CampBookingAddOn[]
  addOnSelectionsById: Record<string, CampBookingAddOnSelection>
}): AddOnExtrasRow[] {
  const { addOns, addOnSelectionsById } = args
  const rows: AddOnExtrasRow[] = []
  for (const selection of Object.values(addOnSelectionsById)) {
    const addon = addOns.find(a => a.addOnId === selection.addOnId)
    if (!addon) continue
    let qty = 0
    if (selection.mode === 'per_child') qty = selection.childIds?.length ?? 0
    else if (selection.mode === 'per_child_qty') {
      qty = (selection.childQuantities ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
    } else qty = selection.quantity ?? 0
    if (qty <= 0) continue
    rows.push({
      key: addon.addOnId,
      label: qty > 1 ? `${addon.name} × ${qty}` : addon.name,
      total: addon.price * qty,
    })
  }
  return rows
}
