# API documentation

The MVP has no HTTP API: the app is local-first and the "API" is the in-app repository/domain layer. This document describes (A) that layer so future clients can be written against it, and (B) the REST surface a future sync backend must implement, including the invariants that keep it zero-knowledge.

## A. Local API (implemented)

### Store (`src/store/useHealth.ts`)

| Action | Signature | Notes |
| --- | --- | --- |
| `boot()` | `() => Promise<void>` | Detects an existing vault; restores the consent-gated lock-screen emergency preview |
| `createAccount(name, email, password, demo)` | `Promise<void>` | PBKDF2 → verifier + vault; seeds demo data when `demo` |
| `unlock(password)` / `unlockWithPin(pin)` / `unlockWithPasskey()` | `Promise<void>` | Decrypts the vault into memory; wrong credential fails AES-GCM auth |
| `setupPin(pin)` / `removePin()` / `setupPasskey()` / `removePasskey()` | `Promise<void>` | Second-factor enrolment for fast unlock |
| `lock()` | `void` | Drops the key and all entities; keeps only the approved emergency subset |
| `enterEmergencyFromLock()` | `void` | Opens Emergency Mode from a locked app using the cached subset |
| `resolveEmergency()` | `ResolvedEmergencyProfile \| null` | Pure gating: consented fields only, verified-only blood type |
| `saveEmergency(patch)` | `Promise<void>` | Updates sharing toggles; restamps `lastUpdatedAt` |
| `createShareLink()` / `revokeShareLink(id)` | `Promise<void>` | Consent-gated emergency share links |
| `setConsent(type, granted)` | `Promise<void>` | Writes a versioned, timestamped `ConsentRecord` |
| `upsert(collection, item)` / `softDelete(collection, id)` | `Promise<void>` | Generic CRUD; encrypts, persists, appends audit, refreshes the locked preview |
| `addMedicationLog(medicationId, time, status, note?)` | `Promise<void>` | Dose check-in (taken/skipped/missed) |
| `generatePrepSummary(appointmentId, goals?)` | `Promise<void>` | Deterministic pre-visit summary with provenance |
| `exportVaultJson()` / `exportSummaryText()` | `string` | Portability exports |
| `verifyAudit()` | `Promise<boolean>` | Hash-chain verification |
| `deleteAccount()` | `Promise<void>` | Destroys vault, locked cache and device key |

### Domain functions (pure, unit-tested)

```ts
resolveEmergencyProfile(inputs, now?)      // consented fields only; blood type iff verified
mayCacheForLockScreen({ hasUser, hasEmergencyProfile, shareWhenLocked, consentGranted })
emergencyCardText(profile)                 // plain-text printable card
normalizeScopes(scopes)                    // dependency closure + mutual exclusion
checkCaregiverAccess(grants, contactId, scope, now?)   // { allowed, reason }
acceptanceMatches(grant, codeHash) / markAccepted(grant) / revokeGrant(grant) / expireIfStale(grant)
todayDoseSlots(meds, logs, now?) / adherenceLast7Days(meds, logs, now?) / refillAlerts(meds)
buildVisitPrepSummary({ appointment, medications, allergies, conditions, timeline })
extractFromDocumentText(text, filename)    // → needs-review fields + suggested category
findDuplicateMedications / findConflictingMedications / findSimilarTimelineEntries
appendAudit(log, entry) / verifyAuditChain(log)
```

## B. Future REST surface (design, not implemented)

Every endpoint below assumes the server stores **only ciphertext** and never holds the master password or derived keys.

```
# Identity & device
POST   /v1/auth/register                  { email, kdfParams, verifierHash }        → 201
POST   /v1/auth/login                     { email, verifierResponse }               → session
POST   /v1/auth/passkey/register|assert   WebAuthn challenge/response (PRF)
DELETE /v1/auth/session                   revoke current device session for this user
GET    /v1/sessions                       list devices + last-seen (for remote sign-out)

# Zero-knowledge sync
PUT    /v1/vault                          { version, ciphertext, updatedAt }        → 200 (opaque blob)
GET    /v1/vault                          → { version, ciphertext, updatedAt }
POST   /v1/vault/conflicts/resolve        client-supplied resolution only

# Emergency sharing (minimum-info, revocable, rate-limited)
POST   /v1/emergency-shares               { expiresAt, maxViews }                   → { shareId, token }
GET    /v1/emergency-shares/:shareId      rate-limited, immutable-scope read
DELETE /v1/emergency-shares/:shareId      instant revocation
GET    /v1/emergency-shares               list active shares + view counts

# Caregivers
POST   /v1/caregivers/invite              { contactEmail, scopes[], expiresAt }     → one-time code
POST   /v1/caregivers/accept              { code }                                  → active grant
PATCH  /v1/caregivers/:grantId            change scopes / extend expiry
DELETE /v1/caregivers/:grantId            revoke
GET    /v1/caregivers/:grantId/access-log paginated audit trail
GET    /v1/grants/effective               what the caller may see (server-enforced scopes)

# Notifications (no PHI in payloads by default)
POST   /v1/notifications/dispatch         { userId, template, channel, generic: true }
POST   /v1/notifications/preferences      per-channel opt-in/opt-out

# Data rights
POST   /v1/export                         async job → downloadable ciphertext archive
DELETE /v1/account                        destroys ciphertext + keys + grants
```

### Invariants any implementation must preserve

1. **Zero-knowledge:** the server never receives plaintext health data, the master password, or an unwrapped key.
2. **Full-field encryption:** `vault.ciphertext` is client-encrypted; the server cannot read, index, or filter it.
3. **Minimum-info sharing:** emergency shares expose only consented fields, expire, are revocable, count views, and are rate-limited per share and per IP.
4. **No PHI in transport metadata:** no health terms in URLs, query strings, headers or log lines. Share IDs are opaque.
5. **Server-enforced scopes:** caregiver reads are authorized per scope server-side — never trust a client claim.
6. **Append-only audit:** grants, revocations, and emergency-share access are recorded server-side with actor + timestamp.
7. **Deletion is deletion:** account deletion destroys ciphertext and keys; no shadow copies beyond a documented, bounded backup window.

### Notification provider contract

Providers are pluggable adapters: `send({ userId, channel, templateId, variables })`. Rules: templates must be PHI-free (e.g. "You have a reminder in Personal Health OS"); deep links must open a locked app rather than embedding data; delivery failures must fall back to in-app notifications and must never retry with more content. SMS/email are opt-in per channel per event type, and caregiver alerts require the `receive-selected-alerts` scope *plus* the `alerts-to-caregivers` consent.

### QR / NFC design

- **MVP behavior:** the QR encodes the approved emergency subset for on-device display; nothing is transmitted.
- **Production hardening:** encode an opaque, rotating share token instead of data, resolve it through `GET /v1/emergency-shares/:id` with strict rate limiting and view counting, and support revocation. NFC wristbands/bracelets would carry the same token so a scanned tag resolves to a live, revocable profile rather than a stale snapshot.
- **Anti-abuse:** per-share view limits, IP/ASN throttling, revocation SLA, and a visible "last accessed" list so users can spot unexpected reads.
