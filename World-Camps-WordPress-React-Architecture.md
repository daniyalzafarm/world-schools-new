  
**WORLD-CAMPS**

Technical Architecture Documentation

WordPress \+ React Hybrid Architecture

with Pagely nginx Routing

Version 1.0

February 2026

# **1\. Executive Summary**

This document outlines the technical architecture for World-Camps' hybrid platform approach, enabling a gradual migration from WordPress to a React/Next.js booking application while maintaining SEO integrity and avoiding URL redirects.

## **1.1 Key Decision**

Pagely (our WordPress host) will handle nginx-level routing to serve different URL paths from different origins, allowing WordPress and React to coexist on the same domain seamlessly.

## **1.2 Why This Approach**

* Zero URL redirects: Same URLs throughout migration, no SEO disruption

* Gradual migration: Onboard camps one at a time, not all at once

* Risk mitigation: Easy rollback by changing routing rules

* No infrastructure changes: Pagely handles routing at their level

# **2\. Architecture Overview**

## **2.1 The Hybrid Model**

Users visit world-camps.org. Pagely's nginx determines which origin serves each request based on URL path patterns:

User Request → world-camps.org  
                    │  
              Pagely nginx  
                    │  
        ┌───────────┴───────────┐  
        │                       │  
   React App              WordPress  
(app.world-camps.org)   (Pagely origin)  
        │                       │  
   Camp profiles           Homepage  
   Booking flow            Blog  
   Dashboards             Editorial pages  
   API                    (temporary: legacy camps)

## **2.2 Routing Rules**

Pagely confirmed they support both path patterns AND specific slug exceptions:

| Rule Type | URL Pattern | Routes To |
| :---- | :---- | :---- |
| **Default** | /camp/\* | React App |
| **Exceptions** | \~200 existing camp slugs | WordPress (temporary) |
| Path pattern | /camp-region/\* | React App |
| Path pattern | /camps/\* | React App |
| Path pattern | /book/\* | React App |
| Path pattern | /dashboard/\* | React App |
| Path pattern | /account/\* | React App |
| Path pattern | /api/\* | React App |
| **Fallback** | Everything else | WordPress |

# **3\. The "Flip" Logic**

## **3.1 Why Default to React**

Instead of routing specific camps TO the React app, we route everything to React BY DEFAULT and only exclude existing camps temporarily. This is smarter because:

* New camps automatically served by React (no action needed)

* Exception list only shrinks, never grows

* Eventually: zero exceptions, simple routing

## **3.2 Migration Workflow**

| Scenario | Action Required | Who Does It |
| :---- | :---- | :---- |
| New camp signs up | Nothing (already routed to React) | Automatic |
| Existing camp onboards | Remove from exception list | Pagely ticket |
| All camps onboarded | Remove entire exception list | One-time cleanup |

## **3.3 Timeline**

MONTH 1-3: Launch  
├── /camp/\* → React (default)  
├── \~200 exceptions → WordPress  
└── Onboard 20-50 pilot camps

MONTH 4-6: Scale  
├── Exception list shrinks weekly  
├── 100+ camps on React  
└── WordPress camp traffic decreasing

MONTH 7-12: Complete Migration  
├── All camps on React  
├── Exception list \= empty  
└── WordPress only serves homepage/blog/editorial

# **4\. System Responsibilities**

## **4.1 React App (app.world-camps.org)**

Single source of truth for all booking-related data and functionality:

* Camp profiles (all data: photos, sessions, pricing, availability)

* Sessions & availability management

* Booking flow & payments (Stripe Connect)

* Reviews & ratings (outcome-based)

* Provider dashboard (camp management)

* Parent accounts & booking history

* Messaging system

* API for AI assistants (structured data)

## **4.2 WordPress (world-camps.org)**

Content and marketing pages:

* Homepage

* Editorial pages (/best-summer-camps-in-usa/, etc.)

* Blog

* Camp cards on editorial pages (minimal data from React API)

* *TEMPORARY: \~200 existing camp profiles (until onboarded)*

## **4.3 Data Sync: React → WordPress**

WordPress editorial pages show camp cards. These need minimal data from the React app:

| Field | Purpose |
| :---- | :---- |
| Camp name | Display on card |
| Hero image URL | Card thumbnail |
| Starting price | "From €X/week" |
| Location | Country/region display |
| Age range | Filtering |
| Camp URL | Link to React profile |

This is a one-way sync via API. WordPress never writes back to React.

# **5\. Technical Implementation**

## **5.1 Pagely Configuration**

Pagely handles nginx routing at their infrastructure level. The configuration they'll implement:

\# Default: All /camp/\* routes to React app  
location /camp/ {  
    proxy\_pass https://app.world-camps.org;  
    proxy\_set\_header Host world-camps.org;  
    proxy\_set\_header X-Real-IP $remote\_addr;  
    proxy\_set\_header X-Forwarded-For $proxy\_add\_x\_forwarded\_for;  
    proxy\_set\_header X-Forwarded-Proto $scheme;  
}

