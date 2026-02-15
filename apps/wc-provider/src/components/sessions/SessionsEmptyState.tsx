'use client'

import { Button, Card, CardBody } from '@heroui/react'
import { Calendar, Copy, DollarSign, Plus, Users } from 'lucide-react'

interface SessionsEmptyStateProps {
  onCreateSession: () => void
}

/**
 * Sessions Empty State Component
 * Shown when no sessions exist yet
 */
export function SessionsEmptyState({ onCreateSession }: SessionsEmptyStateProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <Card className="border-2 border-dashed border-default-300">
        <CardBody className="p-8">
          <div className="text-center flex flex-col gap-6">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-secondary-100 dark:bg-secondary-900 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-secondary-600 dark:text-secondary-400" />
              </div>
            </div>

            {/* Title and Description */}
            <div className="space-y-2">
              <h2 className="text-[24px] font-bold text-default-900">Create Your First Session</h2>
              <p className="text-[16px] text-default-600 max-w-xl mx-auto leading-relaxed">
                Sessions have set start and end dates. Perfect for traditional summer camps with
                specific weeks.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">Fixed Dates</h4>
                  <p className="text-[13px] text-default-600">
                    Set specific dates for each session
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-success-100 dark:bg-success-900 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">
                    Flexible Pricing
                  </h4>
                  <p className="text-[13px] text-default-600">
                    Single price or age group pricing options
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-warning-100 dark:bg-warning-900 flex items-center justify-center">
                  <Users className="w-5 h-5 text-warning-600 dark:text-warning-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">
                    Capacity Control
                  </h4>
                  <p className="text-[13px] text-default-600">
                    Set maximum capacity for each session
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-secondary-100 dark:bg-secondary-900 flex items-center justify-center">
                  <Copy className="w-5 h-5 text-secondary-600 dark:text-secondary-400" />
                </div>
                <div>
                  <h4 className="text-[14px] font-semibold text-default-900 mb-1">
                    Easy Duplication
                  </h4>
                  <p className="text-[13px] text-default-600">
                    Quickly duplicate sessions with same settings
                  </p>
                </div>
              </div>
            </div>

            {/* Example */}
            <div className="bg-default-100 dark:bg-default-800 rounded-xl p-6 w-full max-w-xl mx-auto">
              <p className="text-[12px] font-semibold text-default-500 uppercase tracking-wide mb-3">
                Example
              </p>
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-default-600">Session:</span>
                  <span className="text-[13px] font-semibold text-default-900">
                    Week 1 - June 10-16, 2024
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-default-600">Price:</span>
                  <span className="text-[13px] font-semibold text-default-900">$1,200</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-default-600">Capacity:</span>
                  <span className="text-[13px] font-semibold text-default-900">50 spots</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="flex items-center justify-center">
              <Button
                color="primary"
                size="lg"
                startContent={<Plus className="w-5 h-5" />}
                onPress={onCreateSession}
                className="font-semibold"
              >
                Create Session
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
