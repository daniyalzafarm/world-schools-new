'use client'

import { Section } from './section'

const STEPS = [
  {
    number: '1',
    emoji: '👶',
    title: 'Add your children',
    description: 'Tell us about each child so we can match camps to their age and interests.',
  },
  {
    number: '2',
    emoji: '🔍',
    title: 'Browse camps',
    description: 'Filter thousands of camps by location, dates, and what your child loves.',
  },
  {
    number: '3',
    emoji: '🎉',
    title: 'Book with confidence',
    description: 'Message providers, compare options, and book in just a few clicks.',
  },
]

export function HowItWorksGrid() {
  return (
    <Section title="How it works">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEPS.map(step => (
          <div
            key={step.number}
            className="rounded-2xl border border-default-200 bg-background p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-50 text-base font-semibold text-primary-700">
                {step.number}
              </div>
              <span className="text-2xl">{step.emoji}</span>
            </div>
            <h3 className="mb-1 text-base font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm text-default-500">{step.description}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}