\# Exceptions: Specific slugs stay on WordPress  
location \~ ^/camp/(existing-camp-1|existing-camp-2|...)/ {  
    \# Default WordPress handling (no proxy)  
}

\# Other React paths  
location \~ ^/(camp-region|camps|book|dashboard|account|api)/ {  
    proxy\_pass https://app.world-camps.org;  
    \# ... same headers  
}

## **5.2 React App (Next.js on Azure)**

The React app runs on Azure Container Apps with the following configuration:

* Domain: app.world-camps.org (Azure managed)

* Framework: Next.js with server-side rendering

* Backend: NestJS API

* Database: Azure PostgreSQL

Important: The React app must handle the Host header being world-camps.org (not app.world-camps.org) since Pagely proxies with the original host.

## **5.3 DNS Configuration**

| Record | Type | Points To |
| :---- | :---- | :---- |
| world-camps.org | A/CNAME | Pagely (existing) |
| app.world-camps.org | CNAME | Azure Container Apps endpoint |

# **6\. Pagely Communication**

## **6.1 Confirmation Received**

Kevin from Pagely confirmed on January 24, 2026:

*"We can pass the exact path to the external domain or regexs of the path to the external domain if you need. Let us know how you wish to proceed."*

## **6.2 Information to Provide Pagely**

When ready to implement, provide Pagely with:

1. External origin: https://app.world-camps.org

2. Path patterns to route: /camp/\*, /camp-region/\*, /camps/\*, /book/\*, /dashboard/\*, /account/\*, /api/\*

3. Exception list: Full list of \~200 existing camp slugs

4. Request: Mercury cache exclusion for proxied paths

## **6.3 Ongoing Process**

As camps onboard, submit a Pagely ticket to remove them from the exception list. Template:

Subject: Remove camp from routing exception list

Hi,

Please remove the following slug from the /camp/ exception list:  
\- /camp/\[camp-slug\]/

This camp has been onboarded to our React app.

Thanks\!

# **7\. SEO Considerations**

## **7.1 What Google Sees**

From Google's perspective, nothing changes:

BEFORE (WordPress):  
Googlebot visits: world-camps.org/camp/explorer-camp/  
Server responds: HTML from WordPress  
Google indexes: ✓

AFTER (React):  
Googlebot visits: world-camps.org/camp/explorer-camp/  ← Same URL\!  
Server responds: HTML from Next.js (SSR)  
Google indexes: ✓

Google's perspective: "Same page, maybe updated content"

## **7.2 Why This Is Safe**

| Risk | Mitigation |
| :---- | :---- |
| URL changes | None \- same URLs throughout |
| Redirect chains | None \- no redirects used |
| Content mismatch | We control both versions, ensure parity |
| Ranking drop | Minimal \- same URL, similar/better content |
| Rollback difficulty | Easy \- just change routing rule back |

## **7.3 Schema.org & AI Readiness**

The React app implements comprehensive structured data that WordPress cannot provide:

* SummerCamp schema with real-time availability

* Offer schema with accurate pricing per session

* Review schema with outcome-based ratings

* FAQ schema for AI assistant consumption

# **8\. Developer Handoff**

## **8.1 What Developers Need to Know**

### **React App Requirements**

* Handle Host header: world-camps.org (not app.world-camps.org)

* Use X-Forwarded-Proto for HTTPS detection

* All internal links use relative paths or world-camps.org domain

* SSR required for SEO (no client-only rendering for camp pages)

### **API Endpoints for WordPress**

WordPress needs these API endpoints to display camp cards:

GET /api/camps/cards  
Returns: { camps: \[{ id, name, image, price, location, ageRange, url }\] }

GET /api/camps/cards?country=spain  
Returns: Filtered list for editorial pages

GET /api/camps/{id}/card  
Returns: Single camp card data

## **8.2 What NOT to Build**

Based on the architecture decision, developers should NOT:

* Build WordPress as primary frontend with booking\_url links

* Duplicate full camp data in both systems

* Create bi-directional sync between WordPress and React

* Use subdomains like book.world-camps.org (we use paths)

# **9\. Appendix**

## **9.1 Exception List Template**

Format for providing Pagely with the initial exception list:

\# Camps to keep on WordPress (exception list)  
\# These will be removed as camps onboard

/camp/explorer-international-camp/  
/camp/les-elfes-verbier/  
/camp/camp-suisse/  
/camp/montana-summer-camp/  
\# ... (full list of \~200 slugs)

## **9.2 Rollback Procedure**

If issues arise, rollback is simple:

5. Submit Pagely ticket: "Disable proxy for /camp/\* temporarily"

6. All traffic returns to WordPress within minutes

7. Fix issues in React app

8. Re-enable proxy when ready

## **9.3 Contact Information**

| Pagely Support | support@pagely.com / Atomic dashboard |
| :---- | :---- |
| **Azure Resources** | See WV-Booking-Azure-Infrastructure-1.docx |

Document created: February 2026 | World-Camps Technical Team