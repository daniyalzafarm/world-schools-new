'use client'

import { useState } from 'react'
import { addToast, Button, Chip } from '@heroui/react'
import { Package, Pencil, Trash } from 'lucide-react'
import { formatCurrency } from '@world-schools/wc-utils'
import { useConfirmDialog } from '@world-schools/ui-web'
import { ADD_ON_TYPE_BADGES, type AddOn, formatPricingUnit } from '@/types/add-ons'
import { useAddOnsStore } from '@/stores/add-ons.store'
import { Can } from '@/components/auth/can'

interface AddOnCardProps {
  addOn: AddOn
  /** Provider's settlement currency — add-on prices are always denominated in this. */
  currency: string
  onEdit: () => void
}

export function AddOnCard({ addOn, currency, onEdit }: AddOnCardProps) {
  const { deleteAddOn } = useAddOnsStore()
  const { confirm } = useConfirmDialog()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Add-on?',
      message: `Are you sure you want to delete "${addOn.name}"? This will remove it from ALL camps where it's currently used.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteAddOn(addOn.id)
      addToast({ title: 'Add-on deleted', color: 'success' })
    } finally {
      setIsDeleting(false)
    }
  }

  const typeBadge = ADD_ON_TYPE_BADGES[addOn.type]
  const usageCount = addOn._count?.campAddOns ?? 0

  // Ensure price is a number (handle Prisma Decimal objects)
  const price = typeof addOn.price === 'number' ? addOn.price : parseFloat(String(addOn.price))

  return (
    <div className="flex items-center gap-4 px-4 py-4 hover:bg-default-50 transition-colors">
      <div className="shrink-0 w-12 h-12 rounded-lg bg-default-100 flex items-center justify-center text-2xl">
        {addOn.icon || <Package className="h-6 w-6 text-default-400" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-default-900 mb-1 truncate">{addOn.name}</div>
        {addOn.description && (
          <div className="text-sm text-default-500 mb-2 line-clamp-1">{addOn.description}</div>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          <Chip size="sm" className={`text-xs font-semibold ${typeBadge.className}`} variant="flat">
            {typeBadge.label}
          </Chip>
          <span className="text-sm text-default-400">
            Used in {usageCount} {usageCount === 1 ? 'camp' : 'camps'}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right min-w-24">
        <div className="text-lg font-bold text-default-900">{formatCurrency(price, currency)}</div>
        <div className="text-xs text-default-400">
          {formatPricingUnit(addOn.pricingUnit)}
          {addOn.maxQuantity ? (
            <span>
              {' '}
              (max {addOn.maxQuantity}
              {addOn.quantityUnit ? ` ${addOn.quantityUnit}` : ''})
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Can permission="addons.update">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={onEdit}
            aria-label={`Edit ${addOn.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </Can>
        <Can permission="addons.delete">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={handleDelete}
            isLoading={isDeleting}
            aria-label={`Delete ${addOn.name}`}
          >
            {!isDeleting && <Trash className="h-4 w-4" />}
          </Button>
        </Can>
      </div>
    </div>
  )
}
