import type { ArticleType } from '@world-schools/wc-types'

const STYLES: Record<string, { label: string; className: string }> = {
  how_to: {
    label: 'How-to',
    className:
      'rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-700',
  },
  reference: {
    label: 'Reference',
    className:
      'rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-600',
  },
  faq: {
    label: 'FAQ',
    className:
      'rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700',
  },
  policy: {
    label: 'Policy',
    className:
      'rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600',
  },
}

export function articleTypeLabel(articleType: ArticleType | string): {
  label: string
  className: string
} {
  return (
    STYLES[articleType] ?? {
      label: String(articleType),
      className:
        'rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600',
    }
  )
}
