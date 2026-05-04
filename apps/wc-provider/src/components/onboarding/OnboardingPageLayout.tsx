'use client'

import React from 'react'
import { OnboardingTopBar } from './OnboardingTopBar'

interface OnboardingPageLayoutProps {
  breadcrumb: string
  showAutoSave?: boolean
  showTrustScore?: boolean
  children: React.ReactNode
  footer?: React.ReactNode
  rightSidebar?: React.ReactNode
}

/**
 * OnboardingPageLayout Component
 *
 * Provides a two-column layout for onboarding pages with optional right sidebar:
 * - Left column: Top bar + scrollable content + footer (main content area)
 * - Right column: Calculator/sidebar (full height, independent scroll)
 *
 * Layout structure (matching reference HTML):
 * - Main wrapper: flex container with two columns
 * - Left column: flex-1, contains top bar, content, and footer
 * - Right sidebar: fixed width (480px lg, 520px xl), full height
 * - Footer: positioned at bottom of LEFT column only (not full width)
 * - Right sidebar extends independently to bottom alongside footer
 *
 * Key features:
 * - Footer only spans main content area (left column)
 * - Right sidebar is full height and scrollable independently
 * - Matches reference HTML 2-column structure exactly
 * - Responsive: sidebar hidden on mobile/tablet (< lg breakpoint)
 */
export function OnboardingPageLayout({
  breadcrumb,
  showAutoSave = true,
  showTrustScore = true,
  children,
  footer,
  rightSidebar,
}: OnboardingPageLayoutProps) {
  // For backward compatibility: if showAutoSave is explicitly set to false, hide trust score
  const displayTrustScore = showAutoSave !== false && showTrustScore

  return (
    <div className="flex h-full">
      {/* Left Column: Main Content Area (Top Bar + Content + Footer) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar - Sticky at top of left column */}
        <div className="sticky top-0 z-40 shrink-0">
          <OnboardingTopBar breadcrumb={breadcrumb} showTrustScore={displayTrustScore} />
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-12 py-8">{children}</div>
        </div>

        {/* Footer - Sticky at bottom of left column only */}
        {footer && (
          <div className="sticky bottom-0 z-40 h-20 shrink-0 border-t border-default-200 bg-white px-12 py-4">
            <div className="mx-auto max-w-4xl px-12"> {footer}</div>
          </div>
        )}
      </div>

      {/* Right Column: Sidebar (Full Height, Independent Scroll) */}
      {rightSidebar && (
        <div className="hidden h-full shrink-0 overflow-y-auto border-l border-default-200 bg-background lg:block lg:w-[480px] xl:w-[520px]">
          {rightSidebar}
        </div>
      )}
    </div>
  )
}
