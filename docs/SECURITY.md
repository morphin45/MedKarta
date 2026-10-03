# Security model, threat model & data flow

## 1. Design principles

1. **Data minimization by construction.** There is no server. Health data never leaves the device, so there is no centralized honeypot, no third-party processor, and no telemetry.
2. **Secure by default.** Every sharing feature starts *off*. Caregivers start with zero access. The emergency profile starts with every field off.
3. **Consent is data.** Each permission is a timestamped, versioned, revocable `ConsentRecord` — not a checkbox that vanishes into the void.
4. **Verified ≠ entered.** The UI distinguishes clinician/document-verified facts from user-entered ones everywhere, and emergency-mode rules cannot be overridden by consent (blood type requires verification; organ-donor status requires opt-in).
5. **Honest security claims.** Where a control has a real trade-off (lock-screen emergency access), it is documented, consented to, and reversible — not hidden.
6. **No PHI leaks through side channels.** No health content in URLs, notification previews, audit log entries, console output, or error messages.

## 2. Cryptographic design

| Element | Implementation |
| --- | --- |
| Key derivation | PBKDF2-SHA256, 310,000 iterations, 16-byte random per-vault salt (`lib/crypto.ts`) |
| Vault encryption | AES-GCM-256; fresh 12-byte IV per encryption; stored as `base64(iv).base64(ciphertext)` |
| Key lifetime | Derived key lives in memory only while unlocked; never written to disk unwrapped |
| Password verification | PBKDF2-derived verifier digest compared in constant-shape comparison; the password itself is never stored |
| PIN unlock | Vault key wrapped with a second PBKDF2 (5,000 iterations) key derived from the PIN; wrong PIN fails AES-GCM authentication |
| Biometric/passkey | WebAuthn passkey with the **PRF extension**; the PRF output wraps the vault key. Feature-detected — the option is hidden if unsupported |
| Transport | Not applicable — no network calls |
| Audit integrity | SHA-256 hash chain (`seq \| at \| actor \| action \| entity \| entityId \| meta \| prevHash`); verification surfaces in Settings |
| Lock-screen cache | Approved emergency subset only, encrypted with a device key in `localStorage`; destroyed on disable/account deletion |

**Why the vault key is exportable:** wrapping it with a PIN or passkey-PRF secret requires `exportKey('raw')`. The key still only ever exists in memory; the raw export is transient and never persisted.

## 3. Threat model

Scope: a single-user, single-device deployment. Assets: medical records, medications, documents, emergency profile, caregiver grants, audit log.

| # | Threat | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| T1 | Attacker copies the browser profile / backup files | Full record disclosure | Vault is AES-GCM ciphertext; without the master password it is opaque. PBKDF2 310k makes offline guessing expensive | Mitigated |
| T2 | Person picks up an unlocked, unattended device | Full disclosure | Auto-lock (default 15 min, configurable), manual "Lock now", lock clears the key and all entities from memory | Mitigated |
| T3 | Someone reads the phone in a locked state | Disclosure of the approved emergency subset | Consent-gated cache of only approved fields; the rest is unreachable; cache is device-key encrypted; user can disable or delete it | **Accepted trade-off** (documented + consented, equivalent to a medical bracelet) |
| T4 | Brute-forcing the PIN | Vault disclosure | PIN wraps the key with PBKDF2; wrong guesses fail authentication; 3-attempt lockout; master password remains the strong fallback | Mitigated (rate limiting is in-memory; server-grade throttling needs the deferred backend) |
| T5 | Photographing / sharing the emergency QR or share link | Disclosure of approved fields to unintended people | Only consented fields rendered; links are user-created and revocable; QR/share require the unlocked app so consent can be checked | Partially mitigated — rotation, expiry and rate limiting are specified in `docs/API.md` and not yet built |
| T6 | Malicious caregiver exceeds granted scope | Unauthorized record access | Access checks are pure functions evaluated per scope; grants expire, are revocable instantly, and every change is logged; full records are never exposed to a scoped grant | Mitigated (UI/local enforcement; server-side enforcement needed once sync exists) |
| T7 | Tampering with the audit log to hide access | Loss of accountability | Append-only hash chain; any edit or deletion breaks verification, which the app detects and reports | Mitigated |
| T8 | Malicious browser extension / XSS reading memory | Full disclosure | No third-party scripts, no CDN, no analytics; strict local-only bundle. **A production deployment should add a strict CSP** (see `docs/DEPLOYMENT.md`) | Partially mitigated |
| T9 | Shoulder-surfing the emergency screen | Partial disclosure | High-contrast but minimal by design; nothing beyond approved fields | Accepted |
| T10 | Device theft with no screen lock | Full disclosure if unlocked | App auto-locks; OS-level device passcode is the user's responsibility and is called out in onboarding | Partially mitigated |
| T11 | Silent exfiltration via notifications | Disclosure | Notification bodies are generic; no PHI in previews; no push provider is configured | Mitigated |
| T12 | Malicious/incorrect OCR data poisoning the record | Wrong clinical decisions downstream | Extraction output is staged as *Needs review*; nothing enters the timeline until the user confirms and can edit every field | Mitigated |
| T13 | Lost master password | Permanent data loss (availability) | Unavoidable and intentional (that is what makes T1 hold). Stated plainly in the UI; users are pushed to export | Accepted |

