import { Accordion, AccordionItem } from '@heroui/react'
import { ChevronDown } from 'lucide-react'
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
          trigger: 'cursor-pointer py-4',
          title: 'font-medium text-gray-900',
          content: 'py-4 text-gray-900 leading-relaxed',
          indicator: 'text-gray-400 rotate-0 data-[open=true]:rotate-180',
        }}
      >
        {items.map((item, index) => (
          <AccordionItem
            key={index}
            aria-label={item.question}
            title={item.question}
            indicator={<ChevronDown size={16} />}
          >
            {item.answer}
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
