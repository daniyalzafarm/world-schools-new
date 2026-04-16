'use client'

import { ChevronLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'

interface BackButtonProps {
  href?: string
}

export function BackButton({ href }: BackButtonProps) {
  const router = useRouter()
  return (
    <Button
      isIconOnly
      variant="flat"
      size="sm"
      radius="full"
      className="lg:hidden -ml-2 shrink-0"
      onPress={() => (href ? router.push(href) : router.back())}
      aria-label="Go back"
    >
      <ChevronLeft size={20} />
    </Button>
  )
}