Out of scope (requires the deferred backend or is inherently out of the app's control): supply-chain attacks on the browser/OS, a compromised device with a keylogger, coercion, and physical device extraction with hardware-level attacks against a weak master password.

## 4. Data flow

```
                         ┌─────────────────────────────────────────────┐
                         │              Browser (this device)          │
                         │                                             │
  master password ──────▶│  PBKDF2(310k, salt) ──▶ AES-GCM key (RAM)   │
                         │                                │            │
  PIN / passkey ────────▶│  unwrap wrapped key ────────────┘            │
                         │                                             │
                         │   entities (users, medications, timeline,    │
                         │   documents, grants, consents, audit…)      │
                         │        │                        ▲           │
                         │        │ JSON.stringify          │ parse      │
                         │        ▼                        │           │
                         │   AES-GCM encrypt ────────▶ AES-GCM decrypt  │
                         │        │                                     │
                         │        ▼                                     │
                         │   IndexedDB  kv.account { kdf, verifier,     │
                         │                          vault: ciphertext }│
                         │   IndexedDB  meta.locked-emergency          │
                         │              { enc: device-key ciphertext }  │
                         └───────────────┬─────────────────────────────┘
                                         │
                    ┌────────────────────┼──────────────────────┐
                    ▼                    ▼                      ▼
             Emergency Mode       Healthcare providers     Caregivers (deferred)
             (on-screen only)     (print / user-shared)    (only after one-time
                                                            code acceptance, scoped,
                                                            expiring, revocable)
```

Key invariant: the only two things ever persisted are **ciphertext** (vault) and a **device-key-encrypted copy of the approved emergency subset**. No plaintext PHI is written to disk, and nothing is sent over a network.

Data lifecycle: records are created → encrypted on every write (`persist()`) → soft-deleted (`deletedAt`) where appropriate → destroyed permanently (vault + cache + device key) on account deletion. Audit entries are appended immutably and never contain health content.

## 5. Security controls checklist

- [x] Encryption in transit (N/A — no transport) and at rest (AES-GCM-256)
- [x] Strong password hashing (PBKDF2, 310k iterations, per-vault salt)
- [x] Passkey/biometric unlock where the platform supports PRF
- [x] Automatic session timeout + manual lock; sessions/devices listed
- [x] Explicit, timestamped, revocable consent for every sharing feature
- [x] Default-deny caregiver access with scopes, expiry, revocation and access logs
- [x] Role/scope-based access checks implemented as tested pure functions
- [x] Emergency profile visibility controls; verified-only blood type; opt-in organ donor
- [x] Immutable, hash-chained audit log with in-app verification
- [x] Data export (structured JSON + human summary) and true account deletion
- [x] No PHI in URLs, logs, notifications or errors; no analytics; no adtech; no data sale
- [x] Input validation and safe soft-delete semantics
- [ ] Strict Content-Security-Policy on the deployed host (see `docs/DEPLOYMENT.md`)
- [ ] Independent penetration test
- [ ] Server-side enforcement of caregiver scopes (required before any sync ships)
- [ ] QR/share-link rotation + rate limiting (specified, not implemented)

## 6. If something goes wrong

- **Suspect the device is compromised:** lock the app, change the master password on a trusted device after exporting data, and revoke all caregiver grants. Because there is no server, there is no credential to reset remotely — the vault's safety depends on the master password's strength.
- **Shared a QR/link by mistake:** revoke the share link in Emergency Mode → Share profile, and turn off the QR/share consents in Settings → Privacy & consent.
- **Caregiver access misused:** revoke immediately in Contacts & Caregivers and review the access log.
- **Suspicious audit gaps:** Settings → Security & sessions runs chain verification; a failed verification means the stored log was modified outside the app.
