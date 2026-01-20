'use client'

import { useEffect, useState } from 'react'

interface NavLink {
  href: string
  label: string
}

interface InnerPageNavProps {
  links: NavLink[]
}

export function InnerPageNav({ links }: InnerPageNavProps) {
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => {
      const sections = links.map(link => document.querySelector(link.href))
      const scrollPosition = window.scrollY + 100

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section) {
          const sectionTop = (section as HTMLElement).offsetTop
          if (scrollPosition >= sectionTop) {
            setActiveSection(links[i].href)
            break
          }
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [links])

  const scrollToSection = (href: string, e: React.MouseEvent) => {
    e.preventDefault()
    const element = document.querySelector(href)
    if (element) {
      const offset = 80
      const elementPosition = (element as HTMLElement).offsetTop - offset
      window.scrollTo({ top: elementPosition, behavior: 'smooth' })
    }
  }

  return (
    <div className="sticky top-0 bg-white border-b border-gray-300 z-50">
      <div className="max-w-screen-2xl mx-auto px-5 md:px-20 lg:px-32">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-2.5">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide flex-1">
            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={e => scrollToSection(link.href, e)}
                className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${
                  activeSection === link.href
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex gap-3 shrink-0">
            <button className="text-xl text-gray-900 hover:opacity-70 transition-opacity">⋮</button>
          </div>
        </div>
      </div>
    </div>
  )
}
