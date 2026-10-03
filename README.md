# Personal Health OS

A privacy-first app for organizing your own medical information — and reaching a one-tap emergency profile when it matters.

> **This is not a medical device and not medical advice.** Personal Health OS organizes information *you* enter. It does not diagnose, does not recommend or change treatment, does not check drug interactions, and does not replace emergency services (call 911/112) or your care team. Summaries are generated only from your own records and are always labeled "Generated from your information — review for accuracy."

---

## Why this architecture (and what changed from the brief)

The brief suggested Next.js + PostgreSQL + server-side auth. This MVP is instead a **local-first single-page app with client-side encryption**, and that is a deliberate, opinionated choice for a health app at MVP stage:

| Concern | Local-first choice | Why it is better here |
| --- | --- | --- |
| Privacy | No server ever receives health data | Nothing to breach, subpoena, or leak. Data minimization by construction. |
| Emergency access | Emergency profile readable from the lock screen | Works with no network, no login, no backend — the actual failure mode in an emergency. |
| Consent | Consent records live with the data | Auditable on-device; no silent server-side sharing. |
| Compliance | No server-side PHI processing | Far less regulatory surface than a hosted store of records. |
| Trade-off | No multi-device sync | Deliberate. Sync requires E2EE protocol design + security review — see `docs/API.md`. |

The stack matches the host workspace and the brief's frontend recommendation: **React 19 + TypeScript (strict) + Vite 7 + Tailwind CSS 4 + Zustand**, with **WebCrypto** for encryption and **IndexedDB** for storage. Everything the brief asked of a backend (schema, validation, RBAC, audit, rate limiting) exists as a tested domain layer that maps 1:1 onto a future API — documented in `docs/API.md`.

## Quick start

```bash
cd health-os
npm install
npm run dev        # http://localhost:5199
npm test           # 70 unit/integration tests
npm run typecheck  # tsc -b, strict
npm run build      # typecheck + production build
```

On first run, create a vault. Tick **"Explore with sample data"** to get a fully-populated demo profile (Maria Santos) so every screen has content; demo data is labeled as sample data in the UI. Use a real master password you will remember — **a local vault cannot be recovered without it.**

If you ever forget the master password, the lock screen offers **"I cannot remember it — start over"**, which permanently erases the vault and returns you to onboarding. There is no recovery.

## Deploying

The app is a fully static SPA — no backend, no database, no environment variables. `npm run build` emits a self-contained `dist/` you can host anywhere.

**Vercel:** import the repo and set the **Root Directory to `health-os`**. Everything else is auto-detected (`framework: vite`, `npm run build`, output `dist`). [vercel.json](vercel.json) already pins the build command, adds the SPA rewrite, and sets long-lived immutable caching for `/assets`, `/fonts` and `/icons` plus baseline security headers.

**Netlify / Cloudflare Pages / S3+CloudFront / nginx:** build with `npm run build` and publish `dist/`. Copy the headers from `vercel.json` into your platform's config, and configure **all unmatched routes to serve `index.html`** — this app uses in-memory screen state, but the rewrite keeps deep links and refreshes from working regardless.

Two things to know before you share the link publicly:

- **Serve it over HTTPS.** WebCrypto (`crypto.subtle`) and WebAuthn passkeys are unavailable in insecure contexts, so passkey unlock and the encryption layer require a secure origin. `localhost` is exempt, which is why development works over plain HTTP.
- **The build is ~4.4 MB, 90% of which is one font file** (`fonts/material-symbols-outlined.woff2`, a variable font with FILL/GRAD axes covering thousands of glyphs, of which the app uses roughly twenty). It is served with a one-year immutable cache, so it is a one-time cost per visitor, but it is worth subsetting before a real launch — see the note below.

