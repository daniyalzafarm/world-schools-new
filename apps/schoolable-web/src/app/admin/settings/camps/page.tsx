'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@heroui/react'
import { ChevronRight, Plus, PlusCircle, Tent } from 'lucide-react'
import { useCampsStore } from '@/stores/camps-store'

const CampsPage = () => {
  const router = useRouter()
  const { camps } = useCampsStore()

  const handleAddCamp = () => {
    router.push('/admin/settings/camps/new')
  }

  const handleEditCamp = (campId: string) => {
    router.push(`/admin/settings/camps/${campId}`)
  }

  const getCampDisplayName = (camp: { name: string }) => camp.name

  return (
    <div className="min-h-full w-full flex flex-col bg-white dark:bg-gray-900">
      {/* Sticky Page Header */}
      <div className="sticky top-0 z-30 bg-white shadow-[0_24px_16px_-2px_rgba(255,255,255,0.8)] dark:bg-gray-900 dark:shadow-[0_24px_16px_-2px_rgba(17,24,39,0.8)] mb-6">
        <div className="h-20 px-10 mb-2 flex items-center justify-between border-b border-gray-200 dark:border-gray-700/50">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Camps</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-8 sm:px-10 lg:px-10">
        <div className="space-y-3">
          {camps.map(camp => (
            <div
              key={camp.id}
              onClick={() => handleEditCamp(camp.id)}
              className="w-full rounded-lg p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-3">
                  <Tent size={24} className="text-gray-900 dark:text-gray-400" />
                  <div className="text-left">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                      {getCampDisplayName(camp)}
                    </h3>
                  </div>
                </div>
                <ChevronRight size={20} className="text-gray-400" />
              </div>
            </div>
          ))}

          {/* Add a camp button */}
          <div
            onClick={handleAddCamp}
            className="w-full rounded-lg p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-gray-200 dark:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <PlusCircle size={24} className="text-gray-900 dark:text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add a camp</h3>
            </div>
          </div>

          {camps.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400 mb-4">No camps added yet</p>
              <Button color="primary" onPress={handleAddCamp} startContent={<Plus size={16} />}>
                Add Your First Camp
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CampsPage
