'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addToast, Button, Card, CardBody, Chip, Tab, Tabs } from '@heroui/react'
import { useCampsStore } from '../../../stores/camps-store'
import {
  ArrowUpRight,
  Download,
  Edit,
  Eye,
  FilterX,
  ImageIcon,
  MapPin,
  Plus,
  Search,
  Tent,
  Trash2,
  Users,
} from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'
import type { Camp, CampStatus, CampType } from '../../../types/camps'
import { Input, SelectField, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import config from '@/config/config'
import * as campsService from '@/services/camps.services'

type TabFilter = 'all' | 'published' | 'draft' | 'archived'

interface ActiveFilters {
  location?: string
  type?: CampType
}

export default function CampsPage() {
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const { camps, statistics, fetchCamps, fetchStatistics, deleteCamp, resetWizard, isLoading } =
    useCampsStore()
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})
  const [displayedCampsCount, setDisplayedCampsCount] = useState(9) // Show 9 camps initially

  // Debounce search input with 500ms delay
  const debouncedSearch = useDebounce(searchInput, 500)

  // Get unique locations from camps for filter dropdown
  const uniqueLocations = useMemo(() => {
    const locations = new Set<string>()
    camps.forEach(camp => {
      if (camp.locationName) {
        locations.add(camp.locationName)
      }
    })
    return Array.from(locations).sort()
  }, [camps])

  // Fetch camps when filters change
  useEffect(() => {
    const filters: any = {}
    if (activeTab !== 'all') filters.status = activeTab
    if (debouncedSearch) filters.search = debouncedSearch
    if (activeFilters.location) filters.location = activeFilters.location
    if (activeFilters.type) filters.type = activeFilters.type

    fetchCamps(filters).catch(error => {
      console.error('Failed to fetch camps:', error)
      addToast({
        title: 'Error',
        description: 'Failed to load camps. Please try again.',
        color: 'danger',
      })
    })

    // Reset pagination when filters change
    setDisplayedCampsCount(9)
  }, [activeTab, debouncedSearch, activeFilters, fetchCamps])

  // Fetch statistics on mount
  useEffect(() => {
    fetchStatistics().catch(error => {
      console.error('Failed to fetch statistics:', error)
    })
  }, [fetchStatistics])

  // Calculate stats from statistics or camps data
  const stats = useMemo(() => {
    if (statistics) {
      return {
        total: statistics.totalCamps,
        published: statistics.publishedCamps,
        draft: statistics.draftCamps,
        archived: statistics.archivedCamps,
        bookings: statistics.totalBookings,
        sessions: statistics.activeSessions,
        rating: statistics.averageRating,
      }
    }
    // Fallback to calculating from camps array
    return {
      total: camps.length,
      published: camps.filter(c => c.status === 'published').length,
      draft: camps.filter(c => c.status === 'draft').length,
      archived: camps.filter(c => c.status === 'archived').length,
      bookings: 0,
      sessions: 0,
      rating: 0.0,
    }
  }, [camps, statistics])

  // Filter management
  const handleLocationFilter = (location: string | undefined) => {
    setActiveFilters(prev => ({ ...prev, location }))
  }

  const handleTypeFilter = (type: CampType | undefined) => {
    setActiveFilters(prev => ({ ...prev, type }))
  }

  // Pagination
  const displayedCamps = useMemo(() => {
    return camps.slice(0, displayedCampsCount)
  }, [camps, displayedCampsCount])

  const hasMoreCamps = camps.length > displayedCampsCount

  const hasActiveFilters = searchInput !== '' || !!activeFilters.location || !!activeFilters.type

  const handleClearFilters = () => {
    setSearchInput('')
    setActiveFilters({})
  }

  const handleLoadMore = () => {
    setDisplayedCampsCount(prev => prev + 9)
  }

  const handleCreateCamp = () => {
    // Reset wizard state to ensure clean slate for new camp creation
    resetWizard()
    router.push('/camps/create/basic-info')
  }

  const handleEditCamp = (campId: string) => {
    router.push(`/camps/${campId}/edit/basic-info`)
  }

  const handleViewCamp = async (camp: Camp) => {
    try {
      // Generate a preview token for the camp
      const token = await campsService.generatePreviewToken(camp.id)

      // Redirect to the booking app's camp page with preview token
      const bookingAppUrl = config.app.bookingAppUrl
      const campUrl = `${bookingAppUrl}/camps/${camp.slug}?preview=${token}`
      window.open(campUrl, '_blank')
    } catch (error) {
      console.error('Failed to generate preview token:', error)
      addToast({
        title: 'Error',
        description: 'Failed to open camp preview. Please try again.',
        color: 'danger',
      })
    }
  }

  const handleDeleteCamp = async (campId: string, campName: string) => {
    const confirmed = await confirm({
      title: 'Delete Camp',
      message: `Are you sure you want to delete "${campName}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (confirmed) {
      try {
        await deleteCamp(campId)
        addToast({
          title: 'Success',
          description: 'Camp deleted successfully.',
          color: 'success',
        })
      } catch (error) {
        console.error('Failed to delete camp:', error)
        addToast({
          title: 'Error',
          description: 'Failed to delete camp. Please try again.',
          color: 'danger',
        })
      }
    }
  }

  const getStatusColor = (status: CampStatus) => {
    switch (status) {
      case 'published':
        return 'success'
      case 'draft':
        return 'warning'
      case 'archived':
        return 'default'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: CampStatus) => {
    switch (status) {
      case 'published':
        return 'Active'
      case 'draft':
        return 'Draft'
      case 'archived':
        return 'Archived'
      default:
        return status
    }
  }

  const getAgeRangeText = (camp: Camp) => {
    if (!camp.ageGroups || camp.ageGroups.length === 0) return 'All ages'
    const minAge = Math.min(...camp.ageGroups.map(ag => ag.min))
    const maxAge = Math.max(...camp.ageGroups.map(ag => ag.max))
    return `Ages ${minAge}-${maxAge}`
  }

  const getCampImage = (camp: Camp) => {
    if (camp.photos && camp.photos.length > 0) {
      return camp.photos[0].url
    }
    return null // Return null to show placeholder
  }

  const getLocationText = (camp: Camp) => {
    if (camp.locationName) {
      return camp.locationName
    }
    if (camp.locationType === 'provider') {
      return 'Provider Location'
    }
    return 'Location TBD'
  }

  const isIncomplete = (camp: Camp) => {
    return camp.status === 'draft' && (!camp.photos || camp.photos.length === 0)
  }

  return (
    <PageSlot>
      <section className="space-y-6">
        {/* Page Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">My Camps</h1>
            <p className="mt-1 text-slate-500">Manage your camp listings and track performance</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="bordered"
              startContent={<Download className="h-4 w-4" />}
              className="hidden sm:flex"
            >
              Export
            </Button>
            <Button
              color="primary"
              startContent={<Plus className="h-4 w-4" />}
              onPress={handleCreateCamp}
            >
              Add New Camp
            </Button>
          </div>
        </header>

        {/* Stats Section */}
        <div>
          <h2 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">Overview</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border border-slate-200 dark:border-slate-800">
              <CardBody className="p-6">
                <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Camps
                </div>
                <div className="mb-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.total}
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-success">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>{stats.draft} new this month</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800">
              <CardBody className="p-6">
                <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Total Bookings
                </div>
                <div className="mb-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.bookings}
                </div>
                <div className="flex items-center gap-1 text-sm font-semibold text-success">
                  <ArrowUpRight className="h-4 w-4" />
                  <span>+12% vs last month</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800">
              <CardBody className="p-6">
                <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Active Sessions
                </div>
                <div className="mb-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.sessions}
                </div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Across all camps
                </div>
              </CardBody>
            </Card>

            <Card className="border border-slate-200 dark:border-slate-800">
              <CardBody className="p-6">
                <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                  Average Rating
                </div>
                <div className="mb-1 text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.rating.toFixed(1)}
                </div>
                <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  From reviews
                </div>
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Camps List Card */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardBody className="p-0">
            {/* Tabs */}
            <div className="flex border-b border-default-200 px-4 pt-3">
              <Tabs
                selectedKey={activeTab}
                onSelectionChange={key => setActiveTab(key as TabFilter)}
                variant="underlined"
                classNames={{
                  base: 'w-full',
                  tabList: 'p-0!',
                }}
              >
                <Tab
                  key="all"
                  title={
                    <span className="flex items-center gap-1.5">
                      All Camps
                      <Chip size="sm">{stats.total}</Chip>
                    </span>
                  }
                />
                <Tab
                  key="published"
                  title={
                    <span className="flex items-center gap-1.5">
                      Active
                      <Chip size="sm">{stats.published}</Chip>
                    </span>
                  }
                />
                <Tab
                  key="draft"
                  title={
                    <span className="flex items-center gap-1.5">
                      Draft
                      <Chip size="sm">{stats.draft}</Chip>
                    </span>
                  }
                />
                <Tab
                  key="archived"
                  title={
                    <span className="flex items-center gap-1.5">
                      Archived
                      <Chip size="sm">{stats.archived}</Chip>
                    </span>
                  }
                />
              </Tabs>
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-default-200 px-4 py-3">
              <Input
                placeholder="Search camps by name or location..."
                value={searchInput}
                onValueChange={setSearchInput}
                onClear={() => setSearchInput('')}
                isClearable
                startContent={<Search className="h-4 w-4 text-default-400" />}
                className="w-full max-w-sm shrink-0"
                classNames={{ input: 'text-sm' }}
              />
              <SelectField
                aria-label="location"
                placeholder="Select location"
                className="w-60 shrink-0"
                value={activeFilters.location}
                onChange={handleLocationFilter}
                options={uniqueLocations}
                isClearable
              />
              <SelectField
                aria-label="type"
                placeholder="Select type"
                className="w-44 shrink-0"
                value={activeFilters.type}
                onChange={value => handleTypeFilter(value as CampType | undefined)}
                options={[
                  { value: 'day', label: 'Day Camp' },
                  { value: 'residential', label: 'Residential Camp' },
                ]}
                isClearable
              />
              {hasActiveFilters && (
                <Button
                  variant="flat"
                  className="shrink-0"
                  startContent={<FilterX className="h-4 w-4" />}
                  onPress={handleClearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="px-4 py-12 text-center sm:px-6">
                <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primary dark:border-slate-800"></div>
                <p className="text-slate-600 dark:text-slate-400">Loading camps...</p>
              </div>
            ) : camps.length === 0 ? (
              <div className="px-4 py-20 text-center sm:px-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <Tent className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                  {hasActiveFilters ? 'No camps found' : 'No camps yet'}
                </h3>
                <p className="mb-6 text-slate-600 dark:text-slate-400">
                  {hasActiveFilters
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating your first camp listing. It only takes a few minutes!'}
                </p>
                {!hasActiveFilters && (
                  <Button
                    color="primary"
                    className="mx-auto max-w-max"
                    startContent={<Plus className="h-4 w-4" />}
                    onPress={handleCreateCamp}
                  >
                    Create Your First Camp
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
                {displayedCamps.map(camp => (
                  <Card
                    key={camp.id}
                    className="group cursor-pointer overflow-hidden border border-slate-200 transition-all hover:-translate-y-1 hover:shadow-xl dark:border-slate-800"
                  >
                    <CardBody className="p-0">
                      {/* Camp Image */}
                      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {getCampImage(camp) ? (
                          <img
                            src={getCampImage(camp)!}
                            alt={camp.name}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                            <ImageIcon className="h-16 w-16 text-slate-400 dark:text-slate-600" />
                          </div>
                        )}
                        <div className="absolute right-3 top-3">
                          <Chip
                            size="sm"
                            color={getStatusColor(camp.status)}
                            className="font-semibold"
                          >
                            {getStatusLabel(camp.status)}
                          </Chip>
                        </div>
                      </div>

                      {/* Camp Content */}
                      <div className="p-5">
                        <h3 className="mb-2 text-lg font-bold text-slate-900 dark:text-white">
                          {camp.name}
                        </h3>

                        {/* Camp Meta */}
                        <div className="mb-4 flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4" />
                            <span>{getLocationText(camp)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            <span>{getAgeRangeText(camp)}</span>
                          </div>
                        </div>

                        {/* Camp Stats or Progress */}
                        {camp.status === 'published' ? (
                          <div className="grid grid-cols-3 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                            <div className="text-center">
                              <div className="text-xl font-bold text-slate-900 dark:text-white">
                                0
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                Bookings
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl font-bold text-slate-900 dark:text-white">
                                0.0
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                Rating
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="text-xl font-bold text-slate-900 dark:text-white">
                                0
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400">
                                Sessions
                              </div>
                            </div>
                          </div>
                        ) : camp.status === 'draft' ? (
                          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${isIncomplete(camp) ? 65 : 85}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {isIncomplete(camp)
                                ? '65% complete - Add photos to publish'
                                : '85% complete - Almost ready!'}
                            </p>
                          </div>
                        ) : null}

                        {/* Action Buttons */}
                        <div className="mt-4 flex gap-2">
                          <Button
                            isIconOnly
                            color="primary"
                            className="flex-1"
                            size="sm"
                            onPress={() => handleEditCamp(camp.id)}
                            aria-label={isIncomplete(camp) ? 'Complete camp setup' : 'Edit camp'}
                            title={isIncomplete(camp) ? 'Complete camp setup' : 'Edit camp'}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            isIconOnly
                            variant="bordered"
                            className="flex-1"
                            size="sm"
                            onPress={() => handleViewCamp(camp)}
                            aria-label="View camp preview"
                            title="View camp preview"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {camp.status !== 'published' && (
                            <Button
                              isIconOnly
                              variant="bordered"
                              color="danger"
                              className="flex-1"
                              size="sm"
                              onPress={() => handleDeleteCamp(camp.id, camp.name)}
                              aria-label="Delete camp"
                              title="Delete camp"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {/* Footer */}
            {camps.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span className="text-sm text-default-500">
                  Showing {Math.min(displayedCampsCount, camps.length)} of {camps.length} camps
                </span>
                {hasMoreCamps && (
                  <Button color="primary" variant="bordered" onPress={handleLoadMore}>
                    Load More ({camps.length - displayedCampsCount} remaining)
                  </Button>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
