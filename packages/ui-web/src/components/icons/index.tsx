import React from 'react'
import Image from 'next/image'

interface IconProps {
  name: string
  className?: string
  size?: number
}

export const Icon: React.FC<IconProps> = ({ name, className = '', size = 24 }) => {
  const iconPath = `/icons/${name}.svg`

  return (
    <Image
      src={iconPath}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block' }}
    />
  )
}
