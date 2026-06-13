import { isSessionBookable } from '@world-schools/wc-utils'
import type { Camp } from '@/types/camps'
import type { CampReviewsData } from '@/types/reviews'
import type { Session } from '@/types/sessions'

/**
 * Builds a schema.org JSON-LD graph for a camp profile page.
 *
 * Only fields backed by real data are emitted. The camp's dated sessions map to
 * Event / EventSeries (with Offer pricing + availability), reviews map to
 * AggregateRating + Review, plus a BreadcrumbList and (optional) FAQPage.
 *
 * Validate output with Google's Rich Results Test; the chosen types are
 * eligible for event + review-snippet rich results.
 */

type JsonLdNode = Record<string, unknown>

interface BuildCampJsonLdArgs {
  camp: Camp
  reviews: CampReviewsData | null
  currency: string
  faqItems: { question: string; answer: string }[]
  /** Public origin without trailing slash, e.g. `https://world-camps.org`. */
  baseUrl: string
}

function lowestSessionPrice(s: Session): number | null {
  if (typeof s.price === 'number') return s.price
  const prices = (s.ageGroupPrices ?? [])
    .map(a => a.price)
    .filter((p): p is number => typeof p === 'number')
  return prices.length ? Math.min(...prices) : null
}

function sessionAvailability(s: Session): string {
  const spotsLeft =
    s.totalSpots != null && s.bookedCount != null
      ? s.totalSpots - s.bookedCount
      : (s.totalSpots ?? null)
  return spotsLeft != null && spotsLeft <= 0
    ? 'https://schema.org/SoldOut'
    : 'https://schema.org/InStock'
}

export function buildCampJsonLd({
  camp,
  reviews,
  currency,
  faqItems,
  baseUrl,
}: BuildCampJsonLdArgs): JsonLdNode {
  const campUrl = `${baseUrl}/camp/${camp.slug}`
  const graph: JsonLdNode[] = []

  const images = (camp.photos ?? []).map(p => p.url).filter(Boolean)
  const gbp = camp.provider?.googleBusinessProfile

  // ── Place (location) ──────────────────────────────────────────────
  const place: JsonLdNode = { '@type': 'Place', name: camp.locationName || camp.name }
  const address: JsonLdNode = { '@type': 'PostalAddress' }
  if (camp.locationAddress) address.streetAddress = camp.locationAddress
  const locality = gbp?.city || camp.provider?.legalCity
  if (locality) address.addressLocality = locality
  if (camp.provider?.legalStateProvince) address.addressRegion = camp.provider.legalStateProvince
  if (camp.provider?.legalPostalCode) address.postalCode = camp.provider.legalPostalCode
  const country = gbp?.country || camp.provider?.legalCountry
  if (country) address.addressCountry = country
  if (Object.keys(address).length > 1) place.address = address
  if (camp.locationLat != null && camp.locationLng != null) {
    place.geo = {
      '@type': 'GeoCoordinates',
      latitude: camp.locationLat,
      longitude: camp.locationLng,
    }
  }

  // ── Organizer ─────────────────────────────────────────────────────
  const organizer: JsonLdNode | undefined = camp.provider
    ? {
        '@type': 'Organization',
        name: camp.provider.legalCompanyName || gbp?.businessName || 'World Camps',
        ...(camp.provider.website ? { url: camp.provider.website } : {}),
      }
    : undefined

  // ── Aggregate rating + reviews ────────────────────────────────────
  const aggregateRating =
    reviews?.overallRating != null && reviews.totalReviews > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: reviews.overallRating,
          reviewCount: reviews.totalReviews,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined

  const reviewNodes = (reviews?.reviews ?? [])
    .filter(r => r.rating != null && (r.reviewText?.trim()?.length ?? 0) > 0)
    .slice(0, 5)
    .map(r => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      ...(r.publishedAt ? { datePublished: r.publishedAt } : {}),
      reviewBody: r.reviewText,
      author: {
        '@type': 'Person',
        name: [r.reviewer.firstName, r.reviewer.lastName].filter(Boolean).join(' ') || 'Anonymous',
      },
    }))

  // ── Main camp entity (Event / EventSeries from sessions) ──────────
  const bookableSessions = (camp.sessions ?? []).filter(
    s => s.status === 'published' && isSessionBookable(s) && s.startDate && s.endDate
  )

  if (bookableSessions.length > 0) {
    const prices = bookableSessions.map(lowestSessionPrice).filter((p): p is number => p != null)
    const startDates = bookableSessions.map(s => s.startDate).sort()
    const endDates = bookableSessions.map(s => s.endDate).sort()

    const buildEvent = (s: Session): JsonLdNode => {
      const price = lowestSessionPrice(s)
      return {
        '@type': 'Event',
        name: s.name || camp.name,
        startDate: s.startDate,
        endDate: s.endDate,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: place,
        ...(price != null
          ? {
              offers: {
                '@type': 'Offer',
                price,
                priceCurrency: currency,
                availability: sessionAvailability(s),
                url: campUrl,
              },
            }
          : {}),
      }
    }

    const main: JsonLdNode = {
      '@type': bookableSessions.length > 1 ? 'EventSeries' : 'Event',
      '@id': `${campUrl}#camp`,
      name: camp.name,
      description: camp.description,
      url: campUrl,
      ...(images.length ? { image: images } : {}),
      startDate: startDates[0],
      endDate: endDates[endDates.length - 1],
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      eventStatus: 'https://schema.org/EventScheduled',
      location: place,
      ...(organizer ? { organizer } : {}),
      ...(prices.length
        ? {
            offers: {
              '@type': 'AggregateOffer',
              lowPrice: Math.min(...prices),
              highPrice: Math.max(...prices),
              priceCurrency: currency,
              offerCount: bookableSessions.length,
              url: campUrl,
            },
          }
        : {}),
      ...(aggregateRating ? { aggregateRating } : {}),
      ...(reviewNodes.length ? { review: reviewNodes } : {}),
      ...(bookableSessions.length > 1 ? { subEvent: bookableSessions.map(buildEvent) } : {}),
    }
    graph.push(main)
  }

  // ── Breadcrumb (Home → camp) ──────────────────────────────────────
  graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'World Camps', item: baseUrl },
      { '@type': 'ListItem', position: 2, name: camp.name, item: campUrl },
    ],
  })

  // ── FAQ ───────────────────────────────────────────────────────────
  if (faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqItems.map(f => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    })
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}
