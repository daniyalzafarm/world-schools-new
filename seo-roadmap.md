# SEO Roadmap — WC Booking App (engineer-led, LLM-assisted)

## Context

You (a software engineer with general SEO knowledge) want to own the SEO work on the Booking App (`apps/wc-booking`, Next.js 16.2.4 App Router), learning it deeply with LLM assistance rather than outsourcing it. This roadmap is grounded in a real audit of the app's current rendering and metadata, sequenced by dependency and impact, and written to teach as it goes.

**Decisions made:**
- **Go server-rendered** for the public surface (highest-impact change).
- **The Booking App owns the public discovery surface** (landing page + `/camps` browse + camp detail), so we build crawlable hub pages and internal links inside `wc-booking`.

---

## Mental model (read once before starting)

SEO is three sequential jobs: **crawl → index → rank.**
1. **Crawl** — a bot fetches your URL and gets HTML. It needs to *discover* URLs (sitemap + internal links) and be *allowed* to fetch them (robots).
2. **Index** — Google parses that HTML, optionally renders JavaScript, and stores the page. **This is where your app fails today:** the camp page ships an empty shell and loads content via `useEffect` after JS runs. Google *can* render JS, but it's a deferred, best-effort, slower second pass — unreliable for a page whose entire content depends on it. Server-rendering puts the content in the *first* HTML response, which is what indexing wants.
3. **Rank** — among indexed pages, ordering depends on relevance (titles, headings, structured data, content quality), authority (links), and experience (Core Web Vitals). Structured data (JSON-LD) doesn't directly boost rank but earns **rich results** (e.g. review stars) that lift click-through.

Keep this lens: every task below maps to crawl, index, or rank.

---

## Current state (verified against the codebase)

What's **already good:**
- Solid root metadata in `apps/wc-booking/src/app/layout.tsx` — title template (`%s | World Camps`), description, Open Graph, Twitter card, icons, `manifest`, and `metadataBase` derived from runtime `APP_URL` (`src/config/runtime-config.ts`).
- A web manifest at `public/site.webmanifest` and a full favicon/icon set.
- Camp data endpoints are **public** (`getCampBySlug`, `getPublishedCamps`, `getCampReviews`, `searchCamps` in `src/services/camps.services.ts` hit unauthenticated `/user/camps/*`) — so server-side fetching is straightforward.

What's **blocking SEO:**
- **Root layout forces `export const dynamic = 'force-dynamic'`** (`app/layout.tsx`) → no static/ISR generation anywhere.
- **The whole app is a client shell** — `app/providers.tsx` is `'use client'` (HeroUI, Theme, Auth, WebSocket, Messaging) and wraps every route.
- **Camp detail page `app/camps/[campSlug]/page.tsx` is `'use client'`** and fetches camp/add-ons/reviews in `useEffect` → content absent from initial HTML.
- **Homepage `/` is auth-gated** (behind `ProtectedRoute` via `MainLayout`) → no public landing page.
- **No public camp listing/browse page** → no discovery path or internal links for crawlers.
- **Missing:** `robots.ts`, `sitemap.ts`, any `generateMetadata` on dynamic routes, JSON-LD structured data, canonical (`alternates`), hreflang/i18n.
- Minor: `openGraph.url` is hardcoded to `https://booking.world-camps.org` instead of deriving from `metadataBase`.

---

## The plan (phased)

### Phase 0 — Measure & set crawl rules (do first; zero architectural risk)

**Why:** You can't improve what you can't see, and these are pure additions that can't break the app.
- **Set up Google Search Console** (verify the domain) and Bing Webmaster Tools. URL Inspection there shows you *exactly* what Googlebot renders — your ground truth for the whole project.
- **Add `app/robots.ts`** — allow public routes, disallow `/account`, `/messages`, `/bookings`, `/payment`, `/auth`, and any API; reference the (coming) sitemap. (Next.js App Router `robots` file convention.)
- **Fix `openGraph.url`** to derive from `metadataBase` rather than a hardcoded domain.
- **Baseline `npx next build`** — note which routes print as Static `○` / Dynamic `ƒ`. Right now everything is dynamic; this is your before-picture.

**Verify:** `robots.txt` served at `/robots.txt`; Search Console verified; build output captured.

### Phase 1 — Keystone: server-render the public surface (the architectural change)

**Why:** This is the one change that makes everything downstream possible. `generateMetadata`, JSON-LD in HTML, ISR, and real indexability all require the page to be a Server Component with server-side data.

