# Google Sign-In — Configuration & Testing (wc-booking)

"Sign in with Google" is enabled **only** in the public booking app (`wc-booking`).
`wc-provider` and `wc-superadmin` remain email-only and are unaffected.

This guide covers: creating the Google OAuth client, setting the env vars per
environment, running it locally, and the full test matrix.

---

## 1. How it works (30-second version)

```
Browser (wc-booking)                         wc-nest-api
─────────────────────                        ─────────────────────────────────
@react-oauth/google
  <GoogleLogin> button  ──┐
  + One Tap auto-prompt   ├─► Google ID token (credential, a signed JWT)
                          │
  POST /user/auth/google-signin { credential } ─►  GoogleTokenVerifierService
                                                   verifyIdToken(audience = GOOGLE_CLIENT_ID)
                                                   ├─ reject if email_verified = false
                                                   ├─ find UserAccount(google, sub)        → login
                                                   ├─ else link existing User by email      → login
                                                   └─ else create Parent user (pre-verified) → login
                                                   issues the SAME session cookies/JWT as email login
  ◄── { user } + HTTP-only cookies ───────────────┘  (best-effort: import Google avatar)
```

- **Flow:** ID-token (credential) flow — there is **no client secret** and **no
  redirect URI** to configure.
- **Client ID is public** and is the same value on both sides:
  - backend `GOOGLE_CLIENT_ID` — the *audience* the ID token is verified against,
  - frontend `GOOGLE_OAUTH_CLIENT_ID` — rendered into the Google button.
- If no client ID is configured, the UI **hides** the Google button and One Tap and
  the `GoogleOAuthProvider` is not mounted — email auth keeps working.

---

## 2. Create the Google OAuth client (one-time, per Google project)

