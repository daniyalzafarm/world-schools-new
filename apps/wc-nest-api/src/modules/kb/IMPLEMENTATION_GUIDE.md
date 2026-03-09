# Knowledge Base API Implementation Guide

## Overview
This document provides a complete implementation guide for the Knowledge Base API module.

## ✅ Completed Files

### Article Categories Module (`article-categories/`)
- ✅ `dto/create-category.dto.ts` - Create category validation
- ✅ `dto/update-category.dto.ts` - Update category validation
- ✅ `dto/query-categories.dto.ts` - Query filters and pagination
- ✅ `dto/reorder-category.dto.ts` - Sort order updates
- ✅ `article-categories.service.ts` - Complete CRUD service
- ✅ `article-categories.controller.ts` - Admin & Public controllers
- ✅ `article-categories.module.ts` - NestJS module

### Articles Module (`articles/`)
- ✅ `dto/create-article.dto.ts` - Create article validation
- ✅ `dto/update-article.dto.ts` - Update article validation
- ✅ `dto/query-articles.dto.ts` - Query filters and pagination
- ✅ `dto/submit-feedback.dto.ts` - Feedback submission
- ✅ `dto/add-related-article.dto.ts` - Add related article
- ✅ `dto/reorder-related-articles.dto.ts` - Reorder related articles
- ✅ `utils/html-sanitizer.util.ts` - DOMPurify HTML sanitization
- ✅ `services/articles.service.ts` - Main CRUD service
- ✅ `services/article-actions.service.ts` - Publish/unpublish/duplicate
- ✅ `services/article-feedback.service.ts` - Feedback management
- ✅ `services/article-relations.service.ts` - Related articles management

## 🔄 Remaining Files to Create

### 1. Articles Controller (`articles/articles.controller.ts`)

This file needs to be created with two controllers:
- `ArticlesController` - Admin endpoints at `/superadmin/kb/articles`
- `PublicArticlesController` - Public endpoints at `/kb/articles`

**Key endpoints to implement:**
- GET /superadmin/kb/articles - List all articles (admin)
- POST /superadmin/kb/articles - Create article
- GET /superadmin/kb/articles/:id - Get article by ID
- PATCH /superadmin/kb/articles/:id - Update article
- DELETE /superadmin/kb/articles/:id - Delete article
- POST /superadmin/kb/articles/:id/publish - Publish article
- POST /superadmin/kb/articles/:id/unpublish - Unpublish article
- POST /superadmin/kb/articles/:id/duplicate - Duplicate article
- GET /superadmin/kb/articles/check-slug/:slug - Check slug availability
- GET /superadmin/kb/articles/:id/related - Get related articles
- POST /superadmin/kb/articles/:id/related - Add related article
- DELETE /superadmin/kb/articles/:id/related/:relatedId - Remove related article
- PATCH /superadmin/kb/articles/:id/related/reorder - Reorder related articles
- GET /kb/articles - List published articles (public)
- GET /kb/articles/:slug - Get article by slug (public)
- GET /kb/articles/:slug/related - Get related articles (public)
- POST /kb/articles/:id/helpful - Submit feedback (public)
- GET /kb/articles/:id/feedback-status - Check feedback status (public)

### 2. Articles Module (`articles/articles.module.ts`)

This file needs to import all services and controllers and export the module.

### 3. Main KB Module (`kb.module.ts`)

This file needs to import both ArticleCategoriesModule and ArticlesModule.

### 4. Update App Module

The KB module needs to be imported in the main app module.

## Implementation Details

### Authentication & Authorization

**Admin Endpoints:**
- Use `@UseGuards(RolesOrPermissionsGuard)`
- Use `@Permissions('kb.articles.create')` decorator
- Permissions needed:
  - `kb.categories.create`, `kb.categories.read`, `kb.categories.update`, `kb.categories.delete`
  - `kb.articles.create`, `kb.articles.read`, `kb.articles.update`, `kb.articles.delete`
  - `kb.articles.publish`, `kb.articles.duplicate`

**Public Endpoints:**
- Use `@Public()` decorator
- No authentication required
- Only return published articles

### HTML Sanitization

All article content must be sanitized using the `sanitizeArticleHtml()` utility:
- Runs on every POST and PATCH operation
- Only allows kb-* CSS classes
- Strips malicious code
- Based on DOMPurify configuration from DEV-HANDOFF.html

### Validation Rules

**Article Creation/Update:**
- Title: max 255 characters, required
- Slug: lowercase, alphanumeric with hyphens, unique, max 300 characters
- Content HTML: required, will be sanitized
- Meta title: max 255 characters
- Meta description: max 500 characters
- Audience: array of enum values (parents, providers, staff)
- Article type: enum (how_to, faq, reference, policy)
- Category: must exist in database

### Response Format

All endpoints use `ResponseUtil.success()` for consistent response format:
```typescript
return ResponseUtil.success(data, meta)
```

### Pagination

Default pagination:
- Page: 1
- Limit: 20 (max 100)
- Returns meta object with total, totalPages, hasMore

### Error Handling

- `NotFoundException` - Resource not found (404)
- `BadRequestException` - Validation errors, duplicate slugs, etc. (400)
- All errors are handled by NestJS global exception filter

## Next Steps

1. Create `articles.controller.ts` with all endpoints
2. Create `articles.module.ts` to wire up all services
3. Create `kb.module.ts` to combine both modules
4. Update main app module to import KB module
5. Install required dependency: `npm install isomorphic-dompurify`
6. Test all endpoints with Postman/Insomnia
7. Add Swagger documentation tags

## Database Dependencies

Ensure Prisma migration has been run:
```bash
npx prisma migrate dev
```

Models created:
- ArticleCategory
- Article
- ArticleRelation
- ArticleFeedback

## Testing Checklist

- [ ] Create category
- [ ] List categories with filters
- [ ] Update category
- [ ] Delete category (should fail if has articles)
- [ ] Create article
- [ ] List articles with filters
- [ ] Update article (HTML should be sanitized)
- [ ] Publish article
- [ ] Unpublish article
- [ ] Duplicate article
- [ ] Add related articles
- [ ] Reorder related articles
- [ ] Submit feedback (authenticated)
- [ ] Submit feedback (anonymous with sessionId)
- [ ] Check feedback status
- [ ] Get article by slug (public)
- [ ] Increment view count on public access

