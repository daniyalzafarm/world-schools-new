'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Accordion, AccordionItem, Button, Chip, Progress } from '@heroui/react'
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  DollarSign,
  Globe,
  GraduationCap,
  Home,
  Languages,
  Laptop,
  MapPin,
  Palette,
  Trophy,
  Users,
} from 'lucide-react'
import ImageGallery from 'react-image-gallery'
import { StarRating } from '@world-schools/ui-web'
import { useConversationStore } from '@/stores/conversation-store'
import { conversationData } from '@/data/conversations'
import type { Conversation } from '@/types/conversation'

export default function SchoolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { userConversations, setUserConversations } = useConversationStore()
  const conversationId = params.id as string
  const [conversation, setConversation] = useState<Conversation | null>(null)

  // Initialize conversation data and find conversation
  useEffect(() => {
    // Always ensure we have the conversation data
    if (userConversations.length === 0) {
      setUserConversations(conversationData)
    }

    // Try to find conversation from store first, then fallback to static data
    let foundConversation = userConversations.find(conv => conv.id === conversationId)

    // Fallback to static data if store is empty
    foundConversation ??= conversationData.find(conv => conv.id === conversationId)

    if (foundConversation) {
      setConversation(foundConversation)
    } else {
      // Only redirect if we're sure the conversation doesn't exist
      setTimeout(() => {
        router.push('/messages')
      }, 2000)
    }
  }, [conversationId, userConversations, setUserConversations, router])

  const handleBack = () => {
    router.push(`/messages/${conversationId}`)
  }

  // Mock school data based on conversation name - in a real app this would come from an API
  const getSchoolData = (schoolName: string) => {
    const baseData = {
      description:
        'A leading educational institution committed to excellence in learning and character development.',
      location: 'Austin, TX',
      established: '1995',
      studentCount: '850',
      rating: 4.8,
      reviewCount: 127,
      curriculum: ['International Baccalaureate', 'Advanced Placement'],
      gradeRange: 'K-12',
      tuitionRange: '$15,000 - $25,000',
      facilities: ['Science Labs', 'Sports Complex', 'Arts Center', 'Library'],
      languages: ['English', 'Spanish', 'French'],
      accreditation: ['IB World School', 'SACS CASI'],
    }

    // Customize based on school name
    switch (schoolName) {
      case 'Riverside Elementary School':
        return {
          ...baseData,
          description:
            'A nurturing elementary school focused on building strong foundations in learning and character.',
          gradeRange: 'K-5',
          studentCount: '420',
          tuitionRange: '$12,000 - $18,000',
        }
      case 'Oakwood High School':
        return {
          ...baseData,
          description:
            'A comprehensive high school preparing students for college and career success.',
          gradeRange: '9-12',
          studentCount: '1,200',
          tuitionRange: '$18,000 - $28,000',
        }
      default:
        return baseData
    }
  }

  const schoolData = conversation ? getSchoolData(conversation.name) : null

  // School highlights for tiles - based on user preferences
  const schoolHighlights = [
    {
      title: 'Location',
      subtitle: '1.2 km away',
      matches: true,
      icon: MapPin,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-700/70 dark:border-green-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
    {
      title: 'Academics',
      subtitle: 'IB Program',
      matches: true,
      icon: GraduationCap,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-700/70 dark:border-green-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
    {
      title: 'Sports',
      subtitle: '15+ Activities',
      matches: false,
      icon: Trophy,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-700/70 dark:border-red-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
    {
      title: 'Arts',
      subtitle: 'Creative Hub',
      matches: true,
      icon: Palette,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-700/70 dark:border-green-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
    {
      title: 'Technology',
      subtitle: 'STEM Lab',
      matches: true,
      icon: Laptop,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-700/70 dark:border-green-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
    {
      title: 'Boarding',
      subtitle: 'Residential',
      matches: false,
      icon: Home,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-700/70 dark:border-red-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
    {
      title: 'Languages',
      subtitle: 'Bilingual',
      matches: true,
      icon: Languages,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-700/70 dark:border-green-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
    {
      title: 'Facilities',
      subtitle: 'Modern Campus',
      matches: false,
      icon: Building2,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-700/70 dark:border-red-700',
      textColor: 'text-primary-dark',
      iconColor: 'text-primary-dark',
    },
  ]

  // Show loading while conversation is being found
  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading school details...</p>
        </div>
      </div>
    )
  }

  // After we know conversation exists, derive non-null school object for rendering
  const school = schoolData as NonNullable<typeof schoolData>

  return (
    <div className="min-h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-4 sm:mb-6">
        <div className="h-16 sm:h-20 px-4 sm:px-6 lg:px-10 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Button
              isIconOnly
              variant="light"
              size="sm"
              radius="full"
              onPress={handleBack}
              className="shrink-0"
              aria-label="Go back"
            >
              <ChevronLeft size={20} />
            </Button>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {conversation.name}
            </h1>
          </div>
          <Button
            color="primary"
            size="md"
            radius="full"
            onPress={() => router.push(`/messages/${conversationId}`)}
            className="px-4 sm:px-6 lg:px-8 text-sm sm:text-base shrink-0 ml-2"
          >
            <span className="hidden sm:inline">Continue Chat</span>
            <span className="sm:hidden">Chat</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8 flex-1">
        {/* Two-column layout: Gallery (left) and Info Card (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
          {/* Gallery */}
          <div className="md:col-span-1 lg:col-span-2">
            <div className="p-0 border border-gray-200 dark:border-gray-700/50 rounded-xl">
              <div className="rounded-xl overflow-hidden">
                {(() => {
                  const galleryImages = [
                    '/assets/school-1.jpg',
                    '/assets/school-2.jpg',
                    '/assets/school-1.jpg',
                    '/assets/school-2.jpg',
                  ].map((src, index) => ({
                    original: src,
                    thumbnail: src,
                    originalAlt: `School photo ${index + 1}`,
                    thumbnailAlt: `Thumbnail ${index + 1}`,
                  }))

                  return (
                    <ImageGallery
                      items={galleryImages}
                      showThumbnails
                      showFullscreenButton
                      showPlayButton={false}
                      showNav
                      slideDuration={350}
                      slideInterval={5000}
                      lazyLoad
                      additionalClass="image-gallery-tailwind"
                    />
                  )
                })()}
              </div>
            </div>
          </div>

          {/* Info Card */}
          <div className="md:col-span-1 lg:col-span-3">
            <div className="p-4 sm:p-6 border border-gray-200 dark:border-gray-700/50 rounded-xl">
              <div className="flex items-center mb-3 sm:mb-4 gap-1 flex-wrap">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {conversation.name}
                </h2>
                {conversation.verified && (
                  <BadgeCheck
                    size={20}
                    fill="current"
                    className="stroke-white fill-blue-600 dark:fill-blue-400 sm:w-6 sm:h-6"
                  />
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 lg:gap-10">
                <div className="flex flex-col gap-2 sm:gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{school.location}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={school.rating} size={16} />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      ({school.reviewCount} reviews)
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Chip size="sm" variant="flat" color="primary">
                      Bilingual
                    </Chip>
                    <Chip size="sm" variant="flat">
                      Screen Free
                    </Chip>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:gap-3">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-secondary shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {school.curriculum.join(', ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-secondary shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {school.gradeRange}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-secondary shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {school.tuitionRange}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 sm:mt-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Overview
                </h3>
                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                  {school.description} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed
                  do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
                  veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
                  consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
                  dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident,
                  sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Accordion Section */}
        <div className="mt-4 sm:mt-6">
          <Accordion selectionMode="multiple" className="px-0 space-y-3 sm:space-y-4">
            {[
              {
                title: 'Academics',
                body: 'Our academic program focuses on inquiry-based learning with strong STEM and arts integration across all grade levels.',
              },
              {
                title: 'Tuition',
                body: 'Tuition varies by grade level and program. Scholarships and financial aid are available for eligible families.',
              },
              {
                title: 'Extras',
                body: 'Students enjoy a wide range of extracurricular activities including robotics, music, theater, and over 20 athletic teams.',
              },
              {
                title: 'Reviews',
                body: 'Parents consistently rate the school highly for its dedicated teachers, diverse community, and supportive environment.',
              },
              {
                title: 'Location',
                body: 'Conveniently located in the heart of the city with easy access to public transportation and safe drop-off zones.',
              },
            ].map(item => (
              <AccordionItem
                key={item.title}
                title={
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {item.title}
                  </h3>
                }
                classNames={{
                  base: 'bg-transparent',
                  title: 'text-sm sm:text-base font-medium',
                  subtitle: 'text-secondary',
                  trigger: 'py-0 cursor-pointer',
                  content: 'pt-3',
                }}
                indicator={<ChevronLeft size={20} className="text-secondary sm:w-6 sm:h-6" />}
                textValue={item.body}
              >
                <div>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.body}
                  </p>
                  <span className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                    incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                    nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                    fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
                    culpa qui officia deserunt mollit anim id est laborum.
                  </span>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Your Match Explained Section */}
        <div className="mt-6 sm:mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Your Match Explained */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Your Match Explained
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
                These results are tailored just for you, based on your preferences.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                {/* Overall Match Score */}
                <div className="shrink-0 text-center font-bold sm:text-left">
                  <div className="text-3xl sm:text-4xl">95%</div>
                  <div className="text-sm">Best Match</div>
                </div>

                {/* Match Criteria Breakdown */}
                <div className="flex-1 space-y-2">
                  {[
                    { name: 'Values', percentage: 100 },
                    { name: 'Curriculum', percentage: 100 },
                    { name: 'Extras', percentage: 100 },
                    { name: 'Budget', percentage: 75 },
                    { name: 'Location', percentage: 98 },
                  ].map(criteria => (
                    <div key={criteria.name} className="space-y-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="w-20 sm:w-28 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">
                          {criteria.name}
                        </span>
                        <Progress
                          value={criteria.percentage}
                          className="w-full"
                          size="md"
                          color="primary"
                          radius="full"
                          showValueLabel={false}
                          classNames={{
                            track: 'bg-gray-200 dark:bg-gray-700',
                            indicator: 'bg-blue-500',
                          }}
                        />
                        <span className="w-12 sm:w-16 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-right shrink-0">
                          {criteria.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant="bordered"
                size="md"
                radius="full"
                onPress={() => router.push('/settings/preferences/school')}
                className="w-full mt-4 sm:mt-6 text-sm sm:text-base"
              >
                Refine my preferences
              </Button>
            </div>

            {/* AI Match Summary */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                AI Match Summary
              </h2>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim exercitation ullamco
                laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
                reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt
                mollit anim id est laborum...
              </p>
              {/* <Button variant="bordered" size="lg" radius="full" className="w-full">
                Show more
              </Button> */}
            </div>
          </div>
        </div>

        {/* School Highlights Tiles */}
        <div className="mt-4 sm:mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {schoolHighlights.map((highlight, index) => {
              const IconComponent = highlight.icon
              return (
                <div
                  key={index}
                  className={`p-3 sm:p-4 rounded-lg border ${highlight.bgColor} ${highlight.borderColor}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <IconComponent
                      size={20}
                      className={`${highlight.iconColor} shrink-0 sm:w-6 sm:h-6`}
                    />
                    <div className="min-w-0">
                      <h3
                        className={`text-sm sm:text-base font-semibold ${highlight.textColor} truncate`}
                      >
                        {highlight.title}
                      </h3>
                      <p
                        className={`text-xs sm:text-sm font-semibold ${highlight.textColor} opacity-80 truncate`}
                      >
                        {highlight.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Additional Information Accordion Section */}
        <div className="mt-4 sm:mt-6">
          <Accordion selectionMode="multiple" className="px-0 space-y-3 sm:space-y-4">
            {[
              {
                title: 'Availability',
                subtitle: 'Add your preferred dates',
                body: 'Our school operates on a traditional academic calendar with classes running from September to June. We offer flexible enrollment options throughout the year for international students and those transferring from other institutions. Summer programs and intensive courses are available during July and August. Please contact our admissions office to discuss specific availability for your preferred start date and grade level.',
              },
              {
                title: 'Cancellation Policy',
                subtitle: 'Get the cancellation details',
                body: 'We understand that circumstances may change, and we have a comprehensive cancellation policy to accommodate various situations. For new enrollments, a full refund is available if cancellation occurs within 30 days of the start date. Partial refunds are available up to 60 days before the start of the academic year. For mid-year withdrawals, refunds are calculated on a pro-rated basis. All cancellation requests must be submitted in writing to our admissions office.',
              },
              {
                title: 'Health & Safety',
                subtitle: 'This is an extra text',
                body: 'The health and safety of our students, staff, and families is our top priority. We maintain strict health protocols including regular health screenings, comprehensive emergency procedures, and a fully equipped health center staffed by qualified medical professionals. Our campus features state-of-the-art security systems, controlled access points, and 24/7 monitoring. All staff members undergo thorough background checks and safety training. We also provide comprehensive health insurance options and maintain partnerships with local medical facilities.',
              },
            ].map(item => (
              <AccordionItem
                key={item.title}
                title={
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {item.title}
                  </h3>
                }
                subtitle={item.subtitle}
                classNames={{
                  base: 'bg-transparent',
                  title: 'text-sm sm:text-base font-medium',
                  subtitle: 'text-secondary text-xs sm:text-sm',
                  trigger: 'py-0 cursor-pointer',
                  content: 'pt-3',
                }}
                indicator={<ChevronLeft size={20} className="text-secondary sm:w-6 sm:h-6" />}
                textValue={item.body}
              >
                <div>
                  <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Disclaimer Section */}
        <div className="my-6 sm:my-8 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
              Schoolable is not responsible for errors in this summary.
            </p>
            <button className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300 touch-manipulation">
              Learn more about how this App works.
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
