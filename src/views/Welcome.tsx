// ─── Welcome, account creation & onboarding (design: welcome_onboarding,
//     account_creation_passkey_authentication, consent_privacy_setup,
//     emergency_profile_setup) ─────────────────────────────────────────────────
// Clear separation: this is an ORGANIZATION tool, not a medical advisor.
// Demo data is always labeled; onboarding consent is explicit and revocable.

import { useMemo, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Button, Callout, Field, Ico, Input, PasswordField, StepProgress, Toggle } from '@/components/ui'
import { CONSENT_CATALOG, type ConsentType } from '@/domain/consent'
import { EmergencySetup } from './EmergencySetup'

/* ── Welcome (blank shell: no header, no tabs) ───────────────────────────── */

const FEATURES = [
  {
    icon: 'e911_emergency',
    box: 'bg-error-container/40 text-error',
    fill: true,
    title: 'One-Tap Emergency Access',
    body: 'Instant, offline-readable critical vitals and responder card with embedded QR and NFC integration.',
    meta: [
      { icon: 'nfc', label: 'Contactless NFC' },
      { icon: 'qr_code_2', label: 'Instant QR' },
    ],
  },
  {
    icon: 'enhanced_encryption',
    box: 'bg-secondary-container/40 text-secondary',
    fill: true,
    title: 'Zero-Knowledge Security',
    body: 'Hardware-backed encryption keeps lab panels, clinical notes and meds exclusively in your custody.',
    meta: [{ icon: 'key', label: 'Client-side passkey authorization' }],
  },
  {
    icon: 'clinical_notes',
    box: 'bg-surface-container-high text-on-surface',
    fill: false,
    title: 'Clinical Visit Companion',
    body: 'Automated pre-visit agendas, post-consult care plans, and revocable caregiver permissions.',
    meta: [{ icon: 'group', label: 'Granular family & caregiver delegation' }],
  },
]

