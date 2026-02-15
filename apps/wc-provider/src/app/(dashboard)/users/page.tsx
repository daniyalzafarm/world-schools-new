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
} from '@heroui/react'
import { Crown, FilterX, Pencil, Plus, Trash, User as UserIcon } from 'lucide-react'
import { useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import { useUsersStore } from '@/stores/users-store'
import { useRolesStore } from '@/stores/roles-store'
import { usePermissions } from '@/hooks/use-permissions'
import type { User } from '@/types/users'

export default function UsersPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')

  const { confirm } = useConfirmDialog()
  const { hasPermission } = usePermissions()

  const {
    users,
    isLoading,
    error,
    pagination,
    filters,
    fetchUsers,
    deleteUser,
    setPage,
    setLimit,
    setFilters,
    clearFilters,
  } = useUsersStore()

  const { roles, fetchRoles } = useRolesStore()

  // Debounce the search input with 500ms delay
  const debouncedSearch = useDebounce(searchInput, 500)

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles])

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch, setFilters])

  useEffect(() => {
    void fetchUsers()
  }, [fetchUsers, pagination.page, pagination.limit, filters])

  const handleCreateUser = () => {
    router.push('/users/create')
  }

  const handleEditUser = (user: User) => {
    router.push(`/users/${user.id}/edit`)
  }

  const handleDeleteUser = async (user: User) => {
    const confirmed = await confirm({
      title: 'Delete User?',
      message: `Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })
    if (confirmed) {
      await deleteUser(user.id)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getUserInitials = (user: User) => {
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
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

  // Separate provider owner from regular users
  const providerOwner = users.find(user => user.ownedProvider?.id)
  const regularUsers = users.filter(user => !user.ownedProvider?.id)

  return (
    <PageSlot>
      <section className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Users</h1>
            <p className="text-slate-500 mt-1">Manage system users and their access</p>
          </div>
          {hasPermission('users.create') && (
            <Button
              color="primary"
              startContent={<Plus className="h-5 w-5" />}
              onPress={handleCreateUser}
            >
              Create User
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

        {/* Provider Owner Section */}
        {providerOwner && (
          <Card className="rounded-3xl border border-primary bg-primary-50/30">
            <CardBody className="px-6 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="bg-primary text-white text-sm font-medium min-w-10 min-h-10 rounded-full flex items-center justify-center shrink-0">
                    {getUserInitials(providerOwner)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {providerOwner.firstName} {providerOwner.lastName}
                      </span>
                      <Chip
                        startContent={<Crown className="h-3 w-3" />}
                        color="warning"
                        variant="flat"
                        size="sm"
                        className="font-medium"
                      >
                        Owner
                      </Chip>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm text-slate-600 dark:text-slate-400 hidden sm:block">
                    {providerOwner.email}
                  </span>
                  <Chip
                    color={providerOwner.emailVerified ? 'success' : 'warning'}
                    variant="flat"
                    size="sm"
                  >
                    {providerOwner.emailVerified ? 'Verified' : 'Unverified'}
                  </Chip>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex gap-4 flex-wrap items-end">
          <Input
            label="Search"
            labelPlacement="outside"
            placeholder="Search users by name or email..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="w-[280px]"
            startContent={<UserIcon className="h-5 w-5 text-gray-400" />}
          />
          <Select
            label="Role"
            labelPlacement="outside"
            placeholder="Select role"
            className="w-[180px]"
            selectedKeys={filters.roleId ? [filters.roleId] : ['all']}
            onSelectionChange={keys => {
              const value = Array.from(keys)[0] as string | undefined
              setFilters({ roleId: value === 'all' ? undefined : value })
            }}
          >
            {[
              <SelectItem key="all">All</SelectItem>,
              ...roles.map(role => <SelectItem key={role.id}>{role.name}</SelectItem>),
            ]}
          </Select>
          <Select
            label="Email Status"
            labelPlacement="outside"
            placeholder="Select status"
            className="w-[180px]"
            selectedKeys={
              filters.emailVerified !== undefined ? [String(filters.emailVerified)] : ['all']
            }
            onSelectionChange={keys => {
              const value = Array.from(keys)[0] as string | undefined
              setFilters({ emailVerified: value === 'all' ? undefined : value === 'true' })
            }}
          >
            <SelectItem key="all">All</SelectItem>
            <SelectItem key="true">Verified</SelectItem>
            <SelectItem key="false">Unverified</SelectItem>
          </Select>
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

        {/* Users Table */}
        <Card className="rounded-3xl border border-slate-200 dark:border-slate-800" shadow="sm">
          <CardBody className="p-0">
            <Table
              aria-label="Users table"
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
                  <div className="text-sm text-gray-500">
                    Total: {providerOwner ? pagination.total - 1 : pagination.total} users
                  </div>
                </div>
              }
            >
              <TableHeader>
                <TableColumn>USER</TableColumn>
                <TableColumn>EMAIL</TableColumn>
                <TableColumn>ROLES</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>CREATED</TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody
                items={regularUsers}
                isLoading={isLoading}
                emptyContent={isLoading ? 'Loading...' : 'No users found'}
              >
                {(user: User) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="bg-primary text-white text-sm font-medium min-w-10 min-h-10 rounded-full flex items-center justify-center">
                          {getUserInitials(user)}
                        </div>
                        <div>
                          <div className="font-semibold">
                            {user.firstName} {user.lastName}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length > 0 ? (
                          user.roles.map(userRole => (
                            <Chip key={userRole.roleId} variant="flat" size="sm" color="primary">
                              {userRole.role.name}
                            </Chip>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No roles</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={user.emailVerified ? 'success' : 'warning'}
                        variant="flat"
                        size="sm"
                      >
                        {user.emailVerified ? 'Verified' : 'Unverified'}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">{formatDate(user.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {hasPermission('users.update') && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => handleEditUser(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {hasPermission('users.delete') && (
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            color="danger"
                            onPress={() => handleDeleteUser(user)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
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
