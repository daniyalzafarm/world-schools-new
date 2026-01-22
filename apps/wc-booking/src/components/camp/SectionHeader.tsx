interface SectionHeaderProps {
  title: string
  icon?: string
  className?: string
  id?: string
}

export function SectionHeader({ title, icon, className = '', id }: SectionHeaderProps) {
  return (
    <h2
      id={id}
      className={`text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2 ${className}`}
    >
      {icon && <span className="text-2xl">{icon}</span>}
      {title}
    </h2>
  )
}

export function SectionSubheader({ title, className = '' }: { title: string; className?: string }) {
  return <h3 className={`text-base font-semibold text-gray-900 mb-3 ${className}`}>{title}</h3>
}
