'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Spinner } from '@heroui/react'
import { AlertCircle, ChevronRight, Plus, PlusCircle, User } from 'lucide-react'
import { getChildDisplayName } from '@/types/child'

import { useChildrenStore } from '@/stores/children-store'

const ChildrenPage = () => {
  const router = useRouter()

  // Get children from store
  const { children, isLoading, error, fetchChildren, clearError } = useChildrenStore()

  // Fetch children on mount
  useEffect(() => {
    fetchChildren().catch(error => {
      console.error('Failed to fetch children:', error)
    })
  }, [])

  const handleAddChild = () => {
    router.push('/settings/children/new')
  }

  const handleEditChild = (childId: string) => {
    router.push(`/settings/children/${childId}`)
  }

  return (
    <div className="min-h-full w-full flex flex-col bg-white dark:bg-gray-900">
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
        <div className="h-20 px-10 mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Children</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-8 sm:px-10 lg:px-10">
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" label="Loading children..." />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-medium text-red-800 dark:text-red-300 mb-1">
                  Error Loading Children
                </h3>
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
              <Button
                size="sm"
                variant="light"
                color="danger"
                onPress={() => {
                  clearError()
                  fetchChildren().catch(error => {
                    console.error('Failed to fetch children:', error)
                  })
                }}
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Children List */}
        {!isLoading && !error && (
          <div className="space-y-3">
            {children.map(child => (
              <div
                key={child.id}
                onClick={() => handleEditChild(child.id)}
                className="w-full rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <User size={20} className="text-gray-900 dark:text-gray-400" />
                    <div className="text-left">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {getChildDisplayName(child)}
                      </h3>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
              </div>
            ))}

            {/* Add a child button */}
            {!!children.length && (
              <div
                onClick={handleAddChild}
                className="w-full rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PlusCircle size={20} className="text-gray-900 dark:text-gray-400" />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Add a child</h3>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!children.length && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">No children added yet</p>
                <Button color="primary" onPress={handleAddChild} startContent={<Plus size={16} />}>
                  Add Your First Child
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ChildrenPage
