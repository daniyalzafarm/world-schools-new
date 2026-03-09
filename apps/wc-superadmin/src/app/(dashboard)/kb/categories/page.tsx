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
import { FilterX, Pencil, Plus, Trash } from 'lucide-react'
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
    setLimit,
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
    <PageSlot className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">KB Categories</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">Manage article categories</p>
          </div>
          {hasPermission('kb.categories.create') && (
            <Button
              color="primary"
              startContent={<Plus className="h-4 w-4" />}
              onPress={handleCreateCategory}
            >
              Create Category
            </Button>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        <Input
          label="Search"
          placeholder="Search categories..."
          className="w-[280px]"
          value={searchInput}
          onValueChange={setSearchInput}
          isClearable
          onClear={() => setSearchInput('')}
        />
        <SelectField
          className="w-48"
          label="Status"
          value={activeFilter}
          onChange={setActiveFilter}
          options={['all', 'active', 'inactive']}
          placeholder="Select status"
        />
        {hasActiveFilters && (
          <Button
            variant="flat"
            color="primary"
            startContent={<FilterX className="h-4 w-4" />}
            onPress={handleClearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <Card className="border-danger">
          <CardBody>
            <p className="text-danger">{error}</p>
          </CardBody>
        </Card>
      )}

      {/* Categories Table */}
      <Card>
        <CardBody className="p-0">
          <Table
            aria-label="KB Categories table"
            classNames={{
              wrapper: 'shadow-none',
            }}
          >
            <TableHeader>
              <TableColumn>ICON</TableColumn>
              <TableColumn>NAME</TableColumn>
              <TableColumn>SLUG</TableColumn>
              <TableColumn>STATUS</TableColumn>
              <TableColumn>ARTICLES</TableColumn>
              <TableColumn>CREATED</TableColumn>
              <TableColumn>ACTIONS</TableColumn>
            </TableHeader>
            <TableBody
              items={categories}
              isLoading={isLoading}
              emptyContent={
                <div className="text-center py-8">
                  <p className="text-default-400">No categories found</p>
                  {hasPermission('kb.categories.create') && (
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
                    <div className="flex flex-col">
                      <span className="font-medium">{category.name}</span>
                      {category.description && (
                        <span className="text-xs text-default-400 line-clamp-1">
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
                  <TableCell>{formatDate(category.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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
        </CardBody>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <Pagination
            total={pagination.totalPages}
            page={pagination.page}
            onChange={setPage}
            showControls
          />
        </div>
      )}

      {/* Category Modal */}
      <CategoryModal />
    </PageSlot>
  )
}
