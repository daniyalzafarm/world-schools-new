'use client'

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  addToast,
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Code,
  Divider,
  Progress,
} from '@heroui/react'
import { Input, SelectField, Textarea, useConfirmDialog, useDebounce } from '@world-schools/ui-web'
import { CheckCircle, CircleAlert, Code2, Eye, Loader2, Wand2, X } from 'lucide-react'
import { useKbCategoriesStore } from '@/stores/kb-categories-store'
import { useKbArticlesStore } from '@/stores/kb-articles-store'
import { checkArticleSlugAvailability, getArticles } from '@/services/kb-articles.service'
import { ArticleEditorCanvas } from '@/components/kb/ArticleEditorCanvas'
import { ArticleEditorSettingsPanel } from '@/components/kb/ArticleEditorSettingsPanel'
import { UnsavedChangesDialog } from '@/components/kb/UnsavedChangesDialog'
import { useArticleEditorLayoutOptional } from '@/components/kb/ArticleEditorLayoutContext'
import type {
  Article,
  ArticleStatus,
  ArticleType,
  Audience,
  CreateArticleData,
} from '@world-schools/wc-frontend-utils'
import { KB_ALLOWED_ATTRIBUTES, KB_ALLOWED_CLASSES, KB_ALLOWED_TAGS } from '@world-schools/wc-utils'
import Editor from '@monaco-editor/react'
import type { editor as MonacoEditor } from 'monaco-editor'

const ARTICLE_TYPES: { value: ArticleType; label: string }[] = [
  { value: 'how_to' as ArticleType, label: 'How-to' },
  { value: 'faq' as ArticleType, label: 'FAQ' },
  { value: 'reference' as ArticleType, label: 'Reference' },
  { value: 'policy' as ArticleType, label: 'Policy' },
]

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: 'parents' as Audience, label: 'Parents' },
  { value: 'providers' as Audience, label: 'Providers' },
  { value: 'staff' as Audience, label: 'Staff' },
]

const STATUSES: { value: ArticleStatus; label: string }[] = [
  { value: 'draft' as ArticleStatus, label: 'Draft' },
  { value: 'published' as ArticleStatus, label: 'Published' },
  { value: 'archived' as ArticleStatus, label: 'Archived' },
]

const KB_ALLOWED_TAGS_TEXT = KB_ALLOWED_TAGS.join(', ')
const KB_ALLOWED_ATTRIBUTES_TEXT = KB_ALLOWED_ATTRIBUTES.join(', ')
const KB_ALLOWED_CLASSES_TEXT = KB_ALLOWED_CLASSES.join(', ')

function formatPublicationDate(value?: string | null): string {
  if (!value) return '-'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date)
}

type FormSnapshot = {
  title: string
  slug: string
  articleType: ArticleType
  audience: Audience[]
  categoryId: string
  contentHtml: string
  summary: string
  metaTitle: string
  metaDescription: string
  relatedArticleIds: string[]
}

function formSnapshotFromState(state: {
  title: string
  slug: string
  articleType: ArticleType
  audience: Audience[]
  categoryId: string
  contentHtml: string
  summary: string
  metaTitle: string
  metaDescription: string
  relatedArticleIds: string[]
}): FormSnapshot {
  return {
    title: state.title,
    slug: state.slug,
    articleType: state.articleType,
    audience: [...state.audience],
    categoryId: state.categoryId,
    contentHtml: state.contentHtml,
    summary: state.summary,
    metaTitle: state.metaTitle,
    metaDescription: state.metaDescription,
    relatedArticleIds: [...state.relatedArticleIds],
  }
}

function isFormSnapshotEqual(a: FormSnapshot, b: FormSnapshot): boolean {
  return (
    a.title === b.title &&
    a.slug === b.slug &&
    a.articleType === b.articleType &&
    a.categoryId === b.categoryId &&
    a.contentHtml === b.contentHtml &&
    a.summary === b.summary &&
    a.metaTitle === b.metaTitle &&
    a.metaDescription === b.metaDescription &&
    a.audience.length === b.audience.length &&
    a.audience.every((v, i) => v === b.audience[i]) &&
    a.relatedArticleIds.length === b.relatedArticleIds.length &&
    a.relatedArticleIds.every((v, i) => v === b.relatedArticleIds[i])
  )
}

