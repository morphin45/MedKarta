# Personal Health OS — Product & System Design

Privacy-first personal health organization + emergency app. An MVP built as a **local-first, zero-backend web application**: every byte of health data is encrypted client-side (AES-GCM, key derived from the user's secret via PBKDF2) and stored only in the browser's IndexedDB. No health data ever leaves the device.

> **Not a medical device.** This app organizes information the user enters. It never diagnoses, never recommends treatments, and never changes medication instructions. All summaries are derived only from user-entered data and are always labeled "Generated from your information — review for accuracy."

## 1. Product architecture

Chosen stack (matches the host workspace and keeps health data device-local, which is the strongest possible privacy posture for an MVP):

- **Frontend:** React 19 + TypeScript (strict), Vite 7
- **Styling:** Tailwind CSS 4 with a calm clinical design system (navy/teal/accessible blue, red reserved for emergency)
- **State:** Zustand store with explicit actions; IndexedDB persistence behind a repository interface
- **Crypto:** WebCrypto — PBKDF2-SHA256 (310k iterations) → AES-GCM 256 for all health payloads; SHA-256 hash chain for tamper-evident audit log; session key held only in memory
- **Locks:** master password, optional PIN (rate-limited), optional WebAuthn passkey used via PRF extension to unwrap the vault key (biometric unlock where the platform supports it)
- **Tests:** Vitest (crypto, domain logic, store, gating, permissions, audit chain)
- **No backend, no telemetry, no analytics.** Future cloud sync is designed-for but deliberately not built (see §7).

Layering: `views/` (screens) → `store/` (auth + actions) → `domain/` (pure logic: gating, permissions, adherence, summaries, extraction, export, audit) → `lib/` (crypto, idb, utils) → `data/` (schema, seed). `domain/` and `lib/` are pure and unit-tested.

## 2. User flows

- **First run:** Welcome → create account (name + email + master password, strength-checked) → consent & privacy setup (explicit opt-ins, revocable) → emergency profile setup → dashboard. Demo mode seeds clearly labeled sample data.
- **Unlock:** launch → vault locked → password, PIN, or passkey/biometric → auto-lock after inactivity → emergency profile remains accessible without unlocking (only fields the user marked "share when locked").
- **Emergency:** big red button (nav + dashboard + header) → Emergency Mode: profile card with verified/unverified separation, call 911/112 fallback, call contact, share link, QR, printable card, last-updated timestamp, staleness warning.
- **Caregiver invite:** contacts → add person → choose permission scopes → invite → acceptance code → active grant → access log → review/revoke/expire anytime. Nobody has any access by default.
- **Records:** upload document → OCR/parse extract → "Needs review" staging → user confirms/edits → only then enters timeline.
- **Visit prep:** upcoming appointment → generate summary from user's own records (labeled, with sources) → after visit: record instructions, changes, follow-ups → tasks flow to dashboard.

## 3. Database schema

Local schema (v1) — entities and key fields. All rows carry `createdAt`/`updatedAt`; deletes are soft (`deletedAt`) for records, immutable for audit.

- `users` — id, email, name, preferredName, kdf salt/params, verifier, autoLockMinutes, createdAt
- `userProfile` — dob, bloodType (+ verified flag), organDonor (opt-in), preferredLanguage, accessibilityNeeds, weightKg, heightCm
- `emergencyProfile` — include flags per field (dob, address, blood type only if verified, organ donor, notes), share-when-locked flags, emergencyNotes, advanceDirective doc ref, lastUpdatedAt
- `allergies` — substance, reaction, severity (mild/moderate/severe/unknown), verified
- `medicalConditions` — name, status (active/managed/resolved), onsetDate, notes, verified
- `medications` — name, brand, dose, form, purpose, instructions, prescriberId, pharmacy, startDate, endDate, status (active/paused/completed/discontinued), supplyRemaining, refillQuantity, refillDueDate, confirmedByClinician
- `medicationSchedules` — medicationId, timesOfDay, daysOfWeek, doseLabel
- `medicationLogs` — scheduleId, date, time, status (taken/skipped/missed), note
- `prescriptions` — medicationId, number, issuedBy, issuedOn, expiresOn, refillsLeft, documentId
- `doctors` — name, specialty, clinic, phone, email, isPrimary
- `facilities` — name, type, address, phone
- `appointments` — doctorId, facilityId, datetime, reason, status (scheduled/completed/cancelled), prepSummary (ai metadata), postVisit fields (summary, instructions, followUpDate, referrals, openQuestions)
- `symptoms` — description, startedOn, severity(1-10), status, triggers
- `timelineEntries` — unifying chronology: category (diagnosis/symptom/medication/allergy/procedure/surgery/test/lab/imaging/hospital/vaccination/specialist/carePlan/note), title, date, providerId, facilityId, notes, tags[], source, verificationStatus (verified/user-entered/needs-review), relatedIds
- `labResults` / `imagingRecords` / `vaccinations` / `hospitalVisits` / `procedures` / `diagnoses` — typed details linked to timeline entries
- `healthDocuments` — name, category, mime, size, ciphertext (encrypted), ocrText, extracted (staged, needs-review), version history, archivedAt
- `emergencyContacts` — name, relationship, phone, email, preferredMethod, priority, isEmergencyContact
- `caregiverGrants` — contactId, scopes[], status (invited/active/expired/revoked), invitedAt, acceptedAt, expiresAt, code hash
- `consents` — type, granted, grantedAt, revokedAt, version, textHash
- `notifications` — type, title, body, scheduledFor, readAt, severity (info/warning/urgent)
- `auditLog` — append-only hash-chained: seq, at, actor, action, entity, entityId, meta (no PHI), prevHash, hash
- `sessions` — deviceId, label, createdLast, lastSeen, current (device/session management)
- `verificationRecords` — entityType, entityId, verifiedBy, verifiedAt, method (clinician/document/user)

## 4. API design

MVP is fully client-side; the repository layer (`lib/idb.ts`) is the "API". For a future cloud deployment the surface is:

```
POST /v1/auth/register | login | logout
POST /v1/auth/passkey/register | authenticate      (WebAuthn PRF)
POST /v1/vault/sync          (encrypted blobs only — server is untrusted)
GET  /v1/emergency-profile/:slug      (public, consent-scoped, rate-limited, revocable, minimum-info)
POST /v1/caregivers/invite | accept | revoke
GET  /v1/grants/:id/log
POST /v1/notifications/dispatch     (server sends push/SMS/email; payloads contain no PHI by default)
POST /v1/export | DELETE /v1/account
```

Design invariants for the cloud version: end-to-end encryption (server stores ciphertext), emergency share links are opaque + rotating + revocable + rate-limited, caregiver access is enforced server-side per scope with break-glass audit, and no PHI in URLs/logs.

## 5. Security model

- **Threat model (summary):** attacker with device access (→ auto-lock, PIN/biometric, passkey PRF), stolen backup files (→ ciphertext only), malicious server (→ none exists; cloud design is E2EE), QR photographed/shared (→ consent-gated minimum fields, watermark, revocable, rotation planned), phishing/social (→ caregiver consent workflow with acceptance codes + access log), lost device (→ sessions list + revoke; cloud: remote wipe).
- **Controls:** PBKDF2 310k + per-user salt; AES-GCM for every payload; key never persisted (memory only); 3-strike PIN rate limit; 15-min auto-lock (configurable); hash-chained append-only audit log with verification; explicit per-field emergency sharing consent; no PHI in notifications/URLs/logs; data export; real account deletion (vault destroyed).

## 6. MVP implementation plan (executed order)

1. Crypto + vault + auth/unlock ✅ 2. Profile + consent ✅ 3. Emergency profile + Emergency Mode ✅ 4. Medical Memory timeline ✅ 5. Medication center ✅ 6. Health records + OCR review ✅ 7. Doctor visit assistant ✅ 8. Contacts & caregivers ✅ 9. Notifications ✅ 10. Export/audit/settings ✅

## 7. Deliberately deferred (with reasons)

- **Cloud sync / true multi-device:** requires a backend with E2EE design + security review; local-first is safer for MVP and works offline.
- **Real SMS/email/push delivery** and **Apple Health / Health Connect / FHIR** integrations: third-party review needed; notification center + export/import keep the door open.
- **LLM summarization:** this build uses deterministic, auditable, template-based summaries ("Generated from your information") with zero PHI leaving the device; an optional on-device or opt-in model hook can be added later.
- **Shared/dependent profiles (multi-profile & child accounts):** data model supports `profileId` on records; switching UI deferred until guardian-consent flows get legal review.

## 8. Requires legal / clinical / security review before real-world deployment

- Any claim of HIPAA/GDPR/PIPEDA compliance (not assessed here)
- Emergency calling behavior per platform (tel: handling, lock-screen/quick-access integration, NFC profile standards)
- Public share-link exposure rules and QR anti-abuse (rate limits, rotation, revocation SLAs)
- Caregiver access + break-glass policies, consent language, and jurisdiction-specific capacity/consent law
- Medication reminder reliability ("missed dose" surfaced to caregivers), interaction references (would need licensed drug database)
- OCR extraction accuracy disclaimers and document retention rules
- Data residency, breach notification, and audit retention policy
- Marketing language: avoid any implication of diagnosis/treatment