**The approach — separate the "public web" from the "app shell" using route groups:**
1. **Lift the client providers out of the root.** Move the `<Providers>` stack from `app/layout.tsx` into the *authenticated* layout (e.g. a new `app/(app)/layout.tsx` or the existing dashboard layout). The root `app/layout.tsx` becomes a thin **Server Component**: `<html><body>` + fonts + base metadata only.
2. **Remove `force-dynamic` from the root.** Apply dynamic rendering only where genuinely needed (authenticated pages can opt in per-route). ⚠️ **Investigate first:** `metadataBase`/`APP_URL` is read at request time via `runtime-config.ts`. For statically generated public pages, anything needed at build/static time must come from a `NEXT_PUBLIC_*` build var or be fetched at request time — confirm this before flipping the flag, or you'll bake in wrong URLs.
3. **Create a `(public)` route group** with its own lean **server** layout (simple public header/footer, theme) that does *not* pull in Auth/WebSocket/Messaging.
4. **Convert `camps/[campSlug]/page.tsx` to an async Server Component:** fetch the camp (and reviews/add-ons) server-side. ⚠️ **Gotcha:** `apiClient` may assume a browser (cookies/interceptors). For these public endpoints, call the backend directly with `fetch(`${API_URL}/user/camps/slug/${slug}`, { next: { revalidate: 3600 } })` so you get Next's data cache + ISR for free. Keep interactive bits (book button, image gallery, reviews drawer) as small **client islands** (`'use client'` leaf components) that receive server-fetched props.
5. **Add ISR:** `export const revalidate = 3600` (and optionally `generateStaticParams` from `getPublishedCamps()` to pre-build popular camps). Later, wire on-demand `revalidatePath`/`revalidateTag` from a backend webhook when a provider edits a camp.

**Verify:** `curl https://…/camps/<slug>` (or View Source) shows the camp name, description, price **in the raw HTML** — not a spinner. `next build` now prints the camp route as ISR/SSG. Search Console URL Inspection shows rendered content.

### Phase 2 — Per-camp metadata + structured data (depends on Phase 1)

