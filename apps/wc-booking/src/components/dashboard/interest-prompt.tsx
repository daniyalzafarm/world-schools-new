'use client'

import Link from 'next/link'
import { Button } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import { type Child, getChildDisplayName } from '@/types/child'

interface InterestPromptProps {
  children: Child[]
}

export function InterestPrompt({ children }: InterestPromptProps) {
  const firstName = children[0] ? getChildDisplayName(children[0]) : null
  return (
    <div className="mb-8 rounded-3xl bg-gradient-to-br from-primary-50 to-default-100 p-6 sm:p-8">
      <h2 className="mb-2 text-xl font-bold text-secondary-500 sm:text-2xl">
        {firstName ? `Find the perfect camp for ${firstName}` : 'Find the perfect camp'}
      </h2>
      <p className="mb-6 max-w-2xl text-sm text-default-500 sm:text-base">
        Browse camps tailored to your family. Filter by age, location, and the activities your kids
        love most.
      </p>
      <Button
        as={Link}
        href="/camps"
        color="secondary"
        radius="lg"
        endContent={<ArrowRight size={18} />}
      >
        Browse camps
      </Button>
    </div>
  )
}
