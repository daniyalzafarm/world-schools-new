# HTML Validation Refactoring - Knowledge Base Module

## Overview
The article creation and update logic has been refactored to **validate HTML content instead of sanitizing it**. This ensures data integrity by preserving exactly what the user/frontend sends, while maintaining security through strict validation.

---

## What Changed

### **Before: Automatic Sanitization** ❌
```typescript
// Old approach - Modified user input
const sanitizedHtml = sanitizeArticleHtml(dto.contentHtml)

return this.prisma.article.create({
  data: {
    contentHtml: sanitizedHtml, // Modified HTML
    // ...
  }
})
```

**Problems:**
- Backend automatically modified user input
- Frontend couldn't know what was changed
- Data integrity issues (what was sent ≠ what was stored)
- Difficult to debug HTML issues

---

### **After: Validation Only** ✅
```typescript
// New approach - Validate but don't modify
const validationResult = validateArticleHtml(dto.contentHtml)
if (!validationResult.isValid) {
  throw new BadRequestException(
    `HTML validation failed:\n${validationResult.errors.join('\n')}`
  )
}

return this.prisma.article.create({
  data: {
    contentHtml: dto.contentHtml, // Original HTML preserved
    // ...
  }
})
```

**Benefits:**
- ✅ Preserves exact HTML sent from frontend
- ✅ Clear error messages when validation fails
- ✅ Frontend knows exactly what needs to be fixed
- ✅ Data integrity maintained (what was sent = what was stored)
- ✅ Security maintained through strict validation

---

## Files Modified

### 1. **html-sanitizer.util.ts** (Refactored)

**New Functions Added:**
- `validateArticleHtml(html: string): HtmlValidationResult` - Main validation function
- `validateNoMaliciousCode(html: string): string[]` - Checks for XSS/malicious patterns
- `validateAllowedTags(html: string): string[]` - Validates HTML tags
- `validateAllowedAttributes(html: string): string[]` - Validates HTML attributes
- `validateAllowedClasses(html: string): string[]` - Validates CSS classes

**Deprecated Functions:**
- `sanitizeArticleHtml()` - No longer used (kept for reference)
- `filterAllowedClasses()` - Removed (replaced with validation)

**Backward Compatibility:**
- `validateKbClasses()` - Kept but marked as deprecated

---

### 2. **articles.service.ts** (Updated)

**Changes in `create()` method:**
```typescript
// Before
const sanitizedHtml = sanitizeArticleHtml(dto.contentHtml)
contentHtml: sanitizedHtml

// After
const validationResult = validateArticleHtml(dto.contentHtml)
if (!validationResult.isValid) {
  throw new BadRequestException(
    `HTML validation failed:\n${validationResult.errors.join('\n')}`
  )
}
contentHtml: dto.contentHtml // Original HTML
```

**Changes in `update()` method:**
```typescript
// Before
const updateData: any = { ...dto }
if (dto.contentHtml) {
  updateData.contentHtml = sanitizeArticleHtml(dto.contentHtml)
}

// After
if (dto.contentHtml) {
  const validationResult = validateArticleHtml(dto.contentHtml)
  if (!validationResult.isValid) {
    throw new BadRequestException(
      `HTML validation failed:\n${validationResult.errors.join('\n')}`
    )
  }
}
// Use original DTO
```

---

## Validation Rules

### 1. **Allowed HTML Tags**
Only these tags are permitted:
```
p, h2, h3, ul, ol, li, a, strong, em, code, div, span, figure, img, figcaption
```

**Error Example:**
```
Invalid HTML: Tag(s) 'script, iframe' not allowed. 
Only these tags are permitted: p, h2, h3, ul, ol, li, a, strong, em, code, div, span, figure, img, figcaption
```

---

### 2. **Allowed HTML Attributes**
Only these attributes are permitted:
```
href, src, alt, id, class, target, rel
```

**Error Example:**
```
Invalid HTML: Attribute(s) 'onclick, onerror' not allowed. 
Only these attributes are permitted: href, src, alt, id, class, target, rel
```

---

### 3. **Allowed CSS Classes**
Only kb-* classes are permitted:
```
kb-section-title, kb-paragraph, kb-step-list, kb-step, kb-step-title, 
kb-step-desc, kb-list, kb-callout, kb-callout-info, kb-callout-warning, 
kb-related, kb-related-title, kb-related-list
```

**Error Example:**
```
Invalid HTML: Class(es) 'custom-class, my-style' not allowed. 
Only kb-* classes are permitted: kb-section-title, kb-paragraph, ...
```

---

### 4. **Malicious Code Detection**
Dangerous patterns are detected and rejected:
- `<script>` tags
- `javascript:` protocol
- Event handlers (`onclick`, `onload`, `onerror`, etc.)
- `<iframe>`, `<object>`, `<embed>`, `<applet>` tags
- `<meta>`, `<link>`, `<style>` tags

**Error Example:**
```
Invalid HTML: Potentially malicious code detected: "<script>alert('xss')</script>". 
This type of content is not allowed for security reasons.
```

---

## Frontend Responsibility

### **What the Frontend Should Do:**

1. **Sanitize HTML before sending to API**
   - Use DOMPurify or similar library on the frontend
   - Ensure only allowed tags, attributes, and classes are used
   - Remove any malicious code

2. **Handle validation errors gracefully**
   - Display clear error messages to users
   - Highlight which part of the HTML is invalid
   - Provide guidance on how to fix the issue

3. **Test HTML before submission**
   - Validate HTML client-side before sending to API
   - Show preview of sanitized HTML to users
   - Prevent submission of invalid HTML

---

## API Error Responses

### **Validation Failure Response:**
```json
{
  "statusCode": 400,
  "message": "HTML validation failed:\nInvalid HTML: Tag(s) 'script' not allowed. Only these tags are permitted: p, h2, h3, ul, ol, li, a, strong, em, code, div, span, figure, img, figcaption\nInvalid HTML: Attribute(s) 'onclick' not allowed. Only these attributes are permitted: href, src, alt, id, class, target, rel",
  "error": "Bad Request"
}
```

### **Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Article Title",
    "contentHtml": "<p class=\"kb-paragraph\">Original HTML preserved</p>",
    // ... other fields
  }
}
```

---

## Testing

### **Valid HTML Example:**
```html
<h2 class="kb-section-title">Getting Started</h2>
<p class="kb-paragraph">This is a valid paragraph.</p>
<ul class="kb-list">
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```
✅ **Result:** Accepted and stored as-is

### **Invalid HTML Example:**
```html
<h2 class="kb-section-title">Getting Started</h2>
<p class="custom-class">Invalid class</p>
<script>alert('xss')</script>
```
❌ **Result:** Rejected with detailed error message

---

## Migration Notes

### **No Database Migration Required**
- HTML content structure hasn't changed
- Existing articles remain unchanged
- Only new/updated articles are affected

### **Frontend Updates Required**
- Frontend must implement HTML sanitization
- Frontend should handle validation error responses
- Frontend should test HTML before submission

---

## Status: ✅ COMPLETE

- ✅ Validation functions implemented
- ✅ Sanitization removed from create/update methods
- ✅ Meaningful error messages added
- ✅ Build successful
- ✅ No TypeScript errors
- ✅ Backward compatibility maintained

**Next Steps:**
1. Update frontend to sanitize HTML before sending to API
2. Implement client-side validation to match backend rules
3. Add error handling for validation failures
4. Test with various HTML inputs

