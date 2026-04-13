'use client'

import React from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { Button } from '@heroui/react'
import { cn } from '@world-schools/ui-web'

export interface HelpContactCtaProps {
  /** Link for "Contact Support" button. Defaults to /. */
  supportHref?: string
  className?: string
  /** When true, renders the same UI but the CTA does nothing (e.g. for preview mode). */
  previewMode?: boolean
}

/**
 * Reusable "Can't find what you're looking for?" CTA section.
 * Used on help home, category, and article pages.
 */
export function HelpContactCta({
  supportHref = '/support/tickets',
  className,
  previewMode = false,
}: HelpContactCtaProps) {
  return (
    <section className={cn('rounded-2xl bg-gray-50 p-8 text-center', className)}>
      <h2 className="mb-2 text-xl font-semibold text-secondary">
        Can&apos;t find what you&apos;re looking for?
      </h2>
      <p className="mb-5 text-sm text-gray-500">
        Our support team is here to help with any questions.
      </p>
      <Button
        {...(!previewMode && {
          as: Link,
          href: supportHref,
        })}
        color="secondary"
        startContent={<MessageCircle size={18} strokeWidth={2} />}
        size="lg"
      >
        Contact Support
      </Button>
    </section>
  )
}