**Why:** Now that the page is server-rendered, each camp can have its own title/description/OG image and rich-result markup.
- **`generateMetadata({ params })`** in the camp page → dynamic `title`, `description`, `alternates.canonical`, and `openGraph.images` (use the camp's hero image). Consider a dynamic `opengraph-image.tsx` for branded social cards.
- **JSON-LD** (inline `<script type="application/ld+json">` rendered server-side). Choose schema types deliberately — a camp with dated sessions maps well to **`Event`/`EventSeries`**; add **`BreadcrumbList`**, **`Organization`**, and — because you already have reviews — **`AggregateRating`/`Review`**, which is what earns ⭐ star snippets (high CTR). Don't over-claim; only mark up data visible on the page.

**Verify:** Google **Rich Results Test** and the **Schema Markup Validator** pass with no errors; preview shows eligible rich results.

### Phase 3 — Public discovery surface (Booking App owns it)

**Why:** Individual camp pages need hub pages that link to them and that rank for category/location queries. This is crawl + rank.
- **Public server-rendered `/camps` browse/listing page** — paginated grid linking to every camp detail. This is the primary internal-linking hub and your sitemap's backbone.
- **Public landing page at `/`.** Today `/` is the auth-gated dashboard. Split it: anonymous visitors get a server-rendered marketing landing; authenticated users redirect to a new `/dashboard`. ⚠️ This is a routing refactor — plan it as its own PR.
- **Category/location landing pages** (e.g. `/camps/adventure`, `/camps/in/paris`) built from your camp taxonomy — these target high-intent queries ("adventure summer camps", "kids camps in Paris"). They reuse the same filter data that Advanced Search (Phase 2 product) will use.
- **`app/sitemap.ts`** — generate dynamically from `getPublishedCamps()` + the static public routes. Put this here (not earlier) so it only ever lists indexable, server-rendered URLs. Submit it in Search Console.

**Verify:** Crawl the site with **Screaming Frog** (free ≤500 URLs) — every camp reachable via internal links; sitemap returns 200 and lists the right URLs.

### Phase 4 — Performance / Core Web Vitals (rank + UX)

- `next/image` for camp imagery (remote patterns already configured); set `priority` on the LCP hero image and correct `sizes`.
- Keep public bundles lean (the islands approach already helps); audit with the build's per-route JS sizes.
- `next/font` for fonts; sensible `Cache-Control`/CDN for static assets.

**Verify:** Lighthouse (DevTools) SEO ≥ 95 and green Core Web Vitals on the camp + listing pages; watch the Search Console **Core Web Vitals** report over time (field data).

### Phase 5 — Domain migration & redirects (world-camps.org → booking.world-camps.org)

**Why:** Preserve any existing ranking/link equity from the old domain.
- Implement **301** redirects mapping old URLs → new equivalents (via `redirects()` in `next.config.wc.mjs` or middleware). Avoid redirect chains and blanket redirect-to-home.
- Keep canonical tags pointing at the new URLs; use Search Console's **Change of Address** if it's the same brand.

**Verify:** old URLs return a single 301 to the correct new URL; Search Console shows the migration progressing.

### Phase 6 — Internationalized SEO (deferred → ties to Phase 2 multilingual)

Only once the multilingual UI exists: locale subpaths + `alternates.languages` (hreflang) so Google serves the right language version. Listed here so it's on the map; **do not build it until localization lands.**

---

## Tooling & verification toolkit

- **View Source / `curl`** — the fundamental "is it really in the HTML?" check.
- **Google Search Console** — URL Inspection (renders as Googlebot), Coverage/Indexing, Sitemaps, Performance, Core Web Vitals. The single most important tool.
- **Rich Results Test** + **Schema Markup Validator** — for JSON-LD.
- **Lighthouse** (Chrome DevTools) — SEO + Performance audits, per page.
- **`next build` output** — confirms each route's rendering mode (Static/ISR/Dynamic).
- **Screaming Frog** — crawl audit (broken links, missing titles, orphan pages).

---

## Using LLMs / Claude effectively (and their failure modes)

**Great for:**
- Drafting boilerplate you'll review: `robots.ts`, `sitemap.ts`, `generateMetadata`, JSON-LD objects, redirect maps.
- Explaining *why* — e.g. "walk me through how Googlebot renders a CSR React page and why useEffect data is risky for indexing." Use it to build the mental model, not just code.
- Writing meta titles/descriptions at scale from a template, then you tune voice + keywords.
- Driving the refactors in Claude Code (convert page → server component) with you reviewing each diff.

**Where they mislead you — always verify:**
- **Framework API specifics.** Models have a knowledge cutoff; Next.js 16 metadata/ISR/route APIs may differ from what an LLM "remembers." Verify every Next.js snippet against the official docs.
- **Schema validity.** LLMs invent schema.org fields. Never trust generated JSON-LD until it passes the Rich Results Test.
- **Ranking claims.** Google's signals change constantly and much "SEO advice" online is folklore. Treat ranking tactics as hypotheses to measure in Search Console, not facts.

Rule of thumb: let the LLM draft and explain; let the **validators and Search Console** decide truth.

---

## Learning resources (authoritative)

- **Next.js docs** — Metadata API & `generateMetadata`, `sitemap.ts`, `robots.ts`, `opengraph-image`, Incremental Static Regeneration / `revalidate`, Route Groups & multiple layouts.
- **Google Search Central** — "JavaScript SEO basics", the structured-data galleries (Event, Review snippet, Breadcrumb), and crawling/indexing docs. This is the source of truth over any blog.
- **web.dev** — Core Web Vitals (LCP/CLS/INP) and optimization guides.

---

## Suggested first two PRs (smallest valuable slices)

1. **PR 1 — Measurement & rules (Phase 0):** add `app/robots.ts`, fix the hardcoded `openGraph.url`, set up Search Console, capture the `next build` baseline. Pure additive, ships in a day, gives you instrumentation.
2. **PR 2 — Prove the pattern on one page (Phase 1, scoped to camp detail):** carve out the `(public)` group + lean server layout, lift providers off the root, and convert **just** `camps/[campSlug]` to a server component with `generateMetadata`. Proving SSR on the single most valuable page de-risks the rest before you scale to listing/landing pages.

---

## Verification (definition of done for the overall effort)

- `curl` of a camp URL returns full content + correct `<title>`/meta/JSON-LD in raw HTML.
- `next build` shows camp + listing pages as ISR/Static, not Dynamic.
- Rich Results Test passes (review stars eligible).
- Sitemap + robots served and submitted; Search Console indexing climbing with no major coverage errors.
- Lighthouse SEO ≥ 95 and green CWV on public pages.
