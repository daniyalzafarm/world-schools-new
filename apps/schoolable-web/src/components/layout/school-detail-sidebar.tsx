'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Accordion, AccordionItem, Avatar, Button, Chip, Divider, Progress } from '@heroui/react'
import {
  ArrowLeftToLine,
  BadgeCheck,
  Calendar,
  ChevronLeft,
  DollarSign,
  // Expand,
  Globe,
  Languages,
  MapPin,
  Users,
  X,
} from 'lucide-react'
import { StarRating } from "@world-schools/ui-web"
import ImageGallery from 'react-image-gallery'

interface SchoolDetailSidebarProps {
  isOpen: boolean
  onClose: () => void
  schoolName?: string
  avatarUrl?: string
  verified?: boolean
  conversationId?: string
}

type SchoolData = {
  description: string
  location: string
  established: string
  studentCount: string
  rating: number
  reviewCount: number
  curriculum: string[]
  gradeRange: string
  tuitionRange: string
  languages: string[]
}

function getSchoolData(schoolName: string | undefined): SchoolData {
  const baseData: SchoolData = {
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
    languages: ['English', 'Spanish', 'French'],
  }

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

export function SchoolDetailSidebar({
  isOpen,
  onClose,
  schoolName,
  avatarUrl,
  verified,
  conversationId,
}: SchoolDetailSidebarProps) {
  const router = useRouter()
  if (!isOpen) return null

  const school = getSchoolData(schoolName)

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 z-50 flex flex-col">
      {/* Header */}
      <div className="h-20 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Profile</h2>
        <Button isIconOnly variant="light" size="sm" onPress={onClose} aria-label="Close sidebar">
          <X size={20} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Image Gallery */}
        <div className="border border-gray-200 dark:border-gray-700/50 rounded-xl overflow-hidden">
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
                showBullets={true}
                showNav={false}
                slideDuration={350}
                slideInterval={5000}
                lazyLoad
                additionalClass="image-gallery-tailwind"
              />
            )
          })()}
        </div>

        {/* Header block (mobile-style) */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold">{schoolName ?? 'School'}</h3>
              {verified && (
                <BadgeCheck
                  size={18}
                  fill="current"
                  className="stroke-white fill-blue-600 dark:fill-blue-400"
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <StarRating rating={school.rating} size={16} />
              <span className="text-sm text-secondary">({school.reviewCount} reviews)</span>
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <Chip size="sm" variant="flat" color="primary">
                Bilingual
              </Chip>
              <Chip size="sm" variant="flat">
                Screen Free
              </Chip>
            </div>
          </div>
          <Avatar src={avatarUrl} alt={schoolName ?? 'School'} className="w-12 h-12" />
        </div>
        <Divider />

        {/* Quick facts */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin size={16} />
            <span>{school.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Globe size={16} />
            <span>{school.curriculum.join(', ')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users size={16} />
            <span>{school.gradeRange}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign size={16} />
            <span>{school.tuitionRange}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Languages size={16} />
            <span>Languages: {school.languages.join(', ')}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={16} />
            <span>Established {school.established}</span>
          </div>
        </div>

        {/* Overview */}
        <div>
          <h4 className="text-lg font-semibold mb-2">Overview</h4>
          <p className="text-sm text-secondary leading-relaxed">
            {school.description} Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua.
          </p>
        </div>

        {/* Accordions (Academics, Tuition, Extras, Reviews, Location) */}
        <div>
          <Accordion selectionMode="multiple" className="px-0 space-y-4">
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
                title={<h3 className="text-base font-semibold mb-2">{item.title}</h3>}
                classNames={{
                  base: 'bg-transparent',
                  title: 'text-sm font-medium',
                  subtitle: 'text-secondary',
                  trigger: 'py-0 cursor-pointer',
                  content: 'pt-2',
                }}
                indicator={<ChevronLeft size={20} className="text-secondary" />}
                textValue={item.body}
              >
                <div>
                  <p className="text-sm text-secondary leading-relaxed">{item.body}</p>
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Your Match Explained */}
        <div>
          <h4 className="text-lg font-semibold mb-2">Your Match Explained</h4>
          <p className="text-sm text-secondary mb-3">
            These results are tailored just for you, based on your preferences.
          </p>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 text-center font-bold">
              <div className="text-3xl">95%</div>
              <div className="text-sm">Best Match</div>
            </div>
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
                    <span className="w-28 text-xs font-medium">{criteria.name}</span>
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
                    <span className="w-12 text-xs font-medium text-right">
                      {criteria.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div>
          <Accordion selectionMode="multiple" className="px-0 space-y-4">
            {[
              {
                title: 'Availability',
                subtitle: 'Add your preferred dates',
                body: 'Our school operates on a traditional academic calendar with classes running from September to June. We offer flexible enrollment options throughout the year for international students and those transferring from other institutions.',
              },
              {
                title: 'Cancellation Policy',
                subtitle: 'Get the cancellation details',
                body: 'We understand that circumstances may change, and we have a comprehensive cancellation policy to accommodate various situations. For new enrollments, a full refund is available if cancellation occurs within 30 days of the start date.',
              },
              {
                title: 'Health & Safety',
                subtitle: 'This is an extra text',
                body: 'The health and safety of our students, staff, and families is our top priority. We maintain strict health protocols including regular health screenings and comprehensive emergency procedures.',
              },
            ].map(item => (
              <AccordionItem
                key={item.title}
                title={<h3 className="text-base font-semibold">{item.title}</h3>}
                subtitle={item.subtitle}
                classNames={{
                  base: 'bg-transparent',
                  title: 'text-sm font-medium',
                  subtitle: 'text-secondary text-xs',
                  trigger: 'py-0 cursor-pointer',
                  content: 'pt-2',
                }}
                indicator={<ChevronLeft size={20} className="text-secondary" />}
                textValue={item.body}
              >
                <p className="text-sm text-secondary leading-relaxed">{item.body}</p>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Disclaimer */}
        <div className="text-center py-2">
          <p className="text-xs text-secondary mb-1">
            Schoolable is not responsible for errors in this summary.
          </p>
          <button className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300">
            Learn more about how this App works.
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="">
        <Button
          color="primary"
          variant="light"
          radius="none"
          className="w-full h-16 px-4 border-t border-gray-200 text-primary-dark"
          onPress={() => {
            if (conversationId) {
              router.push(`/messages/${conversationId}/school-detail`)
            }
            onClose()
          }}
          startContent={<ArrowLeftToLine size={20} />}
        >
          Expand to full screen
        </Button>
      </div>
    </div>
  )
}

export default SchoolDetailSidebar
