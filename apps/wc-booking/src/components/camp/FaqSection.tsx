import { Accordion, AccordionItem } from '@heroui/react'
import type { FaqItem } from '../../utils/faq-builders'

interface FaqSectionProps {
  items: FaqItem[]
}

export function FaqSection({ items }: FaqSectionProps) {
  if (!items?.length) return null

  return (
    <section id="faq" className="mb-10 scroll-mt-14 md:mb-12 md:scroll-mt-16">
      <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
        Frequently Asked Questions
      </h2>
      <Accordion
        variant="light"
        className="px-0"
        itemClasses={{
          base: 'border-b border-gray-200 last:border-b-0',
          trigger: 'cursor-pointer p-4 hover:bg-slate-50',
          title: 'text-base font-semibold text-gray-900',
          content: 'p-4 text-base text-gray-600 leading-relaxed',
          indicator: 'text-gray-400',
        }}
      >
        {items.map((item, index) => (
          <AccordionItem key={index} aria-label={item.question} title={item.question}>
            {item.answer}
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
