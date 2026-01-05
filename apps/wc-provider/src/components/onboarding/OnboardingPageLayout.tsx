'use client'

import React from 'react'
import { OnboardingTopBar } from './OnboardingTopBar'

interface OnboardingPageLayoutProps {
  breadcrumb: string
  showAutoSave?: boolean
  showTrustScore?: boolean
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * OnboardingPageLayout Component
 *
 * Provides a consistent three-section layout for onboarding pages:
 * 1. Fixed top bar (OnboardingTopBar) - 61px height, reserved space
 * 2. Scrollable content area - fills remaining space, scrollbar visible
 * 3. Fixed footer (navigation buttons) - ~72px height, reserved space
 *
 * Layout structure:
 * - Uses flexbox with reserved space for top bar and footer
 * - Top bar and footer are sticky/fixed but space is reserved
 * - Content area scrolls independently with visible scrollbar
 * - Scrollbar is NOT hidden behind fixed elements
 * - No content is hidden behind fixed elements
 *
 * Key improvements:
 * - Scrollbar is always visible and accessible
 * - Proper spacing prevents content overlap
 * - Works on all screen sizes (mobile and desktop)
 * - Consistent behavior across all onboarding pages
 */
export function OnboardingPageLayout({
  breadcrumb,
  showAutoSave = true,
  showTrustScore = true,
  children,
  footer,
}: OnboardingPageLayoutProps) {
  // For backward compatibility: if showAutoSave is explicitly set to false, hide trust score
  const displayTrustScore = showAutoSave !== false && showTrustScore

  return (
    <div className="flex h-full flex-col">
      {/* Top Bar - Sticky with reserved space */}
      <div className="sticky top-0 z-40 shrink-0">
        <OnboardingTopBar breadcrumb={breadcrumb} showTrustScore={displayTrustScore} />
      </div>

      {/* Scrollable Content Area - fills remaining space */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-12 py-8">{children}</div>
      </div>

      {/* Footer - Sticky with reserved space */}
      {footer && (
        <div className="sticky bottom-0 z-40 shrink-0 border-t border-default-100 bg-white px-12 py-4">
          {footer}
        </div>
      )}
    </div>
  )
}
