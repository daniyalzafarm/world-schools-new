import { icons } from 'lucide-react'

export type LucideIcon = { type: 'lucide'; name: string }
export type EmojiIcon = { type: 'emoji'; value: string }
export type CustomIcon = { type: 'custom'; svg: string }

export type IconValue = LucideIcon | EmojiIcon | CustomIcon

export interface IconRendererProps {
  icon: IconValue
  /** Size for lucide icons (px) */
  size?: number
  /** Extra class applied to the wrapper element */
  className?: string
}

export function IconRenderer({ icon, size = 20, className }: IconRendererProps) {
  if (icon.type === 'emoji') {
    return <span className={className}>{icon.value}</span>
  }

  if (icon.type === 'lucide') {
    const Icon = icons[icon.name as keyof typeof icons]
    return Icon ? <Icon size={size} className={className} /> : null
  }

  if (icon.type === 'custom') {
    return (
      <span
        className={className}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: icon.svg }}
      />
    )
  }

  return null
}
