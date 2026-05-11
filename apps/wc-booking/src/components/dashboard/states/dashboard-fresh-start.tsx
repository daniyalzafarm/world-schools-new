'use client'

import { GreetingHeader } from '../greeting-header'
import { WelcomeHero } from '../welcome-hero'
import { HowItWorksGrid } from '../how-it-works-grid'

export function DashboardFreshStart() {
  return (
    <>
      <GreetingHeader subtitle="Welcome to World Camps — let's find an unforgettable experience for your family." />
      <WelcomeHero
        emoji="👋"
        title="Welcome to World Camps!"
        subtitle="Add your first child to start discovering camps tailored to their age and interests."
        ctaLabel="Add your first child"
        ctaHref="/account/children/new"
      />
      <HowItWorksGrid />
    </>
  )
}
