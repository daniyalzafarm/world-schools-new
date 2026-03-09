'use client'

import { type Key, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageSlot } from '@/components/layout/page-slot'
import {
  Button,
  Card,
  CardBody,
  Chip,
  Pagination,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Progress,
  type Selection,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Tooltip,
} from '@heroui/react'
import {
  Copy,
  Eye,
  FilterX,
  MoreVertical,
  Pencil,
  Plus,
  SquareCheck,
  SquareChevronDown,
  Trash,
} from 'lucide-react'
import { Input, SelectField, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import { useKbArticlesStore } from '@/stores/kb-articles-store'
import { useKbCategoriesStore } from '@/stores/kb-categories-store'
import { usePermissions } from '@/hooks/use-permissions'
import { type ArticleStats, getArticleStats } from '@/services/kb-articles.service'
import type {
  Article,
  ArticleStatus,
  ArticleType,
  Audience,
} from '@world-schools/wc-frontend-utils'

export default function KbArticlesPage() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [audienceFilter, setAudienceFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'title' | 'views' | 'updatedAt' | undefined>()
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>()
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set() as Selection)
  const [globalStats, setGlobalStats] = useState<ArticleStats | null>(null)

  const { confirm } = useConfirmDialog()
  const { hasPermission } = usePermissions()

  const {
    articles,
    isLoading,
    pagination,
    fetchArticles,
    deleteArticle,
    updateArticle,
    publishArticle,
    unpublishArticle,
    duplicateArticle,
    setPage,
    setFilters,
    clearFilters,
  } = useKbArticlesStore()

  const { categories, fetchCategories } = useKbCategoriesStore()

  const debouncedSearch = useDebounce(searchInput, 500)

  // Fetch articles and categories on mount
  useEffect(() => {
    void fetchArticles()
    void fetchCategories()
  }, [fetchArticles, fetchCategories])

  const loadGlobalStats = useCallback(async () => {
    const response = await getArticleStats()
    if (response.success && response.data) {
      setGlobalStats(response.data)
    }
  }, [])

  useEffect(() => {
    void loadGlobalStats()
  }, [loadGlobalStats])

  // Update filters when debounced search or filters change
  useEffect(() => {
    const filters: Record<string, unknown> = {
      search: debouncedSearch || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
      audience: audienceFilter === 'all' ? undefined : [audienceFilter as Audience],
      categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
      articleType: typeFilter === 'all' ? undefined : typeFilter,
      sortBy: sortBy ?? undefined,
      sortOrder: sortOrder ?? undefined,
    }

    setFilters(filters)
    void fetchArticles()
  }, [
    debouncedSearch,
    statusFilter,
    audienceFilter,
    categoryFilter,
    typeFilter,
    sortBy,
    sortOrder,
    setFilters,
    fetchArticles,
  ])

  // Handle page change
  const handlePageChange = (page: number) => {
    setPage(page)
    void fetchArticles()
  }

  // Handle clear filters
  const handleClearFilters = () => {
    setSearchInput('')
    setStatusFilter('all')
    setAudienceFilter('all')
    setCategoryFilter('all')
    setTypeFilter('all')
    clearFilters()
    setSortBy(undefined)
    setSortOrder(undefined)
    setSelectedKeys(new Set() as Selection)
    void fetchArticles()
  }

  // Handle delete
  const handleDelete = async (article: Article) => {
    const confirmed = await confirm({
      title: 'Delete Article',
      message: `Are you sure you want to delete "${article.title}"? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (confirmed) {
      const success = await deleteArticle(article.id)
      if (success) {
        void fetchArticles()
        void loadGlobalStats()
      }
    }
  }

  // Handle publish/unpublish
  const handleTogglePublish = async (article: Article) => {
    const isPublished = article.status === 'published'
    const action = isPublished ? 'unpublish' : 'publish'

    const confirmed = await confirm({
      title: isPublished ? 'Unpublish Article' : 'Publish Article',
      message: `Are you sure you want to ${action} "${article.title}"?`,
      confirmText: isPublished ? 'Unpublish' : 'Publish',
      cancelText: 'Cancel',
    })

    if (confirmed) {
      const success = isPublished
        ? await unpublishArticle(article.id)
        : await publishArticle(article.id)

      if (success) {
        void fetchArticles()
        void loadGlobalStats()
      }
    }
  }

  // Handle duplicate
  const handleDuplicate = async (article: Article) => {
    const confirmed = await confirm({
      title: 'Duplicate Article',
      message: `Create a copy of "${article.title}"?`,
      confirmText: 'Duplicate',
      cancelText: 'Cancel',
      variant: 'info',
    })

    if (confirmed) {
      const success = await duplicateArticle(article.id)
      if (success) {
        void fetchArticles()
        void loadGlobalStats()
      }
    }
  }

  const hasActiveFilters =
    searchInput || statusFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all'

  const canCreate = hasPermission('kb.articles.create')
  const canUpdate = hasPermission('kb.articles.update')
  const canPublish = hasPermission('kb.articles.publish')
  const canDuplicate = hasPermission('kb.articles.duplicate')
  const canDelete = hasPermission('kb.articles.delete')

  const selectedArticleIds = useMemo(() => {
    if (selectedKeys === 'all') {
      return articles.map(article => article.id)
    }
    return Array.from(selectedKeys).map(String)
  }, [selectedKeys, articles])

  const selectedArticles = useMemo(
    () => articles.filter(article => selectedArticleIds.includes(article.id)),
    [articles, selectedArticleIds]
  )

  const parentCount = useMemo(
    () => articles.filter(article => article.audience.includes('parents' as Audience)).length,
    [articles]
  )

  const providerCount = useMemo(
    () => articles.filter(article => article.audience.includes('providers' as Audience)).length,
    [articles]
  )

  const staffCount = useMemo(
    () => articles.filter(article => article.audience.includes('staff' as Audience)).length,
    [articles]
  )

  const hasBulkSelection = selectedArticleIds.length > 0

  const bulkPublishMode: 'publish' | 'unpublish' | null = useMemo(() => {
    if (!hasBulkSelection || selectedArticles.length === 0) return null

    if (selectedArticles.length === 1) {
      return selectedArticles[0].status === 'published' ? 'unpublish' : 'publish'
    }

    const hasDraft = selectedArticles.some(article => article.status === 'draft')
    return hasDraft ? 'publish' : 'unpublish'
  }, [hasBulkSelection, selectedArticles])

  const totalArticlesStat = globalStats?.total ?? pagination.total
  const publishedStat = globalStats?.published ?? 0
  const draftsStat = globalStats?.drafts ?? 0
  const avgHelpfulPct = globalStats?.avgHelpfulness ?? 0

  // Helper functions
  const getStatusColor = (status: ArticleStatus) => {
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

  const getTypeLabel = (type: ArticleType) => {
    switch (type) {
      case 'how_to':
        return 'How-to'
      case 'faq':
        return 'FAQ'
      case 'reference':
        return 'Reference'
      case 'policy':
        return 'Policy'
      default:
        return type
    }
  }

  const getAudienceLabel = (aud: Audience) => {
    switch (aud) {
      case 'parents':
        return 'Parents'
      case 'providers':
        return 'Providers'
      case 'staff':
        return 'Staff'
      default:
        return aud
    }
  }

  const getAudienceColor = (aud: Audience) => {
    switch (aud) {
      case 'parents':
        return 'primary'
      case 'providers':
        return 'secondary'
      case 'staff':
        return 'warning'
      default:
        return 'default'
    }
  }

  const handleSort = (column: 'title' | 'views' | 'updatedAt') => {
    const isSameColumn = sortBy === column
    const nextOrder: 'asc' | 'desc' = isSameColumn && sortOrder === 'asc' ? 'desc' : 'asc'
    setSortBy(column)
    setSortOrder(nextOrder)
  }

  const handleBulkPublish = async () => {
    if (!hasBulkSelection || !canPublish || !bulkPublishMode) return

    const targetArticles =
      bulkPublishMode === 'publish'
        ? selectedArticles.filter(article => article.status !== 'published')
        : selectedArticles.filter(article => article.status === 'published')

    if (targetArticles.length === 0) return

    const confirmed = await confirm({
      title:
        bulkPublishMode === 'publish' ? 'Publish selected articles' : 'Unpublish selected articles',
      message:
        bulkPublishMode === 'publish'
          ? `Are you sure you want to publish ${targetArticles.length} selected article(s)?`
          : `Are you sure you want to unpublish ${targetArticles.length} selected article(s)?`,
      confirmText: bulkPublishMode === 'publish' ? 'Publish' : 'Unpublish',
      cancelText: 'Cancel',
      variant: bulkPublishMode === 'unpublish' ? 'warning' : undefined,
    })

    if (!confirmed) return

    if (bulkPublishMode === 'publish') {
      await Promise.allSettled(targetArticles.map(article => publishArticle(article.id)))
    } else {
      await Promise.allSettled(targetArticles.map(article => unpublishArticle(article.id)))
    }

    setSelectedKeys(new Set() as Selection)
    void fetchArticles()
    void loadGlobalStats()
  }

  const handleBulkArchive = async () => {
    if (!hasBulkSelection || !canUpdate) return

    const confirmed = await confirm({
      title: 'Archive selected articles',
      message: `Are you sure you want to archive ${selectedArticleIds.length} selected article(s)?`,
      confirmText: 'Archive',
      cancelText: 'Cancel',
      variant: 'danger',
    })

    if (!confirmed) return

    await Promise.allSettled(
      selectedArticleIds.map(id => updateArticle(id, { status: 'archived' as ArticleStatus }))
    )

    setSelectedKeys(new Set() as Selection)
    void fetchArticles()
    void loadGlobalStats()
  }

  return (
    <PageSlot className="max-w-400 space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Public Knowledge Base
          </h1>
          <p className="text-default-500 mt-1">
            Articles visible to parents, providers, and staff in their Help Centers. Published
            articles are public.
          </p>
        </div>
        {canCreate && (
          <Button
            color="primary"
            startContent={<Plus className="h-4 w-4" />}
            onPress={() => router.push('/kb/articles/create')}
          >
            Create Article
          </Button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Total Articles
            </p>
            <p className="text-2xl font-bold text-foreground">{totalArticlesStat}</p>
            <p className="text-xs text-default-500">Across all audiences</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Published
            </p>
            <p className="text-2xl font-bold text-success">{publishedStat}</p>
            <p className="text-xs text-success">Live in Help Center</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">Drafts</p>
            <p className="text-2xl font-bold text-default-700">{draftsStat}</p>
            <p className="text-xs text-warning">Needs publishing</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-default-500">
              Avg. Helpfulness
            </p>
            <p className="text-2xl font-bold text-foreground">{avgHelpfulPct}%</p>
            <p className="text-xs text-success">Based on article feedback</p>
          </CardBody>
        </Card>
      </div>

      {/* Filter Card + Table */}
      <Card>
        <CardBody className="p-0">
          {/* Audience Tabs */}
          <div className="flex gap-2 border-b border-default-200 px-4 pt-3">
            <button
              type="button"
              onClick={() => setAudienceFilter('all')}
              className={`cursor-pointer flex items-center gap-2 rounded-t-md px-3 pb-2 text-sm font-medium ${
                audienceFilter === 'all'
                  ? 'border-b-2 border-primary text-primary-600'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              <span>All</span>
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-[10px] font-semibold">
                {pagination.total}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAudienceFilter('parents')}
              className={`cursor-pointer flex items-center gap-2 rounded-t-md px-3 pb-2 text-sm font-medium ${
                audienceFilter === 'parents'
                  ? 'border-b-2 border-primary text-primary-600'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              <span>For Parents</span>
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-[10px] font-semibold">
                {parentCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAudienceFilter('providers')}
              className={`cursor-pointer flex items-center gap-2 rounded-t-md px-3 pb-2 text-sm font-medium ${
                audienceFilter === 'providers'
                  ? 'border-b-2 border-primary text-primary-600'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              <span>For Providers</span>
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-[10px] font-semibold">
                {providerCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAudienceFilter('staff')}
              className={`cursor-pointer flex items-center gap-2 rounded-t-md px-3 pb-2 text-sm font-medium ${
                audienceFilter === 'staff'
                  ? 'border-b-2 border-primary text-primary-600'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              <span>For Staff</span>
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-[10px] font-semibold">
                {staffCount}
              </span>
            </button>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap items-end gap-4 border-b border-default-200 px-4 py-3">
            <Input
              aria-label="Search"
              placeholder="Search articles..."
              className="w-full max-w-sm shrink-0"
              value={searchInput}
              onValueChange={setSearchInput}
              isClearable
              onClear={() => setSearchInput('')}
            />

            <SelectField
              className="w-full md:w-40 shrink-0"
              aria-label="Category"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                {
                  value: 'all',
                  label: 'All categories',
                },
                ...categories.map(c => ({
                  value: c.id,
                  label: c.name,
                })),
              ]}
              placeholder="All categories"
            />

            <SelectField
              className="w-full md:w-40 shrink-0"
              aria-label="Type"
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                {
                  value: 'all',
                  label: 'All types',
                },
                {
                  value: 'how_to',
                  label: 'How-to',
                },
                {
                  value: 'faq',
                  label: 'FAQ',
                },
                {
                  value: 'reference',
                  label: 'Reference',
                },
                {
                  value: 'policy',
                  label: 'Policy',
                },
              ]}
              placeholder="All types"
            />

            <SelectField
              className="w-full md:w-40 shrink-0"
              aria-label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                {
                  value: 'all',
                  label: 'All statuses',
                },
                {
                  value: 'published',
                  label: 'Published',
                },
                {
                  value: 'draft',
                  label: 'Draft',
                },
                {
                  value: 'archived',
                  label: 'Archived',
                },
              ]}
              placeholder="All statuses"
            />

            <div className="ml-auto flex items-center gap-3">
              {hasActiveFilters && (
                <Button
                  variant="flat"
                  startContent={<FilterX className="h-4 w-4" />}
                  onPress={handleClearFilters}
                >
                  Clear Filters
                </Button>
              )}

              {hasBulkSelection && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-default-500">
                    {selectedArticleIds.length} selected:
                  </span>
                  {canPublish && bulkPublishMode && (
                    <Button size="sm" color="primary" onPress={handleBulkPublish}>
                      {bulkPublishMode === 'publish' ? 'Publish' : 'Unpublish'}
                    </Button>
                  )}
                  {/* {canUpdate && (
                    <Button size="sm" color="warning" onPress={handleBulkArchive}>
                      Archive
                    </Button>
                  )} */}
                </div>
              )}
            </div>
          </div>

          {/* Articles Table */}
          <div className="overflow-x-auto">
            <Table
              aria-label="Articles table"
              selectionMode="multiple"
              selectedKeys={selectedKeys}
              onSelectionChange={setSelectedKeys}
              classNames={{
                wrapper: 'shadow-none',
              }}
            >
              <TableHeader>
                <TableColumn
                  className="min-w-[240px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-default-500"
                  onClick={() => handleSort('title')}
                >
                  <div className="flex items-center gap-1">
                    <span>Article</span>
                    {sortBy === 'title' && (
                      <span className="text-[10px]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </TableColumn>
                <TableColumn className="min-w-[120px] text-xs font-semibold uppercase tracking-wide text-default-500">
                  Audience
                </TableColumn>
                <TableColumn className="min-w-[120px] text-xs font-semibold uppercase tracking-wide text-default-500">
                  Category
                </TableColumn>
                <TableColumn className="min-w-[100px] text-xs font-semibold uppercase tracking-wide text-default-500">
                  Type
                </TableColumn>
                <TableColumn className="min-w-[100px] text-xs font-semibold uppercase tracking-wide text-default-500">
                  Status
                </TableColumn>
                <TableColumn
                  className="min-w-[80px] cursor-pointer select-none text-right text-xs font-semibold uppercase tracking-wide text-default-500"
                  onClick={() => handleSort('views')}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Views</span>
                    {sortBy === 'views' && (
                      <span className="text-[10px]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </TableColumn>
                <TableColumn className="min-w-[120px] text-xs font-semibold uppercase tracking-wide text-default-500">
                  Helpful
                </TableColumn>
                <TableColumn
                  className="min-w-[140px] cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-default-500"
                  onClick={() => handleSort('updatedAt')}
                >
                  <div className="flex items-center gap-1">
                    <span>Updated</span>
                    {sortBy === 'updatedAt' && (
                      <span className="text-[10px]">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </TableColumn>
                <TableColumn className="w-[120px] text-right text-xs font-semibold uppercase tracking-wide text-default-500">
                  Actions
                </TableColumn>
              </TableHeader>
              <TableBody
                items={articles}
                isLoading={isLoading}
                emptyContent={
                  <div className="py-12 text-center">
                    <p className="text-default-500">No articles found</p>
                    {canCreate && (
                      <Button
                        color="primary"
                        className="mt-4"
                        startContent={<Plus className="h-4 w-4" />}
                        onPress={() => router.push('/kb/articles/create')}
                      >
                        Create First Article
                      </Button>
                    )}
                  </div>
                }
              >
                {article => {
                  const totalVotes = article.helpfulCount + article.notHelpfulCount
                  const helpfulPct =
                    totalVotes > 0 ? Math.round((article.helpfulCount / totalVotes) * 100) : 0
                  const updatedAt =
                    article.lastUpdatedAt ?? article.updatedAt ?? article.publishedAt

                  return (
                    <TableRow key={article.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => router.push(`/kb/articles/${article.id}/edit`)}
                            className="cursor-pointer text-left text-sm font-semibold text-foreground hover:text-primary-600"
                          >
                            {article.title}
                          </button>
                          <span className="text-xs font-mono text-default-400">
                            /help/{article.category?.slug ?? ''}/{article.slug}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {article.audience.map(aud => (
                            <Chip key={aud} size="sm" color={getAudienceColor(aud)} variant="flat">
                              {getAudienceLabel(aud)}
                            </Chip>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {article.category ? (
                          <div className="flex items-center gap-2">
                            {article.category.icon && <span>{article.category.icon}</span>}
                            <span className="text-sm text-default-700">
                              {article.category.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-default-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-default-100 px-2 py-1 text-xs font-medium text-default-700">
                          {getTypeLabel(article.articleType)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip size="sm" color={getStatusColor(article.status)} variant="dot">
                          {article.status.charAt(0).toUpperCase() + article.status.slice(1)}
                        </Chip>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-semibold text-default-700">
                          {article.views.toLocaleString()}
                        </span>
                        <div className="text-[11px] text-default-400">views</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="w-10 text-right text-sm font-semibold text-default-700">
                            {helpfulPct}%
                          </span>
                          <Progress
                            className="w-20 h-2"
                            value={helpfulPct}
                            maxValue={100}
                            color="success"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {updatedAt ? (
                          <span className="whitespace-nowrap text-sm text-default-500">
                            {new Date(updatedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-xs text-default-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip content="Preview">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="light"
                              onPress={() => router.push(`/kb/articles/${article.id}/preview`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                          {canUpdate && (
                            <Tooltip content="Edit">
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                onPress={() => router.push(`/kb/articles/${article.id}/edit`)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                          <Popover placement="bottom-end">
                            <PopoverTrigger>
                              <Button isIconOnly size="sm" variant="light">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-1">
                              <div className="flex flex-col text-sm">
                                {canPublish && (
                                  <Button
                                    onPress={() => handleTogglePublish(article)}
                                    startContent={
                                      article.status === 'published' ? (
                                        <SquareChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <SquareCheck className="h-3.5 w-3.5" />
                                      )
                                    }
                                    variant="light"
                                    className="justify-start"
                                  >
                                    {article.status === 'published' ? 'Unpublish' : 'Publish'}
                                  </Button>
                                )}
                                {canDuplicate && (
                                  <Button
                                    onPress={() => handleDuplicate(article)}
                                    startContent={<Copy className="h-3.5 w-3.5" />}
                                    variant="light"
                                    className="justify-start"
                                  >
                                    Duplicate
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button
                                    onPress={() => handleDelete(article)}
                                    startContent={<Trash className="h-3.5 w-3.5" />}
                                    variant="light"
                                    color="danger"
                                    className="justify-start"
                                  >
                                    Delete article
                                  </Button>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }}
              </TableBody>
            </Table>
          </div>

          {/* Table Footer */}
          {pagination.total > 0 && (
            <div className="flex items-center justify-between border-t border-default-200 px-6 py-4">
              <span className="text-sm text-default-500">
                Showing {articles.length} of {pagination.total} articles
              </span>
              {pagination.totalPages > 1 && (
                <Pagination
                  total={pagination.totalPages}
                  page={pagination.page}
                  onChange={handlePageChange}
                  showControls
                />
              )}
            </div>
          )}
        </CardBody>
      </Card>
    </PageSlot>
  )
}
