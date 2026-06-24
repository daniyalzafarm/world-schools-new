'use client'

import { Globe, Languages as LanguagesIcon, MapPin, Repeat } from 'lucide-react'
import {
  getCountryDemonym,
  getCountryFlag,
  getCountryName,
  getLanguageName,
  StarRating,
  UserAvatar,
} from '@world-schools/ui-web'
import { ageFromDateOfBirth } from '@world-schools/wc-frontend-utils'
import type { ProviderContactProfile } from '@/services/contact-profile.services'

// ─── Generic section wrapper ──────────────────────────────────────────────────

export function PanelSection({
  title,
  titleSuffix,
  children,
}: {
  title?: string
  titleSuffix?: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-default-200 px-6 py-5 last:border-b-0 dark:border-slate-700">
      {title ? (
        <h3 className="mb-3 text-lg font-semibold text-secondary">
          {title}
          {titleSuffix ? (
            <span className="ml-2 text-sm font-normal text-default-400">{titleSuffix}</span>
          ) : null}
        </h3>
      ) : null}
      {children}
    </div>
  )
}

// ─── Identity (name, returning badge, summary, avatar) ────────────────────────

export function IdentitySection({ data }: { data: ProviderContactProfile }) {
  const name = [data.user.firstName, data.user.lastName].filter(Boolean).join(' ').trim() || 'User'
  return (
    <div className="flex items-start justify-between gap-4 border-b border-default-200 px-6 py-6 dark:border-slate-700">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-secondary">{name}</h2>
          {data.isReturning ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700 dark:bg-primary-500/15">
              <Repeat className="h-3 w-3" />
              Returning
            </span>
          ) : null}
        </div>
        {data.user.bio ? (
          <p className="mt-1 text-sm text-default-500 whitespace-pre-line">{data.user.bio}</p>
        ) : null}
      </div>
      <UserAvatar
        photoUrl={data.user.profilePhotoUrl ?? undefined}
        fullName={name}
        variant="flat"
        className="w-14 h-14 text-lg"
      />
    </div>
  )
}

// ─── About (nationality, location, languages) ─────────────────────────────────

function AboutRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm text-secondary">
      <span className="shrink-0 text-default-400">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

export function AboutSection({ data }: { data: ProviderContactProfile }) {
  const firstName = data.user.firstName?.trim() || 'them'
  const demonym = data.nationality
    ? getCountryDemonym(data.nationality) || getCountryName(data.nationality)
    : null
  const flag = data.nationality ? getCountryFlag(data.nationality) : null
  const location = [data.user.city, data.user.country ? getCountryName(data.user.country) : null]
    .filter(Boolean)
    .join(', ')
  const spoken = data.languages.map(getLanguageName).filter(Boolean).join(', ')

  if (!demonym && !location && !spoken) return null

  return (
    <PanelSection title={`About ${firstName}`}>
      <div className="flex flex-col">
        {demonym ? (
          <AboutRow icon={<Globe className="h-4 w-4" />}>
            {flag ? `${flag} ` : ''}
            {demonym}
          </AboutRow>
        ) : null}
        {location ? (
          <AboutRow icon={<MapPin className="h-4 w-4" />}>Lives in {location}</AboutRow>
        ) : null}
        {spoken ? (
          <AboutRow icon={<LanguagesIcon className="h-4 w-4" />}>Speaks {spoken}</AboutRow>
        ) : null}
      </div>
    </PanelSection>
  )
}

// ─── Children ─────────────────────────────────────────────────────────────────

function genderLabel(gender: string | null): string | null {
  if (!gender) return null
  if (gender === 'girl') return 'Female'
  if (gender === 'boy') return 'Male'
  return gender.charAt(0).toUpperCase() + gender.slice(1)
}

export function ChildrenSection({ data }: { data: ProviderContactProfile }) {
  if (!data.children.length) return null
  return (
    <PanelSection title="Children" titleSuffix="(from profile)">
      <div className="flex flex-col gap-3">
        {data.children.map(child => {
          const name = [child.firstName, child.lastName].filter(Boolean).join(' ').trim()
          const age = ageFromDateOfBirth(child.dateOfBirth)
          const gender = genderLabel(child.gender)
          const meta = [age !== null ? `${age} years old` : null, gender]
            .filter(Boolean)
            .join(' · ')
          const langs = child.languages.map(getLanguageName).filter(Boolean).join(', ')
          return (
            <div
              key={child.id}
              className="rounded-xl border border-default-200 p-4 dark:border-slate-700"
            >
              <p className="font-semibold text-secondary">{name}</p>
              {meta ? <p className="mt-0.5 text-sm text-default-500">{meta}</p> : null}
              {langs ? (
                <div className="mt-3 flex items-center justify-between border-t border-default-200 pt-3 text-sm dark:border-slate-700">
                  <span className="text-default-500">Languages</span>
                  <span className="font-medium text-secondary">{langs}</span>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </PanelSection>
  )
}

// ─── Their review of you ──────────────────────────────────────────────────────

export function ReviewSection({ data }: { data: ProviderContactProfile }) {
  const review = data.reviewOfProvider
  if (!review) return null
  const date = review.publishedAt
    ? new Date(review.publishedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null
  return (
    <PanelSection title="Their review of you">
      <div className="rounded-xl bg-default-50 p-4 dark:bg-slate-800/50">
        {review.reviewText ? (
          <p className="text-sm italic text-secondary">&ldquo;{review.reviewText}&rdquo;</p>
        ) : null}
        <div className="mt-2 flex items-center gap-2 text-xs text-default-400">
          {date ? <span>{date}</span> : null}
          {date ? <span>·</span> : null}
          <StarRating rating={review.averageRating} maxRating={5} showRating={false} size={13} />
        </div>
      </div>
    </PanelSection>
  )
}