Do this in the [Google Cloud Console](https://console.cloud.google.com/).

### 2.1 OAuth consent screen
1. **APIs & Services → OAuth consent screen.**
2. User type: **External**.
3. Fill in app name, user support email, app logo, app domain, **Privacy Policy**
   and **Terms of Service** URLs, and developer contact email.
4. Scopes: the defaults (`openid`, `email`, `profile`) are enough — no extra scopes.
5. **Publish the app** (Publishing status → *In production*).
   > While in *Testing*, only listed test users can sign in (max 100) and users see
   > an "unverified app" warning. **Publish before go-live.** Verification may be
   > required if you later add sensitive scopes — we don't, so basic publishing is
   > sufficient.

### 2.2 OAuth Client ID
1. **APIs & Services → Credentials → Create Credentials → OAuth client ID.**
2. Application type: **Web application**.
3. **Authorized JavaScript origins** — add one per environment (scheme + host +
   port, **no trailing slash**, no path):

   | Environment | Origin |
   |-------------|--------|
   | Local dev   | `http://localhost:5300` (the booking dev port — `PORT` in `apps/wc-booking/.env`; use whatever port the dev server prints) |
   | Staging     | `https://<your-staging-booking-domain>` |
   | Production  | `https://booking.world-camps.org` |

4. **Authorized redirect URIs** — leave **empty** (not used in this flow).
5. Create → copy the **Client ID** (looks like
   `1234567890-abcd.apps.googleusercontent.com`).

> One client ID can serve all three environments if you list all origins on it, or
> you can create a separate client ID per environment. Either is fine — the booking
> app and the API just need to share the **same** client ID within an environment.

> One Tap uses FedCM (enabled in code). Some browsers require third-party sign-in to
> be allowed; if One Tap doesn't appear, see Troubleshooting.

---

## 3. Set the environment variables

The value is **the same** for `GOOGLE_CLIENT_ID` (API) and `GOOGLE_OAUTH_CLIENT_ID`
(booking). The API validates in production that it ends in
`.apps.googleusercontent.com` and **fails to boot** if it's missing/malformed.

### 3.1 Local development
**API** — `apps/wc-nest-api/.env`:
```bash
GOOGLE_CLIENT_ID=1234567890-abcd.apps.googleusercontent.com
```
**Booking** — `apps/wc-booking/.env`:
```bash
GOOGLE_OAUTH_CLIENT_ID=1234567890-abcd.apps.googleusercontent.com
# keep cookie-based auth (default) for the realistic prod path:
AUTH_USING_REQUEST=false
```
(Both `.env.example` files already document these keys.)

### 3.2 Staging / Production
These are injected at container start by the deploy pipeline (NOT baked into images):

| Key | File / GitHub variable | Notes |
|-----|------------------------|-------|
| `GOOGLE_CLIENT_ID` (API) | `WC_PROD_API_ENV` / `WC_STAGING_API_ENV` | non-secret; example files: `.github/workflows/WC_PROD_API_ENV.example`, `WC_STAGING_API_ENV.example` |
| `GOOGLE_OAUTH_CLIENT_ID` (booking) | `PROD_BOOKING_ENV` (+ staging equivalent) | browser-exposed/public; example file: `.github/workflows/PROD_BOOKING_ENV.example` |

Add the values to the corresponding GitHub **Variables** (Settings → Secrets and
variables → Actions → Variables), then redeploy. No GitHub *Secret* is needed — the
client ID is public.

---

## 4. Run it locally

```bash
# Terminal 1 — backend API (http://localhost:3000)
npx nx serve wc-nest-api

# Terminal 2 — booking frontend (http://localhost:4303)
npx nx dev wc-booking
```

Open the booking app in the browser. Use the URL/port shown in the terminal — it
**must exactly match** an Authorized JavaScript origin from step 2.2 (default
`http://localhost:4303`). Trigger the auth modal (e.g. click a camp's
"Save"/"Book"/"Log in"), or visit `/auth/signin` directly.

> You need a **real Google account** — the ID token is cryptographically verified
> against Google, so there is no local bypass/mock for manual testing.

---

## 5. Test matrix (manual)

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| 1 | **New user (sign-up)** | Open modal → "Continue with Google" → pick a Google account never used here | Logged in; a `User` (`emailVerified=true`, no password), `UserAccount(google)`, `Parent` profile + `Parent` role are created; the modal's resume action runs (e.g. the camp gets saved) |
| 2 | **Returning user** | Sign out, sign in again with the same Google account | Logged in; **no** duplicate user/account rows created |
| 3 | **Auto-link by email** | Register with email+password using a Gmail you own → verify → sign out → "Continue with Google" with that same Gmail | One `User`, one **new** `UserAccount(google)` linked to it; logged in (no error, no 500) |
| 4 | **One Tap** | As a logged-out visitor on a non-`/auth` page (e.g. home), wait for the One Tap prompt | Prompt appears; selecting an account logs you in. It does **not** appear when already logged in or on `/auth/*` routes |
| 5 | **Avatar import** | Complete scenario #1 with a Google account that has a profile photo | After the profile loads, the avatar shows the imported Google photo (served via Azure SAS). An existing/edited photo is never overwritten |
| 6 | **Both forms** | Confirm the button appears on **both** the sign-in and sign-up forms, in the modal **and** the full-page routes (`/auth/signin`, `/auth/signup`) | Button present on all four surfaces |
| 7 | **Request-based auth** | Set `AUTH_USING_REQUEST=true` in both `.env` files, restart, repeat #1 | Still logs in (tokens read from `x-access-token` headers instead of cookies) |
| 8 | **Disabled state** | Unset `GOOGLE_OAUTH_CLIENT_ID` in booking `.env`, restart | Google button + One Tap disappear; email sign-in/up still work; no console GSI errors |
| 9 | **Other apps untouched** | Open `wc-provider` / `wc-superadmin` sign-in | Email-only, no Google button |

### Verifying the database (optional)
```sql
-- the linked Google identity
SELECT u.email, u.email_verified, u.password_hash, a.auth_provider, a.auth_provider_account_id
FROM users u JOIN user_accounts a ON a.user_id = u.id
WHERE a.auth_provider = 'google';
```
A Google-only user has `password_hash = NULL` and `email_verified = true`.

---

## 6. Automated tests

The backend resolution logic (verification gate, find/link/create, P2002 retry,
best-effort photo import) is covered by unit tests with the Google verifier mocked —
no real Google call:

```bash
npx nx test wc-nest-api --testPathPatterns="google-signin"
```

Type/build and lint gates:
```bash
npx nx build wc-nest-api
npx nx build wc-booking
npx nx run-many -t lint -p wc-nest-api wc-booking wc-frontend-utils
```

---

## 7. Key files (reference)

**Backend** (`apps/wc-nest-api`)
- `src/modules/user/auth/auth.controller.ts` — `googleSignIn` + `resolveGoogleUser` + `importGooglePhotoBestEffort`
- `src/modules/user/auth/services/google-token-verifier.service.ts` — server-side ID-token verification
- `src/modules/user/auth/dto/google-signin.dto.ts` — `{ credential }`
- `src/config/config.service.ts` — `googleOAuthConfig` (fail-at-boot in prod)
- `src/modules/user/auth/google-signin.spec.ts` — tests

**Frontend** (`apps/wc-booking`)
- `src/components/auth/use-google-sign-in.ts` — shared sign-in + store hydration
- `src/components/auth/google-auth-button.tsx` — the button + "or" divider
- `src/components/auth/google-one-tap.tsx` — One Tap
- `src/app/providers.tsx` — conditional `GoogleOAuthProvider` + One Tap mount
- `src/config/config.ts` + `packages/wc-frontend-utils/src/lib/runtime-config/*` — `googleOAuthClientId` wiring

---

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| API won't boot: `Config error - GOOGLE_CLIENT_ID must be a Google OAuth client ID (*.apps.googleusercontent.com)` | In production the value is missing or malformed. Set the correct client ID. |
| Button doesn't render / no One Tap | `GOOGLE_OAUTH_CLIENT_ID` is empty in the booking env, or the browser origin isn't in **Authorized JavaScript origins**. Match the exact `scheme://host:port`. |
| Console: `The given origin is not allowed for the given client ID` | Add the current origin (incl. port) to the OAuth client's Authorized JavaScript origins; changes can take a few minutes to propagate. |
| `401 Invalid Google credential` on sign-in | The ID token failed verification — usually a **client-ID mismatch** between booking (`GOOGLE_OAUTH_CLIENT_ID`) and API (`GOOGLE_CLIENT_ID`). They must be identical. |
| `401 Google email not verified` | The Google account's email isn't verified by Google; we reject these by design. |
| One Tap never shows | Browser blocks third-party sign-in / FedCM, or the user dismissed it repeatedly (Google cools it down). Try an incognito window; the explicit button always works. |
| "Unverified app" warning / capped at 100 users | The OAuth consent screen is still in *Testing*. Publish it (step 2.1). |
| Works locally, fails on staging/prod | The deployed env var isn't set, or the deployed origin isn't an Authorized JavaScript origin. |

---

## 9. Security notes
- The ID token is **always verified server-side** (signature, audience, issuer,
  expiry) — client-supplied identity claims are never trusted.
- The `email_verified` check runs **before** any account lookup, which is what makes
  auto-linking by email safe (prevents account takeover via an unverified Google
  email).
- We store **no** Google tokens (`idToken`/`accessToken` are not persisted); only the
  provider account id (`sub`) is kept in `user_accounts`.
- The client ID is public by design (it's embedded in the page); there is no client
  secret in this flow.
