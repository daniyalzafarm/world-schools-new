'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageSlot } from '@/components/layout/page-slot'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Pagination,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from '@heroui/react'
import { FilterX, Pencil, Plus, Search, Trash } from 'lucide-react'
import {
  getInitials,
  Input,
  SelectField,
  useConfirmDialog,
  useDebounce,
} from '@world-schools/ui-web'
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
    setFilters,
    clearFilters,
  } = useUsersStore()

  const { roles, fetchRoles } = useRolesStore()

  const debouncedSearch = useDebounce(searchInput, 500)

  useEffect(() => {
    void fetchRoles()
  }, [fetchRoles])

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

  const getUserInitials = (user: User) => getInitials(`${user.firstName} ${user.lastName}`)

  const handleClearAllFilters = () => {
    setSearchInput('')
    clearFilters()
  }

  const hasActiveFilters =
    searchInput !== '' ||
    (Object.keys(filters).length > 0 && Object.values(filters).some(v => v !== undefined))

  const paginationFooter = pagination.total > 0 && (
    <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="text-sm text-default-500">
        Showing {users.length} of {pagination.total} users
      </span>
      {pagination.totalPages > 1 ? (
        <Pagination
          total={pagination.totalPages}
          page={pagination.page}
          onChange={setPage}
          showControls
        />
      ) : null}
    </div>
  )

  return (
    <PageSlot>
      <section className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Users</h1>
            <p className="text-default-600 mt-1">Manage system users and their access</p>
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

        {error ? (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900/40 dark:bg-danger-950/30">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
            <Button className="mt-4" variant="flat" onPress={() => void fetchUsers()}>
              Retry
            </Button>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="flex flex-wrap items-end gap-4 border-b border-default-200 px-4 py-3">
                <Input
                  aria-label="Search users"
                  placeholder="Search users by name or email…"
                  className="w-full max-w-sm shrink-0"
                  value={searchInput}
                  onValueChange={setSearchInput}
                  isClearable
                  onClear={() => setSearchInput('')}
                  startContent={<Search className="size-4 shrink-0 text-default-500" aria-hidden />}
                />
                <SelectField
                  aria-label="Role"
                  placeholder="Role"
                  className="w-44 shrink-0"
                  value={filters.roleId ?? 'all'}
                  onChange={value => {
                    setFilters({ roleId: value === 'all' ? undefined : value })
                  }}
                  options={[
                    { value: 'all', label: 'All roles' },
                    ...roles.map(role => ({ value: role.id, label: role.name })),
                  ]}
                />
                <SelectField
                  aria-label="Email status"
                  placeholder="Email status"
                  className="w-44 shrink-0"
                  value={
                    filters.emailVerified !== undefined ? String(filters.emailVerified) : 'all'
                  }
                  onChange={value => {
                    setFilters({ emailVerified: value === 'all' ? undefined : value === 'true' })
                  }}
                  options={[
                    { value: 'all', label: 'All statuses' },
                    { value: 'true', label: 'Verified' },
                    { value: 'false', label: 'Unverified' },
                  ]}
                />
                {hasActiveFilters ? (
                  <Button
                    variant="flat"
                    className="ml-auto shrink-0"
                    startContent={<FilterX className="h-4 w-4" />}
                    onPress={handleClearAllFilters}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table
                  aria-label="Users table"
                  classNames={{
                    wrapper: 'shadow-none',
                  }}
                >
                  <TableHeader>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      User
                    </TableColumn>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Email
                    </TableColumn>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Roles
                    </TableColumn>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Status
                    </TableColumn>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Created
                    </TableColumn>
                    <TableColumn className="text-right text-xs font-semibold uppercase tracking-wide text-default-500">
                      Actions
                    </TableColumn>
                  </TableHeader>
                  <TableBody
                    items={users}
                    isLoading={isLoading}
                    emptyContent={
                      <div className="py-12 text-center">
                        <p className="text-default-500">
                          {isLoading ? 'Loading…' : 'No users found.'}
                        </p>
                      </div>
                    }
                  >
                    {(user: User) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="bg-primary text-white text-sm font-medium min-w-10 min-h-10 rounded-full flex items-center justify-center">
                              {getUserInitials(user)}
                            </div>
                            <div className="font-semibold text-foreground">
                              {user.firstName} {user.lastName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-default-600">{user.email}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length > 0 ? (
                              user.roles.map(userRole => (
                                <Chip
                                  key={userRole.roleId}
                                  variant="flat"
                                  size="sm"
                                  color="primary"
                                >
                                  {userRole.role.name}
                                </Chip>
                              ))
                            ) : (
                              <span className="text-sm text-default-500">No roles</span>
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
                          <span className="text-sm text-default-500">
                            {formatDate(user.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
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
              </div>

              <div className="md:hidden">
                {isLoading ? (
                  <div className="flex justify-center py-20">
                    <Spinner size="lg" label="Loading users" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="m-4 rounded-xl border border-dashed border-default-300 py-16 text-center text-default-500">
                    No users found.
                  </div>
                ) : (
                  <div className="space-y-3 p-4">
                    {users.map(user => (
                      <div
                        key={user.id}
                        className="rounded-xl border border-default-200 bg-content1 p-4 shadow-sm dark:border-default-100/20"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary text-white text-sm font-medium min-w-10 min-h-10 rounded-full flex items-center justify-center">
                              {getUserInitials(user)}
                            </div>
                            <div>
                              <p className="font-semibold text-default-900 dark:text-default-100">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-xs text-default-500">{user.email}</p>
                            </div>
                          </div>
                          <Chip
                            color={user.emailVerified ? 'success' : 'warning'}
                            variant="flat"
                            size="sm"
                          >
                            {user.emailVerified ? 'Verified' : 'Unverified'}
                          </Chip>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1">
                          {user.roles.length > 0 ? (
                            user.roles.map(userRole => (
                              <Chip key={userRole.roleId} variant="flat" size="sm" color="primary">
                                {userRole.role.name}
                              </Chip>
                            ))
                          ) : (
                            <span className="text-xs text-default-500">No roles</span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-xs text-default-500">
                            {formatDate(user.createdAt)}
                          </span>
                          {(hasPermission('users.update') || hasPermission('users.delete')) && (
                            <div className="flex gap-1">
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
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {paginationFooter}
            </CardBody>
          </Card>
        )}
      </section>
    </PageSlot>
  )
}
