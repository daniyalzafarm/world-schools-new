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
      className={`text-[22px] font-bold text-[#222222] mb-4 flex items-center gap-2 ${className}`}
    >
      {icon && <span className="text-[24px]">{icon}</span>}
      {title}
    </h2>
  )
}

export function SectionSubheader({ title, className = '' }: { title: string; className?: string }) {
  return <h3 className={`text-[16px] font-semibold text-[#222222] mb-3 ${className}`}>{title}</h3>
}