interface ArticleFormProps {
  article?: Article
  onSubmit: (data: CreateArticleData) => Promise<boolean>
  isLoading?: boolean
}

export function ArticleForm({ article, onSubmit, isLoading }: ArticleFormProps) {
  const router = useRouter()
  const { confirm } = useConfirmDialog()
  const { categories, fetchCategories } = useKbCategoriesStore()
  const {
    publishArticle: storePublishArticle,
    unpublishArticle: storeUnpublishArticle,
    error: storeError,
    clearError: clearStoreError,
  } = useKbArticlesStore()
  const editorLayout = useArticleEditorLayoutOptional()
  const setRightSidebar = editorLayout?.setRightSidebar
  const setTopBarConfig = editorLayout?.setTopBarConfig
  const resetTopBarConfig = editorLayout?.resetTopBarConfig

  // Form state
  const [title, setTitle] = useState(article?.title || '')
  const [slug, setSlug] = useState(article?.slug || '')
  const [articleType, setArticleType] = useState<ArticleType>(
    article?.articleType || ('how_to' as ArticleType)
  )
  const [audience, setAudience] = useState<Audience[]>(article?.audience ?? [])
  const [categoryId, setCategoryId] = useState(article?.categoryId || '')
  const [status, setStatus] = useState<ArticleStatus>(article?.status || ('draft' as ArticleStatus))
  const [contentHtml, setContentHtml] = useState(article?.contentHtml || '')
  const [summary, setSummary] = useState(article?.summary || '')
  const [metaTitle, setMetaTitle] = useState(article?.metaTitle || '')
  const [metaDescription, setMetaDescription] = useState(article?.metaDescription || '')

  // Slug validation state
  const [slugError, setSlugError] = useState<string | null>(null)
  const [isCheckingSlug, setIsCheckingSlug] = useState(false)
  type SlugCheckStatus = 'idle' | 'checking' | 'available' | 'unavailable'
  const [slugCheckStatus, setSlugCheckStatus] = useState<SlugCheckStatus>('idle')
  const debouncedSlug = useDebounce(slug, 500)
  const userHasEditedSlugRef = useRef(false)

  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Related articles: IDs for submit, list for display
  type RelatedArticleItem = { id: string; title: string; slug?: string }
  const [relatedArticleIds, setRelatedArticleIds] = useState<string[]>(() => {
    const from = article?.relatedFrom as
      | Array<{
          sortOrder?: number
          relatedArticle?: { id: string }
          relatedArticleId?: string
          id: string
        }>
      | undefined
    if (!from?.length) return []
    const sorted = [...from].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    return sorted.map(r => r.relatedArticle?.id ?? r.relatedArticleId ?? r.id)
  })
  const [selectedRelatedArticles, setSelectedRelatedArticles] = useState<RelatedArticleItem[]>(
    () => {
      const from = article?.relatedFrom as
        | Array<{ sortOrder?: number; relatedArticle?: RelatedArticleItem } & RelatedArticleItem>
        | undefined
      if (!from?.length) return []
      const sorted = [...from].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      return sorted.map(r => {
        const a = r.relatedArticle ?? r
        return { id: a.id, title: a.title, slug: a.slug }
      })
    }
  )
  const [relatedSearchQuery, setRelatedSearchQuery] = useState('')
  const relatedSearchQueryDebounced = useDebounce(relatedSearchQuery, 300)
  const [relatedSearchResults, setRelatedSearchResults] = useState<Article[]>([])
  const [relatedSearchLoading, setRelatedSearchLoading] = useState(false)

  // Load categories on mount
  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  // Auto-generate slug from title in create mode (real-time); stop overwriting once user edits slug
  useEffect(() => {
    if (article) return
    const generatedSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (!userHasEditedSlugRef.current) {
      setSlug(generatedSlug)
    }
  }, [title, article])

  // Validate slug availability
  useEffect(() => {
    const validateSlug = async () => {
      if (!debouncedSlug) {
        setSlugError(null)
        setSlugCheckStatus('idle')
        return
      }

      // Skip validation if editing and slug hasn't changed
      if (debouncedSlug === article?.slug) {
        setSlugError(null)
        setSlugCheckStatus('idle')
        return
      }

      // Validate slug format
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      if (!slugRegex.test(debouncedSlug)) {
        setSlugError('Slug must be lowercase alphanumeric with hyphens only')
        setSlugCheckStatus('unavailable')
        return
      }

      setIsCheckingSlug(true)
      setSlugCheckStatus('checking')
      const response = await checkArticleSlugAvailability(debouncedSlug)

      if (response.success && response.data) {
        if (!response.data.available) {
          setSlugError('This slug is already in use')
          setSlugCheckStatus('unavailable')
        } else {
          setSlugError(null)
          setSlugCheckStatus('available')
        }
      } else {
        setSlugCheckStatus('idle')
      }
      setIsCheckingSlug(false)
    }

    void validateSlug()
  }, [debouncedSlug, article])

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!title.trim()) newErrors.title = 'Title is required'
    if (!slug.trim()) newErrors.slug = 'Slug is required'
    if (slugError) newErrors.slug = slugError
    if (!audience?.length) newErrors.audience = 'At least one audience is required'
    if (!categoryId) newErrors.categoryId = 'Category is required'
    if (!contentHtml.trim()) newErrors.contentHtml = 'Content is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Clear a field's error when its value becomes filled (real-time error clearing)
  const validatedFieldChecks: Array<{ key: keyof typeof errors; filled: boolean }> = [
    { key: 'title', filled: title.trim() !== '' },
    { key: 'slug', filled: slug.trim() !== '' },
    { key: 'categoryId', filled: !!categoryId },
    { key: 'audience', filled: audience.length > 0 },
    { key: 'contentHtml', filled: contentHtml.trim() !== '' },
  ]
  useEffect(() => {
    setErrors(prev => {
      let next: Record<string, string> = prev
      for (const { key, filled } of validatedFieldChecks) {
        if (prev[key] !== undefined && filled) {
          const { [key]: _, ...rest } = next
          next = rest
        }
      }
      return next
    })
  }, [title, slug, categoryId, audience, contentHtml])

  const [activeEditorTab, setActiveEditorTab] = useState<'code' | 'preview'>('code')
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<FormSnapshot | null>(() =>
    article
      ? formSnapshotFromState({
          title: article.title,
          slug: article.slug,
          articleType: article.articleType as ArticleType,
          audience: (article.audience ?? []) as Audience[],
          categoryId: article.categoryId || '',
          contentHtml: article.contentHtml || '',
          summary: article.summary || '',
          metaTitle: article.metaTitle || '',
          metaDescription: article.metaDescription || '',
          relatedArticleIds: (
            article.relatedFrom as Array<{
              relatedArticle?: { id: string }
              relatedArticleId?: string
              id: string
            }>
          )?.length
            ? (
                article.relatedFrom as Array<{
                  relatedArticle?: { id: string }
                  relatedArticleId?: string
                  id: string
                }>
              ).map(r => r.relatedArticle?.id ?? r.relatedArticleId ?? r.id)
            : [],
        })
      : null
  )
  const [showAllowedHtml, setShowAllowedHtml] = useState(false)
  const monacoEditorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    if (!article) return
    setLastSavedSnapshot(
      formSnapshotFromState({
        title: article.title,
        slug: article.slug,
        articleType: article.articleType as ArticleType,
        audience: (article.audience ?? []) as Audience[],
        categoryId: article.categoryId || '',
        contentHtml: article.contentHtml || '',
        summary: article.summary || '',
        metaTitle: article.metaTitle || '',
        metaDescription: article.metaDescription || '',
        relatedArticleIds: (
          article.relatedFrom as Array<{
            relatedArticle?: { id: string }
            relatedArticleId?: string
            id: string
          }>
        )?.length
          ? (
              article.relatedFrom as Array<{
                relatedArticle?: { id: string }
                relatedArticleId?: string
                id: string
              }>
            ).map(r => r.relatedArticle?.id ?? r.relatedArticleId ?? r.id)
          : [],
      })
    )
  }, [article?.id])

  const currentSnapshot = useMemo(
    () =>
      formSnapshotFromState({
        title,
        slug,
        articleType,
        audience,
        categoryId,
        contentHtml,
        summary,
        metaTitle,
        metaDescription,
        relatedArticleIds,
      }),
    [
      title,
      slug,
      articleType,
      audience,
      categoryId,
      contentHtml,
      summary,
      metaTitle,
      metaDescription,
      relatedArticleIds,
    ]
  )

  const isDirtyEdit =
    !!article &&
    lastSavedSnapshot !== null &&
    !isFormSnapshotEqual(currentSnapshot, lastSavedSnapshot)
  const isDirtyCreate =
    !article &&
    (title.trim() !== '' ||
      slug.trim() !== '' ||
      contentHtml.trim() !== '' ||
      metaTitle.trim() !== '' ||
      metaDescription.trim() !== '')
  const isDirty = article ? isDirtyEdit : isDirtyCreate

  // Surface backend errors from the store as a toast so failures aren't silent.
  useEffect(() => {
    if (!storeError) return
    addToast({
      title: 'Save failed',
      description: storeError,
      color: 'danger',
      timeout: 5000,
    })
    clearStoreError()
  }, [storeError, clearStoreError])

  const copyToClipboard = useCallback(async (text: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(text)
      addToast({
        description: 'Text copied to clipboard',
        color: 'success',
        timeout: 1000,
      })
    } catch {
      // Best-effort only; ignore errors
    }
  }, [])

  // Handle form submission (create or edit with redirect)
  const submitArticle = async (submitStatus?: ArticleStatus) => {
    if (!validateForm()) return false

    const data: CreateArticleData = {
      title,
      slug,
      articleType,
      audience,
      categoryId,
      status: submitStatus ?? status,
      contentHtml,
      summary: summary || undefined,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      ...(article
        ? { relatedArticleIds }
        : relatedArticleIds.length > 0
          ? { relatedArticleIds }
          : {}),
    }

    const success = await onSubmit(data)
    if (success) {
      router.push('/kb/articles')
    }
    return success
  }

  // Edit only: save content without changing status, no navigation
  const saveWithoutStatusChange = useCallback(async (): Promise<boolean> => {
    if (!article || !validateForm()) return false
    const data: CreateArticleData = {
      title,
      slug,
      articleType,
      audience,
      categoryId,
      status: article.status,
      contentHtml,
      summary: summary || undefined,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      relatedArticleIds,
    }
    const success = await onSubmit(data)
    if (success) {
      setLastSavedSnapshot(currentSnapshot)
    }
    return success
  }, [
    article,
    title,
    slug,
    articleType,
    audience,
    categoryId,
    contentHtml,
    summary,
    metaTitle,
    metaDescription,
    relatedArticleIds,
    currentSnapshot,
    onSubmit,
  ])

  const handleTogglePublish = useCallback(async () => {
    if (!article) return
    const isPublished = article.status === 'published'
    const action = isPublished ? 'unpublish' : 'publish'
    const confirmed = await confirm({
      title: isPublished ? 'Unpublish Article' : 'Publish Article',
      message: `Are you sure you want to ${action} "${article.title}"?`,
      confirmText: isPublished ? 'Unpublish' : 'Publish',
      cancelText: 'Cancel',
      variant: isPublished ? 'danger' : 'info',
    })
    if (confirmed) {
      await (isPublished ? storeUnpublishArticle(article.id) : storePublishArticle(article.id))
    }
  }, [article, confirm, storePublishArticle, storeUnpublishArticle])

  const handleBackClick = useCallback(() => {
    if (!isDirty) {
      router.push('/kb/articles')
      return
    }
    setShowUnsavedDialog(true)
  }, [isDirty, router])

  const handleUnsavedSave = useCallback(async () => {
    if (article) {
      const ok = await saveWithoutStatusChange()
      if (ok) {
        setShowUnsavedDialog(false)
        router.push('/kb/articles')
      }
    } else {
      const success = await submitArticle()
      if (success) setShowUnsavedDialog(false)
    }
  }, [article, saveWithoutStatusChange, submitArticle, router])

  const handleUnsavedDiscard = useCallback(() => {
    setShowUnsavedDialog(false)
    router.push('/kb/articles')
  }, [router])

  const handleUnsavedCancel = useCallback(() => {
    setShowUnsavedDialog(false)
  }, [])

  useEffect(() => {
    if (!setTopBarConfig || !resetTopBarConfig) return
    setTopBarConfig({
      title: article?.title ?? 'Create Article',
      breadcrumb: 'Knowledge Base',
      status: article?.status,
      onBackClick: handleBackClick,
      actions: article ? (
        <>
          <Button
            color="secondary"
            isDisabled={!isDirty}
            onPress={() => void saveWithoutStatusChange()}
          >
            Save
          </Button>
          <Button
            color={article.status === 'published' ? 'danger' : 'primary'}
            isDisabled={isDirty}
            onPress={() => void handleTogglePublish()}
          >
            {article.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
        </>
      ) : (
        <Button color="primary" onPress={() => void submitArticle()}>
          Save
        </Button>
      ),
    })
    return () => {
      resetTopBarConfig()
    }
  }, [
    setTopBarConfig,
    resetTopBarConfig,
    article,
    isDirty,
    handleBackClick,
    saveWithoutStatusChange,
    handleTogglePublish,
  ])

  // Toggle audience selection
  const toggleAudience = (aud: Audience) => {
    setAudience(prev => (prev.includes(aud) ? prev.filter(a => a !== aud) : [...prev, aud]))
  }

  // Related articles search
  useEffect(() => {
    if (!relatedSearchQueryDebounced.trim()) {
      setRelatedSearchResults([])
      return
    }
    let cancelled = false
    setRelatedSearchLoading(true)
    void getArticles({ search: relatedSearchQueryDebounced, limit: 10, searchBy: 'title' })
      .then(res => {
        if (cancelled || !res.success || !res.data) return
        const list = Array.isArray(res.data) ? res.data : []
        setRelatedSearchResults(list)
      })
      .finally(() => {
        if (!cancelled) setRelatedSearchLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [relatedSearchQueryDebounced])

  const addRelatedArticle = useCallback(
    (a: Article) => {
      if (article?.id && a.id === article.id) return
      if (relatedArticleIds.includes(a.id)) return
      setRelatedArticleIds(prev => [...prev, a.id])
      setSelectedRelatedArticles(prev => [...prev, { id: a.id, title: a.title, slug: a.slug }])
      setRelatedSearchQuery('')
      setRelatedSearchResults([])
    },
    [article?.id, relatedArticleIds]
  )

  const removeRelatedArticle = useCallback((id: string) => {
    setRelatedArticleIds(prev => prev.filter(x => x !== id))
    setSelectedRelatedArticles(prev => prev.filter(x => x.id !== id))
  }, [])

  const insertSnippet = useCallback((snippet: string) => {
    setContentHtml(prev => {
      if (!prev.trim()) {
        return snippet
      }
      return `${prev}\n\n${snippet}`
    })
  }, [])

  const formatEditorContent = useCallback(async () => {
    const editor = monacoEditorRef.current
    if (!editor) return
    await editor.getAction('editor.action.formatDocument')?.run()
  }, [])

  const handleTopbarSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nativeEvent = event.nativeEvent as SubmitEvent
    const submitter = nativeEvent.submitter as HTMLButtonElement | null
    const submitAction = submitter?.value as ArticleStatus | undefined

    if (submitAction === 'draft' || submitAction === 'published') {
      await submitArticle(submitAction)
      return
    }

    await submitArticle()
  }

  const helpfulness = () => {
    const value =
      article && article.helpfulCount + article.notHelpfulCount > 0
        ? Math.round(
            (article.helpfulCount / (article.helpfulCount + article.notHelpfulCount)) * 100
          )
        : 0
    return { value, label: `${value}%` }
  }

  useEffect(() => {
    if (!setRightSidebar) return
    setRightSidebar(
      <ArticleEditorSettingsPanel>
        <div className="flex flex-col gap-1">
          <label className="mb-2 uppercase tracking-wide block text-xs font-semibold text-foreground">
            Audience <span className="text-danger">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {AUDIENCES.map(aud => (
              <label
                key={aud.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                  audience.includes(aud.value)
                    ? 'border-primary bg-primary-50'
                    : 'border-default-200 hover:border-default-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={audience.includes(aud.value)}
                  onChange={() => toggleAudience(aud.value)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-medium">{aud.label}</span>
              </label>
            ))}
          </div>
          {errors.audience && <p className="mt-2 text-xs text-danger">{errors.audience}</p>}
        </div>

        <Divider />

        <div className="flex flex-col gap-4">
          <SelectField
            label="Category"
            isRequired
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select category..."
            errorMessage={errors.categoryId}
            isInvalid={!!errors.categoryId}
          />

          <Input
            label="URL Slug"
            placeholder="article-slug"
            value={slug}
            onValueChange={val => {
              userHasEditedSlugRef.current = true
              setSlug(val)
            }}
            isRequired
            errorMessage={errors.slug || slugError}
            isInvalid={!!errors.slug || !!slugError}
            startContent={
              <span className="text-sm text-default-500">
                {(() => {
                  const categorySlug = categories.find(c => c.id === categoryId)?.slug
                  return categorySlug ? `/help/${categorySlug}/` : '/help/'
                })()}
              </span>
            }
            endContent={
              slugCheckStatus === 'checking' ? (
                <Loader2 className="h-4 w-4 animate-spin text-default-400" />
              ) : slugCheckStatus === 'available' ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : slugCheckStatus === 'unavailable' && slugError ? (
                <CircleAlert className="h-4 w-4 text-danger" />
              ) : null
            }
          />

          <SelectField
            label="Status"
            value={status}
            onChange={value => setStatus(value as ArticleStatus)}
            options={STATUSES.map(s => s.value)}
            placeholder="Select status..."
          />
        </div>

        <Divider />

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-default-600">
            Related Articles
          </h3>
          <div className="relative flex flex-col">
            <Input
              placeholder="Search articles to link..."
              value={relatedSearchQuery}
              onValueChange={setRelatedSearchQuery}
              endContent={
                relatedSearchLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-default-400" />
                ) : null
              }
            />
            {relatedSearchQuery.trim() && relatedSearchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-100 mt-0.5 max-h-48 overflow-auto rounded-md border border-default-200 bg-background shadow-lg">
                <ul className="py-1">
                  {relatedSearchResults
                    .filter(a => a.id !== article?.id && !relatedArticleIds.includes(a.id))
                    .map(a => (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => addRelatedArticle(a)}
                          className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-default-100 focus:bg-default-100 focus:outline-none"
                        >
                          {a.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
          {selectedRelatedArticles.length > 0 && (
            <div className="flex flex-col gap-2">
              {selectedRelatedArticles.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-default-200 bg-default-50 px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRelatedArticle(item.id)}
                    className="cursor-pointer flex shrink-0 rounded-full p-1 text-default-400 hover:bg-default-200 hover:text-danger"
                    aria-label="Remove related article"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Divider />

        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-default-600">SEO</h3>
          <Input
            label="Meta Title"
            placeholder="Auto-generated from title"
            value={metaTitle}
            onValueChange={setMetaTitle}
            errorMessage={errors.metaTitle}
            isInvalid={!!errors.metaTitle}
            description={`${metaTitle.length} / 60 chars`}
          />
          <Textarea
            label="Meta Description"
            placeholder="Auto-generated from summary"
            value={metaDescription}
            onValueChange={setMetaDescription}
            errorMessage={errors.metaDescription}
            isInvalid={!!errors.metaDescription}
            description={`${metaDescription.length} / 160 chars`}
          />
        </div>

        {article && <Divider />}

        {article && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-default-600">
              Publication
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-default-500">First published</span>
              <span className="font-medium text-foreground">
                {formatPublicationDate(article.publishedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-default-500">Last updated</span>
              <span className="font-medium text-foreground">
                {formatPublicationDate(article.lastUpdatedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-default-500">Author</span>
              <span className="font-medium text-foreground">{article.author || '-'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-default-500">Views</span>
              <span className="font-medium text-foreground">{article.views.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm w-full">
              <span className="text-default-500">Helpfulness</span>
              <span className="flex items-center gap-2 font-medium text-foreground">
                {helpfulness().label}
                <Progress
                  className="w-20 h-2"
                  value={helpfulness().value}
                  maxValue={100}
                  color="success"
                />
              </span>
            </div>
          </div>
        )}
      </ArticleEditorSettingsPanel>
    )
  }, [
    addRelatedArticle,
    article,
    audience,
    categories,
    categoryId,
    errors.audience,
    errors.categoryId,
    errors.slug,
    errors.metaDescription,
    errors.metaTitle,
    isCheckingSlug,
    isLoading,
    metaDescription,
    metaTitle,
    relatedArticleIds,
    relatedSearchLoading,
    relatedSearchQuery,
    relatedSearchResults,
    removeRelatedArticle,
    router,
    selectedRelatedArticles,
    setRightSidebar,
    slug,
    slugCheckStatus,
    slugError,
    status,
  ])

  useEffect(() => {
    if (!setRightSidebar) return

    return () => {
      setRightSidebar(null)
    }
  }, [setRightSidebar])

  return (
    <>
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onSave={handleUnsavedSave}
        onDiscard={handleUnsavedDiscard}
        onCancel={handleUnsavedCancel}
      />
      <form id="article-editor-form" onSubmit={handleTopbarSubmit}>
        <ArticleEditorCanvas>
          <div className="space-y-4">
            <Card className="border border-default-200 shadow-none">
              <CardBody className="gap-6 p-6">
                <div>
                  <label className="mb-2 uppercase tracking-wide block text-xs font-semibold text-foreground">
                    Article Type
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ARTICLE_TYPES.map(type => (
                      <Chip
                        key={type.value}
                        variant={articleType === type.value ? 'solid' : 'bordered'}
                        color={articleType === type.value ? 'primary' : 'default'}
                        className="cursor-pointer"
                        onClick={() => setArticleType(type.value)}
                      >
                        {type.label}
                      </Chip>
                    ))}
                  </div>
                </div>

                <Input
                  label="Title"
                  placeholder="Article title..."
                  value={title}
                  onValueChange={setTitle}
                  isRequired
                  errorMessage={errors.title}
                  isInvalid={!!errors.title}
                />

                <Textarea
                  label="Summary"
                  placeholder="A short summary shown in article listings..."
                  value={summary}
                  onValueChange={setSummary}
                  description="Shown below the title on the published article. Keep it to 1–2 sentences."
                />
              </CardBody>
            </Card>

            <Card className="border border-default-200 shadow-none">
              <CardHeader className="border-b border-default-200 px-4 py-0">
                <div className="flex w-full items-center">
                  <div className="flex items-center gap-1 py-2">
                    <button
                      type="button"
                      onClick={() => setActiveEditorTab('code')}
                      className={`cursor-pointer inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        activeEditorTab === 'code'
                          ? 'bg-default-100 font-semibold text-foreground'
                          : 'text-default-500 hover:text-foreground'
                      }`}
                    >
                      <Code2 className="h-4 w-4" />
                      Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEditorTab('preview')}
                      className={`cursor-pointer inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                        activeEditorTab === 'preview'
                          ? 'bg-default-100 font-semibold text-foreground'
                          : 'text-default-500 hover:text-foreground'
                      }`}
                    >
                      <Eye className="h-4 w-4" />
                      Preview
                    </button>
                  </div>
                  <div className="ml-auto flex items-center gap-3 py-2">
                    <span className="text-xs text-default-500">
                      Use only allowed{' '}
                      <Code size="sm" className="text-xs">
                        kb-*
                      </Code>{' '}
                      classes
                    </span>
                    <Button
                      size="sm"
                      variant="bordered"
                      onPress={() => setShowAllowedHtml(prev => !prev)}
                    >
                      {showAllowedHtml ? 'Hide allowed HTML' : 'View allowed HTML'}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardBody className="p-0">
                {showAllowedHtml && (
                  <div className="space-y-2 border-b border-default-200 bg-default-50 px-4 py-3 text-xs text-default-600">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-semibold uppercase tracking-wide">Tags</span>
                      <div className="flex-1 space-y-1">
                        <Code size="sm" className="block whitespace-pre-wrap text-xs">
                          {KB_ALLOWED_TAGS_TEXT}
                        </Code>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        className="text-xs h-6"
                        onPress={() => copyToClipboard(KB_ALLOWED_TAGS_TEXT)}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-semibold uppercase tracking-wide">Attrs</span>
                      <div className="flex-1 space-y-1">
                        <Code size="sm" className="block whitespace-pre-wrap text-xs">
                          {KB_ALLOWED_ATTRIBUTES_TEXT}
                        </Code>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        className="text-xs h-6"
                        onPress={() => copyToClipboard(KB_ALLOWED_ATTRIBUTES_TEXT)}
                      >
                        Copy
                      </Button>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 font-semibold uppercase tracking-wide">Classes</span>
                      <div className="flex-1 space-y-1">
                        <Code size="sm" className="block whitespace-pre-wrap text-xs">
                          {KB_ALLOWED_CLASSES_TEXT}
                        </Code>
                      </div>
                      <Button
                        size="sm"
                        variant="flat"
                        className="text-xs h-6"
                        onPress={() => copyToClipboard(KB_ALLOWED_CLASSES_TEXT)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 border-b border-default-200 bg-default-50 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void formatEditorContent()}
                    className="cursor-pointer rounded-md border border-default-200 bg-background px-2.5 py-1 text-xs font-medium text-default-600 hover:text-foreground"
                    aria-label="Format HTML"
                    title="Format"
                  >
                    <Wand2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('<h2 class="kb-section-title">Section title</h2>')}
                    className="cursor-pointer rounded-md border border-default-200 bg-background px-2.5 py-1 text-xs font-medium text-default-600 hover:text-foreground"
                  >
                    H2 Section
                  </button>
                  <button
                    type="button"
                    onClick={() => insertSnippet('<p class="kb-paragraph">Paragraph text</p>')}
                    className="cursor-pointer rounded-md border border-default-200 bg-background px-2.5 py-1 text-xs font-medium text-default-600 hover:text-foreground"
                  >
                    Paragraph
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        '<ol class="kb-step-list">\n  <li class="kb-step"><span class="kb-step-title">Step title</span><span class="kb-step-desc">Step description</span></li>\n</ol>'
                      )
                    }
                    className="cursor-pointer rounded-md border border-default-200 bg-background px-2.5 py-1 text-xs font-medium text-default-600 hover:text-foreground"
                  >
                    Step List
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet('<div class="kb-tip"><strong>Tip:</strong> Helpful tip.</div>')
                    }
                    className="cursor-pointer rounded-md border border-success-200 bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700 hover:opacity-90"
                  >
                    Tip Box
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      insertSnippet(
                        '<div class="kb-note"><strong>Note:</strong> Important note.</div>'
                      )
                    }
                    className="cursor-pointer rounded-md border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 hover:opacity-90"
                  >
                    Note Box
                  </button>
                </div>

                <div className="mt-4 px-4 pb-4">
                  {activeEditorTab === 'code' ? (
                    <div>
                      {errors.contentHtml && (
                        <Alert hideIcon color="danger" className="mb-4 text-sm py-0 px-1">
                          {errors.contentHtml}
                        </Alert>
                      )}
                      <div className="overflow-hidden rounded-lg border border-default-200">
                        <Editor
                          height="480px"
                          defaultLanguage="html"
                          language="html"
                          theme="vs-dark"
                          value={contentHtml}
                          onChange={value => setContentHtml(value || '')}
                          onMount={editor => {
                            monacoEditorRef.current = editor
                          }}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 13,
                            lineNumbers: 'on',
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            fontFamily: '"Fira code", "Fira Mono", monospace',
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="min-h-[480px] rounded-lg border border-default-200 bg-background p-5">
                      {contentHtml.trim() ? (
                        <div
                          className="text-sm leading-7 text-foreground"
                          dangerouslySetInnerHTML={{ __html: contentHtml }}
                        />
                      ) : (
                        <p className="text-sm text-default-500">
                          No preview available yet. Add article HTML to preview.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs text-default-500">
                    <span>{contentHtml.length.toLocaleString()} characters</span>
                    <span>HTML is sanitized on save</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </ArticleEditorCanvas>
      </form>
    </>
  )
}