export function Welcome() {
  const setScreen = useHealth((s) => s.setScreen)
  const boot = useHealth((s) => s.boot)
  const [whitepaper, setWhitepaper] = useState(false)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col px-space-gutter pb-8 pt-safe">
      <div className="flex w-full flex-col pb-8">
        {/* Status row */}
        <div className="mb-space-sm flex items-center justify-between py-space-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container/30 px-3 py-1 text-on-secondary-container">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-secondary" />
            <span className="text-label-sm font-semibold uppercase tracking-wide">Privacy Enclave Active</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-label-md text-on-surface-variant">
            <Ico name="language" size={18} />
            <span>EN</span>
          </span>
        </div>

        {/* Hero */}
        <div className="mb-space-lg mt-2 flex flex-col items-center text-center">
          <div className="relative mb-space-md flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-secondary-container/40 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-lowest text-secondary shadow-md">
              <Ico name="shield_with_heart" fill size={36} />
            </div>
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-container text-on-primary shadow-sm">
              <Ico name="lock" size={16} />
            </div>
          </div>
          <h1 className="text-headline-lg tracking-tight text-on-surface">Personal Health OS</h1>
          <p className="mt-space-xs max-w-xs leading-relaxed text-body-md text-on-surface-variant">
            Your lifelong, privacy-first health memory &amp; emergency readiness system.
          </p>
          <div className="mt-space-md flex flex-wrap items-center justify-center gap-1.5">
            {[
              { icon: 'verified_user', label: 'WCAG 2.2 AA' },
              { icon: 'contrast', label: 'High Contrast' },
              { icon: 'cloud_off', label: 'Offline Ready' },
            ].map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1 text-label-sm text-on-surface-variant">
                <Ico name={c.icon} size={14} className="text-secondary" />
                {c.label}
              </span>
            ))}
          </div>
        </div>

        {/* Feature cards */}
        <div className="mb-space-lg flex flex-col gap-space-md">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${f.box}`}>
                <Ico name={f.icon} size={24} fill={f.fill} />
              </div>
              <div className="flex min-w-0 flex-col">
                <h2 className="text-headline-sm text-on-surface">{f.title}</h2>
                <p className="mt-1 leading-relaxed text-body-sm text-on-surface-variant">{f.body}</p>
                <div className="mt-2 flex items-center gap-2">
                  {f.meta.map((m, i) => (
                    <span key={m.label} className="flex items-center text-label-sm font-medium text-secondary">
                      {i > 0 && <span className="mr-2 text-outline-variant">•</span>}
                      <Ico name={m.icon} size={14} />
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clinical & legal notice */}
        <div className="mb-space-lg rounded-xl bg-surface-container-low p-space-md shadow-sm">
          <div className="flex items-start gap-2.5">
            <Ico name="info" size={20} className="mt-0.5 shrink-0 text-outline" />
            <div className="flex min-w-0 flex-col">
              <span className="text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">Clinical &amp; Legal Notice</span>
              <p className="mt-1 leading-relaxed text-body-sm text-on-surface-variant">
                Personal Health OS organizes personal health information and supports emergency preparedness.
                It does not replace licensed medical professionals, provide medical advice, or diagnose clinical
                conditions.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2.5">
          <button
            onClick={() => setScreen('create-account')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container px-space-md py-3.5 text-headline-sm text-on-primary shadow-md transition-all active:scale-[0.99]"
          >
            <span>Get Started with Secure Setup</span>
            <Ico name="arrow_forward" size={20} />
          </button>
          <button
            onClick={() => void boot()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container px-space-md py-3 text-headline-sm text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <Ico name="passkey" size={20} />
            <span>Restore Existing Vault / Passkey</span>
          </button>
          <div className="pt-2 text-center">
            <button
              onClick={() => setWhitepaper(true)}
              className="inline-flex items-center gap-1 text-label-sm text-secondary underline underline-offset-4 transition-colors hover:text-on-secondary-fixed-variant"
            >
              <Ico name="policy" size={14} />
              <span>View Privacy &amp; Security Whitepaper</span>
            </button>
          </div>
        </div>
      </div>

      {whitepaper && <Whitepaper onClose={() => setWhitepaper(false)} />}
    </div>
  )
}

function Whitepaper({ onClose }: { onClose: () => void }) {
  const points: Array<[string, string]> = [
    ['enhanced_encryption', 'Everything is encrypted on this device with AES-GCM-256 keys derived from your password (PBKDF2-SHA256, 310,000 rounds). We never receive your data, because there is no server.'],
    ['cloud_off', 'No network calls, no analytics, no trackers, no third-party scripts. Fonts and icons are served from this device.'],
    ['delete_forever', 'Deleting your account destroys the encryption keys and erases every record, share link and cached emergency preview.'],
    ['history', 'Every read of emergency data, every export and every permission change is written to a tamper-evident audit log you can verify yourself.'],
    ['policy', 'Emergency Mode only ever shows the fields you explicitly approved — everything else stays encrypted, even on the lock screen.'],
  ]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Privacy & Security Whitepaper"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[440px] overflow-auto rounded-t-2xl bg-surface-container-lowest p-6 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between border-b border-surface-container pb-3">
          <h2 className="text-headline-md text-on-surface">Privacy &amp; Security Whitepaper</h2>
          <button onClick={onClose} aria-label="Close dialog" className="grid h-10 w-10 place-items-center rounded-full text-outline hover:bg-surface-container">
            <Ico name="close" />
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {points.map(([icon, text]) => (
            <div key={icon} className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary-container/40 text-secondary">
                <Ico name={icon} size={18} />
              </span>
              <p className="text-body-md leading-relaxed text-on-surface-variant">{text}</p>
            </div>
          ))}
        </div>
        <Button className="mt-5 w-full" size="lg" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}

/* ── Account creation (Step 1 of 3) ─────────────────────────────────────── */

export function CreateAccount() {
  const { createAccount, setupPasskey, error, busy } = useHealth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [demo, setDemo] = useState(true)
  const [agree, setAgree] = useState(false)
  const [wantPasskey, setWantPasskey] = useState(false)

  const strength = useMemo(() => {
    let s = 0
    if (password.length >= 8) s++
    if (password.length >= 12) s++
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) s++
    return s
  }, [password])
  const strengthLabel = ['Too short', 'Weak', 'Okay', 'Good', 'Strong'][strength] ?? 'Too short'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agree) return
    await createAccount(name.trim(), email.trim(), password, demo)
    if (wantPasskey) {
      try { await setupPasskey() } catch { /* user can enrol later in Settings → Security */ }
    }
  }

  return (
    <div className="flex w-full flex-col pb-8">
      <StepProgress step={1} of={3} label="Secure Identity" pct={33.33} />

      <section className="mb-space-lg flex flex-col gap-1">
        <h1 className="text-headline-lg tracking-tight text-on-surface">Create Your Health Vault</h1>
        <p className="text-body-md text-on-surface-variant">
          Protected by modern cryptographic passkeys. No passwords to leak, compromise, or forget.
        </p>
      </section>

      <form className="flex flex-col gap-space-md" onSubmit={submit}>
        <Field label="Full Legal Name" required>
          <div className="relative flex items-center">
            <Ico name="badge" size={20} className="pointer-events-none absolute left-3.5 text-on-surface-variant" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="e.g. Maria Santos"
              className="pl-11"
            />
          </div>
          <span className="mt-1 flex items-center gap-1 pl-1 text-body-sm text-on-surface-variant">
            <Ico name="info" size={14} />
            Used on clinical summaries and the certified emergency profile
          </span>
        </Field>

        <Field label="Email" required>
          <div className="relative flex items-center">
            <Ico name="mail" size={20} className="pointer-events-none absolute left-3.5 text-on-surface-variant" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="pl-11"
            />
          </div>
          <span className="mt-1 block pl-1 text-body-sm text-on-surface-variant">
            Stored only inside your encrypted vault — never sent anywhere
          </span>
        </Field>

        <PasswordField
          label="Master Password"
          value={password}
          onChange={setPassword}
          hint="The only way to unlock your vault. Never stored or transmitted. Minimum 8 characters; 12+ recommended."
          autoComplete="new-password"
        />
        {password && (
          <div className="-mt-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className={`h-full rounded-full transition-all ${['w-0', 'w-1/4 bg-error', 'w-2/4 bg-warn-600', 'w-3/4 bg-secondary', 'w-full bg-secondary'][strength]}`} />
            </div>
            <p className="mt-1 flex items-center gap-1 text-body-sm text-on-surface-variant">
              Password strength: {strengthLabel}
            </p>
          </div>
        )}

        {/* Passkey delight card */}
        <div className="relative mt-space-sm flex flex-col gap-space-md overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-secondary-container/40 blur-2xl" />
          <div className="relative z-10 flex items-start gap-space-sm">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary-container/30 text-secondary">
              <Ico name="fingerprint" fill size={28} />
            </div>
            <div className="flex min-w-0 flex-col">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-headline-sm text-on-surface">Biometric Passkey</span>
                <span className="rounded-full bg-secondary-container px-2 py-0.5 text-label-sm font-semibold text-on-secondary-container">FIDO2</span>
              </div>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                Register this device&apos;s Face ID, Touch ID, or hardware token for instant zero-knowledge decryption.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWantPasskey((v) => !v)}
            aria-pressed={wantPasskey}
            className={`relative z-10 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-label-md shadow-sm transition-all active:scale-[0.98] ${
              wantPasskey ? 'bg-secondary-container text-on-secondary-container' : 'bg-secondary text-on-secondary'
            }`}
          >
            <Ico name={wantPasskey ? 'task_alt' : 'passkey'} size={20} />
            <span>{wantPasskey ? 'Passkey will be registered after your vault is created' : 'Set Up Passkey Now'}</span>
          </button>
        </div>

        <Toggle
          checked={demo}
          onChange={setDemo}
          label="Explore with sample data (recommended first)"
          hint="Fills the app with clearly-labeled example information for Maria Santos so you can see how everything works."
        />

        {/* Clinical boundary acknowledgement */}
        <div className="rounded-xl bg-surface-container-lowest p-4 shadow-sm">
          <label className="flex cursor-pointer select-none items-start gap-3.5">
            <input
              type="checkbox"
              required
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="sr-only peer"
            />
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded bg-surface-container-high text-transparent transition-all peer-checked:bg-secondary peer-checked:text-on-secondary peer-focus:outline-none">
              <Ico name="check" fill size={18} />
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-label-md font-medium text-on-surface">Clinical Boundary Acknowledgement</span>
              <p className="text-body-sm text-on-surface-variant">
                I understand that Personal Health OS is a personal health organizer and emergency readiness
                tool, not a diagnostic medical device or substitute for licensed medical practitioners.
              </p>
            </span>
          </label>
        </div>

        {error && <Callout tone="danger" title="Something went wrong">{error}</Callout>}
        {busy && (
          <p className="flex items-center gap-2 text-body-md text-on-surface-variant" role="status">
            <Ico name="progress_activity" size={16} className="animate-spin" />
            {busy}
          </p>
        )}

        <div className="flex flex-col gap-space-sm pt-space-xs">
          <button
            type="submit"
            disabled={!name || !email || password.length < 8 || !agree}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-label-md font-medium text-on-primary shadow-md transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            <span>Continue to Privacy &amp; Consent Setup</span>
            <Ico name="arrow_forward" size={20} />
          </button>
        </div>
      </form>
    </div>
  )
}

/* ── Privacy & consent (Step 2 of 3) ────────────────────────────────────── */

interface ConsentCard {
  type: ConsentType
  icon: string
  fill?: boolean
  chip: string
  chipTone?: 'good' | 'neutral'
  sub: string
  subTone?: 'accent' | 'muted'
}

const CONSENT_CARDS: ConsentCard[] = [
  {
    type: 'emergency-visible-when-locked',
    icon: 'e911_emergency',
    fill: true,
    chip: 'Essential Safety',
    chipTone: 'good',
    sub: 'Critical offline first-responder access',
    subTone: 'accent',
  },
  {
    type: 'alerts-to-caregivers',
    icon: 'group',
    chip: 'Zero-Default Access',
    sub: 'Explicit cryptographic invitation',
    subTone: 'muted',
  },
  {
    type: 'ocr-processing',
    icon: 'neurology',
    fill: true,
    chip: 'Local NLP Enclave',
    chipTone: 'good',
    sub: 'Lab OCR & consultation summaries',
    subTone: 'accent',
  },
  {
    type: 'reminder-notifications',
    icon: 'notifications',
    chip: 'On-Device Reminders',
    sub: 'Doses, refills & appointments',
    subTone: 'muted',
  },
  {
    type: 'share-link-enabled',
    icon: 'link',
    chip: 'View-Only Links',
    sub: 'Revoke at any time',
    subTone: 'muted',
  },
  {
    type: 'qr-enabled',
    icon: 'qr_code_2',
    chip: 'Scannable Card',
    sub: 'Approved fields only',
    subTone: 'muted',
  },
]

export function OnboardingConsent() {
  const { setConsent, setScreen, entities } = useHealth()
  const granted = (type: string) => entities.consents.find((c) => c.type === type)?.granted ?? false

  return (
    <div className="flex w-full flex-col pb-10">
      <StepProgress step={2} of={3} label="Privacy & Data Sovereignty" pct={66.66} />

      <div className="mb-5 flex flex-col gap-space-xs">
        <h1 className="text-headline-lg text-on-surface">Privacy &amp; Consent Architecture</h1>
        <p className="text-body-md text-on-surface-variant">
          Personal Health OS adheres to zero-knowledge cryptography and explicit patient consent protocols.
          Configure your personal data protection boundary.
        </p>
      </div>

      {/* Trust badges */}
      <div className="-mx-space-gutter mb-6 flex gap-2 overflow-x-auto px-space-gutter pb-2 no-scrollbar">
        {[
          { icon: 'verified_user', label: 'HIPAA & GDPR minded' },
          { icon: 'do_not_disturb_on', label: 'Zero Data Tracking' },
          { icon: 'enhanced_encryption', label: 'Client-Side Enclave' },
        ].map((b) => (
          <span key={b.label} className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface-container-low px-3 py-1.5 shadow-sm">
            <Ico name={b.icon} size={16} fill className="text-secondary" />
            <span className="text-label-sm text-on-surface">{b.label}</span>
          </span>
        ))}
      </div>

      {/* Granular consent protocol */}
      <div className="mb-6 flex flex-col gap-3.5">
        <span className="text-label-md font-medium uppercase tracking-wide text-on-surface">Granular Consent Protocol</span>
        {CONSENT_CARDS.map((card) => {
          const def = CONSENT_CATALOG.find((c) => c.type === card.type)
          if (!def) return null
          return (
            <div key={card.type} className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      card.chipTone === 'good' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <Ico name={card.icon} size={20} fill={card.fill} />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-headline-sm text-on-surface">{def.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-label-sm ${
                          card.chipTone === 'good' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {card.chip}
                      </span>
                    </div>
                    <span className={`text-label-sm font-medium ${card.subTone === 'accent' ? 'text-secondary' : 'text-on-surface-variant'}`}>
                      {card.sub}
                    </span>
                  </div>
                </div>
                <button
                  role="switch"
                  aria-checked={granted(card.type)}
                  aria-label={def.title}
                  onClick={() => void setConsent(card.type, !granted(card.type))}
                  className={`relative flex h-7 w-12 shrink-0 items-center rounded-full px-1 transition-colors ${
                    granted(card.type) ? 'bg-secondary' : 'bg-surface-container-high'
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full shadow-md transition-transform ${
                      granted(card.type) ? 'translate-x-5 bg-on-secondary' : 'translate-x-0 bg-surface-container-lowest'
                    }`}
                  />
                </button>
              </div>
              <p className="text-body-sm leading-relaxed text-on-surface-variant">{def.summary}</p>
            </div>
          )
        })}
      </div>

      {/* Data sovereignty guarantee */}
      <div className="mb-6 flex flex-col gap-3.5 rounded-xl bg-surface-container-low p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Ico name="policy" size={22} className="text-secondary" />
          <span className="text-headline-sm text-on-surface">Data Sovereignty Guarantee</span>
        </div>
        <div className="flex flex-col gap-2.5">
          {[
            { icon: 'delete_forever', title: 'Instant Cryptographic Shredding', body: 'Delete your account anytime; private encryption keys are instantly purged from the device keychain.' },
            { icon: 'download', title: '100% Comprehensive Export', body: 'Export every record, consent and audit entry as readable JSON you keep and carry.' },
            { icon: 'volunteer_activism', title: 'Zero Monetization Covenant', body: 'No tracking pixels, no third-party data broker pipelines, no advertiser integrations — ever.' },
          ].map((r) => (
            <div key={r.title} className="flex items-start gap-2.5">
              <Ico name={r.icon} size={18} className="mt-0.5 shrink-0 text-secondary" />
              <div className="flex flex-col">
                <span className="text-label-md text-on-surface">{r.title}</span>
                <span className="text-body-sm text-on-surface-variant">{r.body}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mb-6 flex items-start gap-2 text-body-sm text-on-surface-variant">
        <Ico name="lock_person" size={16} className="mt-0.5 shrink-0 text-secondary" />
        <span>
          {entities.consents.length} consent record{entities.consents.length === 1 ? '' : 's'} stored so far. Every
          decision is auditable and revocable later in Settings → Privacy.
        </span>
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => setScreen('onboarding-emergency')}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary-container text-label-md font-medium text-on-primary shadow-md transition-all active:scale-[0.98]"
        >
          <span>Confirm &amp; Continue to Emergency Setup</span>
          <Ico name="arrow_forward" size={18} />
        </button>
        <button
          onClick={() => setScreen('dashboard')}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-surface-container text-label-md text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <Ico name="dashboard" size={18} />
          <span>Go straight to my dashboard</span>
        </button>
      </div>
    </div>
  )
}

/* ── Emergency profile (Step 3 of 3) ────────────────────────────────────── */

export function OnboardingEmergencySetup() {
  return <EmergencySetup mode="onboarding" />
}
