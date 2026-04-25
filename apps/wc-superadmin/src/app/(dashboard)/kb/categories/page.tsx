'use client'

import { useEffect, useState } from 'react'
import { PageSlot } from '@/components/layout/page-slot'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from '@heroui/react'
import { FilterX, Pencil, Plus, Search, Trash } from 'lucide-react'
import { Input, SelectField, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import { useKbCategoriesStore } from '@/stores/kb-categories-store'
import { usePermissions } from '@/hooks/use-permissions'
import { CategoryModal } from '@/components/kb/category-modal'
import type { ArticleCategory } from '@world-schools/wc-frontend-utils'

export default function KbCategoriesPage() {
  const [searchInput, setSearchInput] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const { confirm } = useConfirmDialog()
  const { hasPermission } = usePermissions()

  const {
    categories,
    isLoading,
    error,
    pagination,
    filters,
    fetchCategories,
    deleteCategory,
    setPage,
    setFilters,
    clearFilters,
    openModal,
  } = useKbCategoriesStore()

  // Debounce the search input with 500ms delay
  const debouncedSearch = useDebounce(searchInput, 500)

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters({ search: debouncedSearch || undefined })
  }, [debouncedSearch, setFilters])

  // Update filters when active filter changes
  useEffect(() => {
    if (activeFilter === 'all') {
      setFilters({ isActive: undefined })
    } else {
      setFilters({ isActive: activeFilter === 'active' })
    }
  }, [activeFilter, setFilters])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories, pagination.page, pagination.limit, filters])

  const handleCreateCategory = () => {
    openModal('create')
  }

  const handleEditCategory = (category: ArticleCategory) => {
    openModal('edit', category)
  }

  const handleDeleteCategory = async (category: ArticleCategory) => {
    const articleCount = category._count?.articles ?? 0

    if (articleCount > 0) {
      // Show warning dialog - user can only click OK
      await confirm({
        title: 'Cannot Delete Category',
        message: `This category has ${articleCount} article(s). Please reassign or delete the articles before deleting this category.`,
        confirmText: 'OK',
        cancelText: 'OK',
        variant: 'warning',
      })
      return
    }

    const confirmed = await confirm({
      title: 'Delete Category?',
      message: `Are you sure you want to delete the category "${category.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (confirmed) {
      await deleteCategory(category.id)
    }
  }

  const handleClearFilters = () => {
    setSearchInput('')
    setActiveFilter('all')
    clearFilters()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const hasActiveFilters = searchInput || activeFilter !== 'all'

  return (
    <PageSlot>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">KB Categories</h1>
          <p className="text-default-600 mt-1">Manage article categories</p>
        </div>
        {hasPermission('kb.categories.create') && (
          <Button
            color="primary"
            startContent={<Plus className="h-5 w-5" />}
            onPress={handleCreateCategory}
          >
            Create Category
          </Button>
        )}
      </header>

      {error ? (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-6 dark:border-danger-900/40 dark:bg-danger-950/30">
          <p className="text-danger-800 dark:text-danger-200">{error}</p>
          <Button className="mt-4" variant="flat" onPress={() => void fetchCategories()}>
            Retry
          </Button>
        </div>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="flex flex-wrap items-end gap-4 border-b border-default-200 px-4 py-3">
              <Input
                aria-label="Search categories"
                placeholder="Search categories…"
                className="w-full max-w-sm shrink-0"
                value={searchInput}
                onValueChange={setSearchInput}
                isClearable
                onClear={() => setSearchInput('')}
                startContent={<Search className="size-4 shrink-0 text-default-500" aria-hidden />}
              />
              <SelectField
                className="w-44 shrink-0"
                aria-label="Status"
                value={activeFilter}
                onChange={setActiveFilter}
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                placeholder="All statuses"
              />
              {hasActiveFilters && (
                <Button
                  variant="flat"
                  className="ml-auto shrink-0"
                  startContent={<FilterX className="h-4 w-4" />}
                  onPress={handleClearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <Table
                aria-label="KB Categories table"
                classNames={{
                  wrapper: 'shadow-none',
                }}
              >
                <TableHeader>
                  <TableColumn
                    width={80}
                    className="text-xs font-semibold uppercase tracking-wide text-default-500"
                  >
                    Icon
                  </TableColumn>
                  <TableColumn className="text-xs font-semibold uppercase tracking-wide text-default-500">
                    Name
                  </TableColumn>
                  <TableColumn
                    width={250}
                    className="text-xs font-semibold uppercase tracking-wide text-default-500"
                  >
                    Slug
                  </TableColumn>
                  <TableColumn
                    width={120}
                    className="text-xs font-semibold uppercase tracking-wide text-default-500"
                  >
                    Status
                  </TableColumn>
                  <TableColumn
                    width={120}
                    className="text-xs font-semibold uppercase tracking-wide text-default-500"
                  >
                    Articles
                  </TableColumn>
                  <TableColumn
                    width={150}
                    className="text-xs font-semibold uppercase tracking-wide text-default-500"
                  >
                    Created
                  </TableColumn>
                  <TableColumn
                    width={200}
                    className="text-xs font-semibold uppercase tracking-wide text-default-500"
                  >
                    Actions
                  </TableColumn>
                </TableHeader>
                <TableBody
                  items={categories}
                  isLoading={isLoading}
                  emptyContent={
                    <div className="py-12 text-center">
                      <p className="text-default-500">
                        {isLoading ? 'Loading…' : 'No categories found.'}
                      </p>
                      {!isLoading && hasPermission('kb.categories.create') && (
                        <Button
                          className="mt-4"
                          color="primary"
                          startContent={<Plus className="h-4 w-4" />}
                          onPress={handleCreateCategory}
                        >
                          Create Your First Category
                        </Button>
                      )}
                    </div>
                  }
                >
                  {category => (
                    <TableRow key={category.id}>
                      <TableCell>
                        <span className="text-2xl">{category.icon || 'N/A'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-md flex-col">
                          <span className="truncate font-semibold text-foreground">
                            {category.name}
                          </span>
                          {category.description && (
                            <span className="truncate text-xs text-default-500">
                              {category.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-default-100 px-2 py-1 rounded">
                          /{category.slug}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Chip color={category.isActive ? 'success' : 'default'} size="sm">
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <Chip variant="flat" size="sm">
                          {category._count?.articles ?? 0}
                        </Chip>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-default-500">
                          {formatDate(category.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-start gap-1">
                          {hasPermission('kb.categories.update') && (
                            <Tooltip content="Edit category">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => handleEditCategory(category)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                          {hasPermission('kb.categories.delete') && (
                            <Tooltip content="Delete category" color="danger">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                color="danger"
                                onPress={() => handleDeleteCategory(category)}
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {pagination.total > 0 && (
              <div className="flex flex-col gap-3 border-t border-default-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <span className="text-sm text-default-500">
                  Showing {categories.length} of {pagination.total} categories
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
            )}
          </CardBody>
        </Card>
      )}

      {/* Category Modal */}
      <CategoryModal />
    </PageSlot>
  )
}