To subset the icon font you need [fonttools](https://github.com/fonttools/fonttools) (`pip install fonttools brotli`) and the glyph names actually referenced in `src/`. The app's icons are Material Symbols ligature names, so collect them from `TAB_NAV` in `components/Layout.tsx` and every `<Ico name="..." />` call, then:

```bash
pyftsubset public/fonts/material-symbols-outlined.woff2 \
  --text-file=used-glyphs.txt --output-file=public/fonts/material-symbols-subset.woff2 \
  --layout-features='*' --flavor=woff2
```

Update the `@font-face` in `src/index.css` to point at the subset. Do **not** skip this if you disable icons — the font is also used for ligature names appearing as text.

### Environment variables

**None are required.** The app makes no network calls and ships no secrets. Documented variables for future/optional integrations:

| Variable | Required | Purpose |
| --- | --- | --- |
| *(none)* | — | Core app, including encryption, reminders and QR all run offline. |

If you later add the deferred integrations, use these names to keep parity with the API design in `docs/API.md`: `VITE_SYNC_ENDPOINT`, `VITE_PUSH_PUBLIC_KEY`, `VITE_NOTIFY_EMAIL_FROM`, `VITE_DRUG_DATABASE_KEY`. Never put a secret that can read health data in a `VITE_` variable — anything prefixed `VITE_` is compiled into the client bundle and is public.

## What is implemented

| # | MVP priority | Status | Where |
| --- | --- | --- | --- |
| 1 | Secure authentication | ✅ Master password (PBKDF2 310k → AES-GCM), optional PIN, optional passkey/biometric (WebAuthn PRF), 3-strike PIN lockout, auto-lock, device/session list | `store/useHealth.ts`, `lib/crypto.ts`, `lib/passkey.ts` |
| 2 | User profile | ✅ Name, preferred name, DOB, blood type **+ verification flag**, organ-donor status, language, accessibility needs | `views/Settings.tsx` |
| 3 | Emergency profile | ✅ Per-field sharing toggles, verified-only blood type, opt-in organ donor, devices, physicians, advance directives, staleness warning | `views/EmergencySetup.tsx`, `domain/emergency.ts` |
| 4 | Emergency Mode | ✅ One tap from header/dashboard/lock screen; call 911 + call contact; share link; QR; printable card; timestamp; incompleteness warning; verified vs unverified separation | `views/Emergency.tsx`, `views/Lock.tsx` |
| 5 | Medical timeline | ✅ 14 categories, search, filters (date/category/verification), tags, sources, related records, duplicate detection | `views/Memory.tsx`, `domain/records.ts` |
| 6 | Medication tracking | ✅ Full field set, active/paused/completed/discontinued, dose check-ins, adherence, supply + refill alerts, clinician-confirmation flag, missed-dose guardrails | `views/Medications.tsx`, `domain/medications.ts` |
| 7 | Health records upload | ✅ Categories, search/archive/delete, on-device extraction into a **Needs review** queue, version field, encrypted content | `views/Records.tsx`, `domain/ocr.ts` |
| 8 | Doctor visit preparation | ✅ Deterministic pre-visit summary with goals + provenance, post-visit instructions/diagnoses/tests/follow-ups/referrals/open questions | `views/Visits.tsx`, `domain/visits.ts` |
| 9 | Emergency contacts | ✅ Relationship, phone/email, preferred channel, priority ordering, "list on emergency profile" flag | `views/Contacts.tsx` |
| 10 | Caregiver permissions | ✅ 8 scopes with dependency rules, invite → one-time acceptance code → active, expiry, instant revoke, access log, notifications on change | `views/Contacts.tsx`, `domain/permissions.ts` |
| 11 | Notifications | ✅ Refill, appointment prep, expiring access, stale emergency profile; severity tiers; no PHI in previews | `views/Notifications.tsx`, `domain/notifications.ts` |
| 12 | Data export & audit logs | ✅ Full JSON export, plain-text health summary, hash-chained tamper-evident audit log with verify action, real account deletion | `views/Settings.tsx`, `domain/audit.ts` |

Also delivered: onboarding + consent setup, dark mode, text-size scaling, reduced-motion support, skip link, screen-reader labels, keyboard navigation, 44px+ touch targets, print stylesheet for the emergency card.

## Screens (23 from the brief)

Welcome/onboarding ✅ · account creation ✅ · consent & privacy setup ✅ · emergency profile setup ✅ · Emergency Mode ✅ · dashboard ✅ · medical timeline ✅ · add/edit medical event ✅ · medication list ✅ · add/edit medication ✅ · medication schedule (reminder times + daily dose check-in) ✅ · records library ✅ · upload & review document ✅ · doctor appointments ✅ · pre-visit summary ✅ · post-visit instructions ✅ · emergency contacts ✅ · caregiver permissions ✅ · sharing history (share links + access logs) ✅ · notifications ✅ · settings ✅ · security & sessions ✅ · data export & deletion ✅

## Documentation

- [docs/DESIGN.md](docs/DESIGN.md) — product architecture, user flows, database schema, API design, MVP plan, explicit deferrals
- [docs/SECURITY.md](docs/SECURITY.md) — threat model, encryption design, data-flow diagram, security controls, incident guidance
- [docs/API.md](docs/API.md) — repository API, future REST surface, notification providers, share-link/QR design
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — static hosting, container, required headers, release checklist

## Security & privacy posture (summary)

- **Encryption at rest:** the entire entity map is JSON → AES-GCM-256, key derived with PBKDF2-SHA256 (310,000 iterations, per-vault random salt). The key exists only in memory while unlocked.
- **No PHI in URLs, logs, analytics or error messages.** There is no analytics and no telemetry at all.
- **Consent by default is "off".** Every sharing feature (lock-screen emergency access, share links, QR, caregiver alerts) requires an explicit, timestamped, revocable consent record.
- **Lock-screen emergency access** is a documented trade-off (like a medical bracelet): only the approved subset is cached, encrypted with a device key, and the cache is destroyed the moment you disable the setting or delete your account.
- **Caregivers have zero access by default**, must accept a one-time code, are limited to granted scopes, expire automatically, and every change is logged.
- **Audit log is append-only and hash-chained**; tampering is detectable in-app (Settings → Security & sessions).
- **Account deletion is real:** it destroys the vault, the lock-screen cache and the device key.

Full details, attack scenarios and residual risks: [docs/SECURITY.md](docs/SECURITY.md).

## Testing

```bash
npm test               # unit + integration (70 tests, no network/browser needed)
npm run typecheck      # tsc -b, strict
npm run build          # typecheck + production build
```

Coverage by area: crypto (round-trip, wrong-key failure, PIN wrapping, IV uniqueness), audit chain (tamper + deletion detection), emergency gating (consented fields only, verified-only blood type, organ-donor opt-in, staleness, plain-text card), lock-screen access gate, caregiver workflow end-to-end (invite → code → accept → scoped access → revoke → expiry), medication schedule/adherence/refill math, duplicate & conflict detection, document extraction, pre-visit summary provenance and goals.

There is currently **no browser E2E suite**. Playwright is not a dependency and no `test:e2e` script exists — the emergency-mode and caregiver-permissions flows are covered only by the domain/integration layer described above. If you add E2E specs, run them before relying on them; note that the app encrypts a real vault in IndexedDB, so each spec needs a fresh browser context.

## Edge cases handled

| Case | Handling |
| --- | --- |
| No internet | Everything works offline; there is no network dependency. |
| Expired emergency info | 180-day staleness warning on the profile, dashboard banner and a notification. |
| Unknown blood type | Never shown in Emergency Mode unless marked verified by a clinician. |
| Unverified allergies | Shown but explicitly labeled *Unverified*. |
| Conflicting/duplicate medication records | Detected and surfaced for review; never auto-merged or auto-corrected. |
| Revoked / expired caregiver access | Checked on every access attempt; expired grants swept on load; revocation is instant. |
| Lost device | Lock-screen exposure is limited to the approved emergency subset; sessions are listed; cloud remote-wipe would need the deferred backend. |
| Account recovery | Not possible by design — the vault is unrecoverable without the master password. Stated plainly in the UI. |
| Incorrect OCR extraction | Extracted fields are staged as *Needs review* and never enter the timeline until confirmed. |
| Deleted documents | Soft delete (`deletedAt`), restorable via the archive view; exports reflect only live records. |
| Multiple profiles / dependents | Schema carries `userId` per record and the data model supports it; the switching UI is deferred pending guardian-consent legal review. |
| Emergency QR photographed/shared | QR renders only consented fields; production hardening (rotating opaque tokens, rate limits) specified in `docs/API.md`. |
| User cannot unlock the device | Emergency Mode is reachable from the lock screen when consented; the printable card can be carried separately. |

## Accessibility

WCAG 2.2 AA-oriented: semantic landmarks, skip link, `aria-current` navigation state, switches with `role="switch"` + `aria-checked`, labels and hints programmatically associated, error regions with `role="alert"`, focus-visible outlines, keyboard-only operation, ≥44px targets, adjustable text size (100/112/125/150%), dark mode, reduced-motion support, high-contrast emergency screen, plain-language copy, and confirmation screens before destructive/high-impact actions. Automated axe checks and screen-reader regression passes are recommended before deployment (see the review list).

## Requires review before real-world deployment

Nothing here claims HIPAA/GDPR/PIPEDA compliance — that has **not** been assessed.

**Legal:** consent language and revocation semantics; caregiver/break-glass access policy; jurisdiction-specific capacity and minor/dependent consent law; data-residency and breach-notification obligations; whether lock-screen emergency data counts as authorized disclosure.
**Clinical:** any drug-interaction or dosing guidance (needs a licensed database + clinician sign-off); OCR accuracy disclaimers; reminder reliability for critical medications; whether medication adherence should ever be exposed to caregivers.
**Security:** independent penetration test; E2EE protocol review before any sync is enabled; QR/share-link anti-abuse (rotation, rate limiting, revocation SLA); device-key threat modelling for the lock-screen cache; passkey PRF fallback behaviour across platforms.
**Regulatory:** determine whether any future feature pushes this into medical-device (FDA/MDR) or health-data regulation; accessibility conformance audit; store-review requirements for emergency-calling and lock-screen widgets on iOS/Android.

## Deliberately not built (and why)

Cloud sync / multi-device, real SMS/email/push delivery, Apple Health / Health Connect / FHIR import, LLM summarization, and multi-profile switching. Each needs protocol design plus security, clinical or legal review; the data model and API design already accommodate them. Rationale per item is in `docs/DESIGN.md`.
