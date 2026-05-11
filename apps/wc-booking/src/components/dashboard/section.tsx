import React from 'react'
import Link from 'next/link'

interface SectionProps {
  title: string
  linkHref?: string
  linkLabel?: string
  className?: string
  children: React.ReactNode
}

export function Section({ title, linkHref, linkLabel, className, children }: SectionProps) {
  return (
    <section className={className ?? 'mb-8'}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="text-sm font-medium text-foreground hover:text-primary-700"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
