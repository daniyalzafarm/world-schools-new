'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from '@heroui/react'
import { useCampsStore } from '../../../stores/camps-store'
import { Edit, MoreVertical, Plus, Trash2 } from 'lucide-react'
import { PageSlot } from '@/components/layout/page-slot'

export default function CampsPage() {
  const router = useRouter()
  const { camps, fetchCamps, deleteCamp, isLoading } = useCampsStore()
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')

  useEffect(() => {
    const filters = filter === 'all' ? undefined : { status: filter }
    fetchCamps(filters).catch(error => {
      console.error('Failed to fetch camps:', error)
    })
  }, [filter, fetchCamps])

  const handleCreateCamp = () => {
    router.push('/camps/create/basic-info')
  }

  const handleEditCamp = (campId: string) => {
    router.push(`/camps/${campId}/edit/basic-info`)
  }

  const handleDeleteCamp = async (campId: string) => {
    if (confirm('Are you sure you want to delete this camp?')) {
      try {
        await deleteCamp(campId)
      } catch (error) {
        console.error('Failed to delete camp:', error)
      }
    }
  }

  const getStatusColor = (status: string) => {
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

  return (
    <PageSlot>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Camps</h1>
          <p className="text-sm text-gray-600">Manage your camp listings</p>
        </div>
        <Button
          color="primary"
          startContent={<Plus className="h-4 w-4" />}
          onPress={handleCreateCamp}
        >
          Create New Camp
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-2">
        <Button
          size="sm"
          variant={filter === 'all' ? 'solid' : 'bordered'}
          color={filter === 'all' ? 'primary' : 'default'}
          onPress={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={filter === 'draft' ? 'solid' : 'bordered'}
          color={filter === 'draft' ? 'primary' : 'default'}
          onPress={() => setFilter('draft')}
        >
          Drafts
        </Button>
        <Button
          size="sm"
          variant={filter === 'published' ? 'solid' : 'bordered'}
          color={filter === 'published' ? 'primary' : 'default'}
          onPress={() => setFilter('published')}
        >
          Published
        </Button>
      </div>

      {/* Camps Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600">Loading camps...</p>
        </div>
      ) : camps.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="mb-4 text-gray-600">No camps found</p>
            <Button
              color="primary"
              variant="flat"
              startContent={<Plus className="h-4 w-4" />}
              onPress={handleCreateCamp}
            >
              Create Your First Camp
            </Button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {camps.map(camp => (
            <Card key={camp.id} className="hover:shadow-lg transition-shadow">
              <CardBody className="p-0">
                {/* Camp Image */}
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  {camp.photos && (camp.photos as any[]).length > 0 ? (
                    <img
                      src={(camp.photos as any[])[0].url}
                      alt={camp.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-400">
                      No image
                    </div>
                  )}
                </div>

                {/* Camp Info */}
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">{camp.name}</h3>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem
                          key="edit"
                          startContent={<Edit className="h-4 w-4" />}
                          onPress={() => handleEditCamp(camp.id)}
                        >
                          Edit
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          startContent={<Trash2 className="h-4 w-4" />}
                          onPress={() => handleDeleteCamp(camp.id)}
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>

                  <p className="mb-3 line-clamp-2 text-sm text-gray-600">{camp.description}</p>

                  <div className="flex items-center justify-between">
                    <Chip size="sm" color={getStatusColor(camp.status)} variant="flat">
                      {camp.status}
                    </Chip>
                    <span className="text-xs text-gray-500">{camp.type}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </PageSlot>
  )
}
