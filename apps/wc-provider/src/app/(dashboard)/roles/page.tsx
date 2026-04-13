'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageSlot } from '@/components/layout/page-slot'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  Pagination,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from '@heroui/react'
import { FilterX, Pencil, Plus, ShieldCheck, Trash } from 'lucide-react'
import { useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import { useRolesStore } from '@/stores/roles-store'
import { usePermissions } from '@/hooks/use-permissions'
import type { Role } from '@/types/roles'

export default function RolesPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')

  const { confirm } = useConfirmDialog()
  const { hasPermission } = usePermissions()

  const {
    roles,
    isLoading,
    error,
    pagination,
    filters,
    fetchRoles,
    deleteRole,
    setPage,
    setLimit,
    setFilters,
    clearFilters,
  } = useRolesStore()

  // Debounce the search input with 500ms delay
  const debouncedSearch = useDebounce(searchInput, 500)

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch, setFilters])

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles, pagination.page, pagination.limit, filters])

  const handleCreateRole = () => {
    router.push('/roles/create')
  }

  const handleEditRole = (role: Role) => {
    // Prevent editing Super Admin system role
    if (role.name === 'Super Admin' && role.isSystemRole) {
      return
    }
    router.push(`/roles/${role.id}/edit`)
  }

  const handleDeleteRole = async (role: Role) => {
    // Prevent deleting Super Admin system role
    if (role.name === 'Super Admin' && role.isSystemRole) {
      return
    }
    const confirmed = await confirm({
      title: 'Delete Role?',
      message: `Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (confirmed) {
      await deleteRole(role.id)
    }
  }

  const isSystemRoleNonEditable = (role: Role) => {
    return role.name === 'Super Admin' && role.isSystemRole
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleClearAllFilters = () => {
    setSearchInput('') // Clear the search input immediately
    clearFilters()
  }

  const hasActiveFilters = () => {
    return (
      searchInput !== '' ||
      (Object.keys(filters).length > 0 && Object.values(filters).some(v => v !== undefined))
    )
  }

  return (
    <PageSlot>
      <section className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Roles & Permissions
            </h1>
            <p className="text-slate-500 mt-1">Manage system-wide roles and their permissions</p>
          </div>
          {hasPermission('roles.create') && (
            <Button
              color="primary"
              startContent={<Plus className="h-5 w-5" />}
              onPress={handleCreateRole}
            >
              Create Role
            </Button>
          )}
        </header>

        {/* Error Alert */}
        {error && (
          <Card className="bg-danger-50 border-danger-200">
            <CardBody>
              <p className="text-danger">{error}</p>
            </CardBody>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex gap-4 flex-wrap items-end">
          <Input
            label="Search"
            labelPlacement="outside"
            placeholder="Search roles..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-72"
            startContent={<ShieldCheck className="h-5 w-5 text-gray-400" />}
          />

          <Button
            variant="flat"
            color="default"
            startContent={<FilterX className="h-4 w-4" />}
            onPress={handleClearAllFilters}
            isDisabled={!hasActiveFilters()}
          >
            Clear Filters
          </Button>
        </div>

        {/* Roles Table */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardBody className="p-0">
            <Table
              aria-label="Roles table"
              classNames={{
                wrapper: 'rounded-3xl',
              }}
              bottomContent={
                <div className="flex w-full justify-between items-center px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Rows per page:</span>
                    <Select
                      aria-label="Rows per page"
                      size="sm"
                      className="w-20"
                      selectedKeys={[String(pagination.limit)]}
                      onSelectionChange={keys => {
                        const value = Array.from(keys)[0] as string
                        setLimit(Number(value))
                      }}
                    >
                      <SelectItem key="5">5</SelectItem>
                      <SelectItem key="10">10</SelectItem>
                      <SelectItem key="20">20</SelectItem>
                      <SelectItem key="50">50</SelectItem>
                    </Select>
                  </div>
                  {pagination.totalPages > 1 ? (
                    <Pagination
                      showControls
                      total={pagination.totalPages}
                      page={pagination.page}
                      onChange={setPage}
                    />
                  ) : (
                    <div />
                  )}
                  <div className="text-sm text-gray-500">Total: {pagination.total} roles</div>
                </div>
              }
            >
              <TableHeader>
                <TableColumn>ROLE NAME</TableColumn>
                <TableColumn>PERMISSIONS</TableColumn>
                <TableColumn>USERS</TableColumn>
                <TableColumn>CREATED</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody
                items={roles}
                isLoading={isLoading}
                emptyContent={isLoading ? 'Loading...' : 'No roles found'}
              >
                {(role: Role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <span className="font-semibold">{role.name}</span>
                        {role.name === 'Super Admin' && role.isSystemRole && (
                          <Chip color="primary" variant="flat" size="sm">
                            System
                          </Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip variant="flat" size="sm">
                        {role.permissions.length} permissions
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{role._count?.users ?? 0} users</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">{formatDate(role.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {hasPermission('roles.update') &&
                          (isSystemRoleNonEditable(role) ? (
                            <Tooltip content="System role cannot be edited">
                              <span>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onPress={() => handleEditRole(role)}
                                  isDisabled
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </span>
                            </Tooltip>
                          ) : (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => handleEditRole(role)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          ))}
                        {hasPermission('roles.delete') &&
                          (isSystemRoleNonEditable(role) ? (
                            <Tooltip content="System role cannot be deleted" color="danger">
                              <span>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onPress={() => handleDeleteRole(role)}
                                  isDisabled
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </span>
                            </Tooltip>
                          ) : (role._count?.users ?? 0) > 0 ? (
                            <Tooltip
                              content="Cannot delete role with assigned users"
                              color="danger"
                            >
                              <span>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onPress={() => handleDeleteRole(role)}
                                  isDisabled
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </span>
                            </Tooltip>
                          ) : (
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              color="danger"
                              onPress={() => handleDeleteRole(role)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </section>
    </PageSlot>
  )
}
