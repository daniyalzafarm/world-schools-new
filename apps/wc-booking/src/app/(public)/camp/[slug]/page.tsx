import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import config from '@/config/config'
import {
  getCampAddOnsServer,
  getCampBySlugServer,
  getCampReviewsServer,
} from '@/services/camps.server'
import { getCampCurrency } from '@/utils/currency'
import { buildCampJsonLd } from '@/utils/camp-jsonld'
import {
  buildActivitiesFaq,
  buildAgesFaq,
  buildCancellationFaq,
  buildIncludedFaq,
  buildMealsFaq,
  buildTransportFaq,
  buildTypeFaq,
} from '@/utils/faq-builders'
import { CampPageContent } from '@/components/camp/CampPageContent'
import type { Camp } from '@/types/camps'
import type { CampBookingAddOn } from '@/types/camp-booking'

interface CampProfilePageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ preview?: string }>
}

/** Mirrors the camp page's FAQ derivation so the FAQ JSON-LD matches what renders. */
function buildCampFaqItems(camp: Camp, addOns: CampBookingAddOn[], currency: string) {
  return [
    buildAgesFaq(camp.ageGroups ?? []),
    buildTypeFaq(camp.type),
    buildActivitiesFaq(camp.campFocus),
    buildIncludedFaq(camp.whatsIncluded),
    buildMealsFaq(camp.meals),
    buildCancellationFaq(
      camp.provider?.settings?.cancellationPolicy,
      camp.provider?.settings?.cancellationPolicyCustom
    ),
    buildTransportFaq(addOns, currency),
  ].filter(Boolean) as { question: string; answer: string }[]
}

function truncate(text: string | undefined, max = 160): string {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

export async function generateMetadata({
  params,
  searchParams,
}: CampProfilePageProps): Promise<Metadata> {
  const { slug } = await params
  const { preview } = await searchParams
  const camp = await getCampBySlugServer(slug, preview).catch(() => null)
  if (!camp) return { title: 'Camp Not Found' }

  const primaryPhoto = camp.photos?.find(p => p.isPrimary)?.url || camp.photos?.[0]?.url
  const description =
    truncate(camp.description) ||
    `Discover ${camp.name} on World Camps — dates, pricing, activities and reviews.`
  const path = `/camp/${slug}`

  return {
    title: camp.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title: camp.name,
      description,
      ...(primaryPhoto ? { images: [{ url: primaryPhoto }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: camp.name,
      description,
      ...(primaryPhoto ? { images: [primaryPhoto] } : {}),
    },
    // Draft previews (?preview=) must never be indexed.
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function CampProfilePage({ params, searchParams }: CampProfilePageProps) {
  const { slug } = await params
  const { preview } = await searchParams

  const camp = await getCampBySlugServer(slug, preview).catch(() => null)
  if (!camp) notFound()

  const [campReviews, addOns] = await Promise.all([
    getCampReviewsServer(camp.id).catch(() => null),
    getCampAddOnsServer(camp.id).catch(() => [] as CampBookingAddOn[]),
  ])

  const currency = getCampCurrency(camp, `camp:${camp.slug}`)
  const faqItems = buildCampFaqItems(camp, addOns, currency)
  const jsonLd = buildCampJsonLd({
    camp,
    reviews: campReviews,
    currency,
    faqItems,
    baseUrl: config.app.metadataBase.replace(/\/+$/, ''),
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CampPageContent camp={camp} campReviews={campReviews} addOns={addOns} />
    </>
  )
}
