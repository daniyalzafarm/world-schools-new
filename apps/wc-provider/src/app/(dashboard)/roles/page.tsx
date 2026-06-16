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
  Tooltip,
} from '@heroui/react'
import { Pencil, Plus, Search, ShieldCheck, Trash } from 'lucide-react'
import { Input, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
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
    setFilters,
  } = useRolesStore()

  const debouncedSearch = useDebounce(searchInput, 500)

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
    if (role.isSystemRole) {
      return
    }
    router.push(`/roles/${role.id}/edit`)
  }

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystemRole) {
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
    return role.isSystemRole
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const paginationFooter = pagination.total > 0 && (
    <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span className="text-sm text-default-500">
        Showing {roles.length} of {pagination.total} roles
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
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              Roles & Permissions
            </h1>
            <p className="text-default-600 mt-1">Manage system-wide roles and their permissions</p>
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

        {error ? (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900/40 dark:bg-danger-950/30">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
            <Button className="mt-4" variant="flat" onPress={() => void fetchRoles()}>
              Retry
            </Button>
          </div>
        ) : (
          <Card>
            <CardBody className="p-0">
              <div className="border-b border-default-200 px-4 py-3">
                <Input
                  aria-label="Search roles"
                  placeholder="Search roles…"
                  className="w-full max-w-sm"
                  value={searchInput}
                  onValueChange={setSearchInput}
                  isClearable
                  onClear={() => setSearchInput('')}
                  startContent={<Search className="size-4 shrink-0 text-default-500" aria-hidden />}
                />
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table
                  aria-label="Roles table"
                  classNames={{
                    wrapper: 'shadow-none',
                  }}
                >
                  <TableHeader>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Role name
                    </TableColumn>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Permissions
                    </TableColumn>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Users
                    </TableColumn>
                    <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                      Created
                    </TableColumn>
                    <TableColumn className="text-right text-xs font-semibold uppercase tracking-wide text-default-500">
                      Actions
                    </TableColumn>
                  </TableHeader>
                  <TableBody
                    items={roles}
                    isLoading={isLoading}
                    emptyContent={
                      <div className="py-12 text-center">
                        <p className="text-default-500">
                          {isLoading ? 'Loading…' : 'No roles found.'}
                        </p>
                      </div>
                    }
                  >
                    {(role: Role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            <span className="font-semibold text-foreground">{role.name}</span>
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
                          <span className="text-sm text-default-600">
                            {role._count?.users ?? 0} users
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-default-500">
                            {formatDate(role.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {hasPermission('roles.update') &&
                              (isSystemRoleNonEditable(role) ? (
                                <Tooltip content="System role cannot be edited">
                                  <span>
                                    <Button isIconOnly size="sm" variant="light" isDisabled>
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
              </div>

              <div className="md:hidden">
                {isLoading ? (
                  <div className="flex justify-center py-20">
                    <Spinner size="lg" label="Loading roles" />
                  </div>
                ) : roles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-default-300 m-4 py-16 text-center text-default-500">
                    No roles found.
                  </div>
                ) : (
                  <div className="space-y-3 p-4">
                    {roles.map(role => {
                      const userCount = role._count?.users ?? 0
                      const systemLocked = isSystemRoleNonEditable(role)
                      const canEdit = hasPermission('roles.update') && !systemLocked
                      const canDelete =
                        hasPermission('roles.delete') && !systemLocked && userCount === 0
                      return (
                        <div
                          key={role.id}
                          className="rounded-xl border border-default-200 bg-content1 p-4 shadow-sm dark:border-default-100/20"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="h-5 w-5 text-primary" />
                              <span className="font-semibold text-default-900 dark:text-default-100">
                                {role.name}
                              </span>
                            </div>
                            {role.name === 'Super Admin' && role.isSystemRole ? (
                              <Chip color="primary" variant="flat" size="sm">
                                System
                              </Chip>
                            ) : null}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-default-500">
                            <Chip variant="flat" size="sm">
                              {role.permissions.length} permissions
                            </Chip>
                            <span>•</span>
                            <span>{userCount} users</span>
                            <span>•</span>
                            <span>{formatDate(role.createdAt)}</span>
                          </div>
                          {(hasPermission('roles.update') || hasPermission('roles.delete')) && (
                            <div className="mt-3 flex justify-end gap-1">
                              {hasPermission('roles.update') && (
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  isDisabled={!canEdit}
                                  onPress={() => handleEditRole(role)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission('roles.delete') && (
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  isDisabled={!canDelete}
                                  onPress={() => handleDeleteRole(role)}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
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
