'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardBody, Chip } from '@heroui/react'
import { MapPin, Users } from 'lucide-react'
import TopNav from '@/components/layout/top-nav'
import { getCampBySlug } from '@/services/camps.services'
import type { Camp } from '@/types/camps'
import config from '@/config/config'

export default function CampPage() {
  const params = useParams()
  const router = useRouter()
  const campSlug = params.campSlug as string

  const [camp, setCamp] = useState<Camp | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCamp = async () => {
      try {
        setIsLoading(true)
        const campData = await getCampBySlug(campSlug)
        setCamp(campData)
      } catch (err: any) {
        console.error('Failed to fetch camp:', err)
        setError(err.message || 'Failed to load camp')
      } finally {
        setIsLoading(false)
      }
    }

    if (campSlug) {
      fetchCamp().catch(error => {
        console.error('Failed to fetch camp:', error)
      })
    }
  }, [campSlug])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-primary"></div>
              <p className="text-gray-600">Loading camp details...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !camp) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopNav />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Card className="border border-red-200">
            <CardBody className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-900">Camp Not Found</h3>
              <p className="mb-6 text-gray-600">
                {error || 'The camp you are looking for does not exist or is not available.'}
              </p>
              <button
                onClick={() => router.push('/')}
                className="rounded-lg bg-primary px-6 py-2 text-white hover:bg-primary-600"
              >
                Go Home
              </button>
            </CardBody>
          </Card>
        </main>
      </div>
    )
  }

  const getAgeRangeText = () => {
    if (!camp.ageGroups || camp.ageGroups.length === 0) return 'All ages'
    const minAge = Math.min(...camp.ageGroups.map(ag => ag.min))
    const maxAge = Math.max(...camp.ageGroups.map(ag => ag.max))
    return `Ages ${minAge}-${maxAge}`
  }

  const getImageUrl = (url: string) => {
    if (!url) return ''
    // If URL is already absolute, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // Otherwise, prepend the storage URL
    const storageUrl = config.app.storageUrl.endsWith('/')
      ? config.app.storageUrl
      : `${config.app.storageUrl}/`
    return `${storageUrl}${url}`
  }

  const primaryPhoto = camp.photos?.find(p => p.isPrimary)?.url || camp.photos?.[0]?.url
  const primaryPhotoUrl = primaryPhoto ? getImageUrl(primaryPhoto) : null

  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="mb-8">
          {primaryPhotoUrl && (
            <div className="mb-6 aspect-video w-full overflow-hidden rounded-lg">
              <img src={primaryPhotoUrl} alt={camp.name} className="h-full w-full object-cover" />
            </div>
          )}

          <div className="mb-4 flex items-start justify-between">
            <div>
              <h1 className="mb-2 text-3xl font-bold text-gray-900">{camp.name}</h1>
              <div className="flex flex-wrap gap-4 text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>{camp.locationName || 'Location TBD'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span>{getAgeRangeText()}</span>
                </div>
              </div>
            </div>
            <Chip color="primary" variant="flat" size="lg">
              {camp.type === 'day' ? 'Day Camp' : 'Residential Camp'}
            </Chip>
          </div>
        </div>

        {/* Description */}
        <Card className="mb-6">
          <CardBody>
            <h2 className="mb-4 text-xl font-bold text-gray-900">About This Camp</h2>
            <p className="whitespace-pre-wrap text-gray-700">{camp.description}</p>
          </CardBody>
        </Card>

        {/* Coming Soon Notice */}
        <Card className="border border-blue-200 bg-blue-50">
          <CardBody className="text-center">
            <p className="text-blue-900">
              🚧 Booking functionality coming soon! Check back later to reserve your spot.
            </p>
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
