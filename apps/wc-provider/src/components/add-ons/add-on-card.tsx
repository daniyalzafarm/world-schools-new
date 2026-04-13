'use client'

import { useState } from 'react'
import { Button, Chip } from '@heroui/react'
import { ADD_ON_TYPE_BADGES, type AddOn, formatPrice } from '@/types/add-ons'
import { useAddOnsStore } from '@/stores/add-ons.store'

interface AddOnCardProps {
  addOn: AddOn
  onEdit: () => void
}

export function AddOnCard({ addOn, onEdit }: AddOnCardProps) {
  const { deleteAddOn } = useAddOnsStore()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (
      !confirm(
        "Delete this add-on?\n\nThis will remove it from ALL camps where it's currently used."
      )
    ) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteAddOn(addOn.id)
    } catch (error) {
      console.error('Failed to delete add-on:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const typeBadge = ADD_ON_TYPE_BADGES[addOn.type]
  const usageCount = addOn._count?.campAddOns ?? 0

  // Ensure price is a number (handle Prisma Decimal objects)
  const price = typeof addOn.price === 'number' ? addOn.price : parseFloat(String(addOn.price))

  return (
    <div className="flex items-center gap-4 p-4 bg-default-50 rounded-xl border border-default-200 hover:border-default-300 transition-colors">
      {/* Icon */}
      <div className="shrink-0 w-12 h-12 rounded-lg bg-default-100 flex items-center justify-center text-2xl">
        {addOn.icon || '📦'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-default-900 mb-1">{addOn.name}</div>
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

      {/* Pricing */}
      <div className="shrink-0 text-right min-w-24">
        <div className="text-lg font-bold text-default-900">
          {addOn.currency} {price.toFixed(0)}
        </div>
        <div className="text-xs text-default-400">
          {formatPrice(price, addOn.currency, addOn.pricingUnit).split(' ').slice(2).join(' ')}
          {addOn.maxQuantity && (
            <span>
              {' '}
              (max {addOn.maxQuantity}
              {addOn.quantityUnit ? ` ${addOn.quantityUnit}` : ''})
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          onPress={onEdit}
          className="w-9 h-9"
          title="Edit"
        >
          ✏️
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          color="danger"
          onPress={handleDelete}
          isLoading={isDeleting}
          className="w-9 h-9"
          title="Delete"
        >
          {!isDeleting && '🗑️'}
        </Button>
      </div>
    </div>
  )
}
