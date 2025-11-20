'use client'

import { useEffect, useState } from 'react'
import {
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from '@heroui/react'
import { Pencil, Plus, Trash2, User } from 'lucide-react'
import {
  type Child,
  childrenService,
  type CreateChildDto,
  type UpdateChildDto,
} from '@/services/children.services'

export default function ChildrenPage() {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [formData, setFormData] = useState<CreateChildDto>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    grade: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { isOpen, onOpen, onClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()

  useEffect(() => {
    loadChildren().catch(err => {
      console.error('Failed to load children:', err)
    })
  }, [])

  const loadChildren = async () => {
    try {
      setLoading(true)
      const data = await childrenService.getAll()
      setChildren(data)
    } catch (error) {
      console.error('Failed to load children:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setSelectedChild(null)
    setFormData({ firstName: '', lastName: '', dateOfBirth: '', grade: '' })
    onOpen()
  }

  const handleOpenEdit = (child: Child) => {
    setSelectedChild(child)
    setFormData({
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth || '',
      grade: child.grade || '',
    })
    onOpen()
  }

  const handleOpenDelete = (child: Child) => {
    setSelectedChild(child)
    onDeleteOpen()
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      if (selectedChild) {
        await childrenService.update(selectedChild.id, formData as UpdateChildDto)
      } else {
        await childrenService.create(formData)
      }
      await loadChildren()
      onClose()
    } catch (error) {
      console.error('Failed to save child:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedChild) return
    try {
      setIsSubmitting(true)
      await childrenService.delete(selectedChild.id)
      await loadChildren()
      onDeleteClose()
    } catch (error) {
      console.error('Failed to delete child:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Children</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your children's profiles for camp bookings
          </p>
        </div>
        <Button color="primary" startContent={<Plus size={18} />} onPress={handleOpenAdd}>
          Add Child
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : children.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              No children
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding your first child.
            </p>
            <div className="mt-6">
              <Button color="primary" startContent={<Plus size={18} />} onPress={handleOpenAdd}>
                Add Child
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map(child => (
            <Card key={child.id}>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-secondary text-sm font-semibold">
                        {child.firstName[0]}
                        {child.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {child.firstName} {child.lastName}
                      </h3>
                      {child.grade && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{child.grade}</p>
                      )}
                    </div>
                  </div>
                </div>
                {child.dateOfBirth && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Born: {new Date(child.dateOfBirth).toLocaleDateString()}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Pencil size={14} />}
                    onPress={() => handleOpenEdit(child)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    startContent={<Trash2 size={14} />}
                    onPress={() => handleOpenDelete(child)}
                  >
                    Delete
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>{selectedChild ? 'Edit Child' : 'Add Child'}</ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  isRequired
                />
                <Input
                  label="Last Name"
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  isRequired
                />
              </div>
              <Input
                type="date"
                label="Date of Birth"
                placeholder="Select date of birth"
                value={formData.dateOfBirth}
                onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
              <Input
                label="Grade"
                placeholder="e.g., 3rd Grade, 5th Grade"
                value={formData.grade}
                onChange={e => setFormData({ ...formData, grade: e.target.value })}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isLoading={isSubmitting}
              isDisabled={!formData.firstName || !formData.lastName}
            >
              {selectedChild ? 'Update' : 'Add'}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
        <ModalContent>
          <ModalHeader>Delete Child</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete{' '}
              <strong>
                {selectedChild?.firstName} {selectedChild?.lastName}
              </strong>
              ? This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onDeleteClose}>
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete} isLoading={isSubmitting}>
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  )
}
