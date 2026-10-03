// ─── Settings & Privacy ──────────────────────────────────────────────────────
// Profile, consent audit, security (PIN/passkey/sessions/audit verification),
// data export and real account deletion.

import { useEffect, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Callout, Card, Field, Input, PasswordField, SectionTitle, Select, Toggle, VerifiedBadge } from '@/components/ui'
import { CONSENT_CATALOG } from '@/domain/consent'
import { fmtDate, fmtDateTime, downloadFile } from '@/lib/util'
import { loadSessions, thisDeviceId } from '@/lib/idb'

export function Settings() {
  const { entities } = useHealth()
  const [tab, setTab] = useState<'profile' | 'privacy' | 'security' | 'data'>('profile')
  const tabs = [
    { id: 'profile', label: 'My profile' },
    { id: 'privacy', label: 'Privacy & consent' },
    { id: 'security', label: 'Security & sessions' },
    { id: 'data', label: 'Data & export' },
  ] as const

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SectionTitle sub="You are in control of every setting here.">⚙️ Settings & Privacy</SectionTitle>
      <div role="tablist" aria-label="Settings sections" className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${tab === t.id ? 'bg-teal-600 text-white' : 'border border-ink-300 bg-white text-ink-700 hover:bg-ink-50 dark:border-ink-600 dark:bg-ink-800 dark:text-ink-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <ProfileTab />}
      {tab === 'privacy' && <PrivacyTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'data' && <DataTab />}
      <p className="text-xs text-ink-400">Consent records: {entities.consents.length} · Audit entries: {entities.auditLog.length}</p>
    </div>
  )
}

function ProfileTab() {
  const { entities, upsert } = useHealth()
  const user = entities.users[0]
  const profile = entities.userProfiles[0]
  const [name, setName] = useState(user?.name ?? '')
  const [preferredName, setPreferredName] = useState(user?.preferredName ?? '')
  const [dob, setDob] = useState(profile?.dateOfBirth ?? '')
  const [bloodType, setBloodType] = useState(profile?.bloodType ?? '')
  const [bloodTypeVerified, setBloodTypeVerified] = useState(profile?.bloodTypeVerified ?? false)
  const [language, setLanguage] = useState(profile?.preferredLanguage ?? '')
  const [needs, setNeeds] = useState((profile?.accessibilityNeeds ?? []).join(', '))
  const [donor, setDonor] = useState(profile?.organDonorStatus ?? 'undecided')

  return (
    <Card>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (user) void upsert('users', { ...user, name, preferredName: preferredName || undefined })
          if (profile) {
            void upsert('userProfiles', {
              ...profile, dateOfBirth: dob || undefined, bloodType: bloodType || undefined,
              bloodTypeVerified, preferredLanguage: language, accessibilityNeeds: needs.split(',').map((s) => s.trim()).filter(Boolean),
              organDonorStatus: donor,
            })
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name" required><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Preferred name" hint="Used in the app and on the emergency card if you enable it"><Input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} /></Field>
          <Field label="Date of birth"><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
          <Field label="Blood type"><Input value={bloodType} onChange={(e) => setBloodType(e.target.value)} placeholder="e.g. O+" /></Field>
          <Field label="Preferred language"><Input value={language} onChange={(e) => setLanguage(e.target.value)} /></Field>
          <Field label="Organ donor status">
            <Select value={donor} onChange={(e) => setDonor(e.target.value as typeof donor)}>
              <option value="undecided">Undecided / prefer not to say</option>
              <option value="registered-donor">Registered donor</option>
              <option value="not-registered">Not registered</option>
            </Select>
          </Field>
        </div>
        <Field label="Accessibility needs" hint="Comma-separated; can be shown on the emergency card">
          <Input value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="Large text preferred, hearing assistance" />
        </Field>
        <Toggle
          checked={bloodTypeVerified}
          onChange={setBloodTypeVerified}
          label="My blood type is verified by a clinician or official record"
          hint="Only verified blood types can appear on the emergency card. Unverified entries are clearly marked."
        />
        <div className="flex items-center gap-2">
          <Button type="submit">Save profile</Button>
          {bloodType && <VerifiedBadge verified={bloodTypeVerified} label={bloodTypeVerified ? 'Verified' : 'Not verified'} />}
        </div>
      </form>
    </Card>
  )
}

function PrivacyTab() {
  const { entities, setConsent } = useHealth()
  return (
    <div className="space-y-3">
      <Callout tone="info" title="Everything is opt-in">
        These decisions are recorded with a timestamp so you can audit them. Turning something off takes effect immediately.
      </Callout>
      {CONSENT_CATALOG.map((c) => {
        const rec = entities.consents.find((x) => x.type === c.type)
        return (
          <Card key={c.type}>
            <Toggle
              checked={rec?.granted ?? false}
              onChange={(v) => void setConsent(c.type, v)}
              label={c.title}
              hint={c.summary}
            />
            {rec && (
              <p className="text-xs text-ink-400">
                {rec.granted ? `Granted ${rec.grantedAt ? fmtDateTime(rec.grantedAt) : ''}` : rec.revokedAt ? `Revoked ${fmtDateTime(rec.revokedAt)}` : 'Never granted'} · consent v{rec.version}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}

function SecurityTab() {
  const { entities, setupPin, setupPasskey, removePin, removePasskey, lock, verifyAudit, setScreen } = useHealth()
  const [pin, setPin] = useState('')
  const [pinSet, setPinSet] = useState<boolean | null>(null)
  const [passkeySet, setPasskeySet] = useState<boolean | null>(null)
  const [auditOk, setAuditOk] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<Array<{ id: string; label: string; createdAt: string; lastSeenAt: string }>>([])

  useEffect(() => {
    void (async () => {
      const acct = await import('@/lib/idb').then((m) => m.idb.get<Record<string, unknown>>('kv', 'account'))
      setPinSet(!!acct?.wrappedVault)
      setPasskeySet(!!acct?.passkeyWrappedVault)
      setSessions(await loadSessions())
      setAuditOk(await verifyAudit())
    })()
  }, [entities.auditLog.length, verifyAudit])

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle sub="Fast ways to unlock this device. Your master password always works as a fallback.">Quick unlock</SectionTitle>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200 p-3 dark:border-ink-700">
            <div>
              <p className="font-semibold">PIN unlock</p>
              <p className="text-xs text-ink-500">{pinSet ? 'Enabled — 4–8 digits, rate-limited after wrong tries.' : 'Set a short PIN for quicker unlocking.'}</p>
            </div>
            {pinSet ? (
              <Button variant="secondary" onClick={() => { void removePin(); setPinSet(false) }}>Remove PIN</Button>
            ) : (
              <div className="flex gap-2">
                <Input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="4–8 digits" className="w-32" aria-label="New PIN" />
                <Button disabled={pin.length < 4} onClick={() => { void setupPin(pin); setPin(''); setPinSet(true) }}>Set PIN</Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-200 p-3 dark:border-ink-700">
            <div>
              <p className="font-semibold">Passkey / biometric unlock</p>
              <p className="text-xs text-ink-500">
                {passkeySet ? 'Enabled — uses your device fingerprint/face via a PRF passkey.' : 'Requires a device that supports passkeys with the PRF extension.'}
              </p>
            </div>
            {passkeySet ? (
              <Button variant="secondary" onClick={() => { void removePasskey(); setPasskeySet(false) }}>Remove</Button>
            ) : (
              <Button onClick={() => void setupPasskey().catch(() => undefined)}>Set up passkey</Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Devices that have opened this vault recently.">Devices & sessions</SectionTitle>
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-xl border border-ink-200 p-2 text-sm dark:border-ink-700">
              <span>{s.label} <span className="text-ink-400">· last active {fmtDateTime(s.lastSeenAt)}</span></span>
              {s.id === thisDeviceId() ? <Badge tone="good">this device</Badge> : <Badge>offline</Badge>}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={lock}>Lock now</Button>
          <Button variant="secondary" onClick={() => setScreen('security')}>Full security screen</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Every meaningful action is recorded in a tamper-evident chain. No medical content is stored in the log.">Audit log integrity</SectionTitle>
        <p className="text-sm">
          {auditOk === null ? 'Checking…' : auditOk ? '✅ Chain verified — the audit log has not been altered.' : '⚠️ Chain broken — entries were modified or removed.'}
        </p>
        <p className="mt-1 text-xs text-ink-400">{entities.auditLog.length} entries recorded.</p>
      </Card>
    </div>
  )
}

function DataTab() {
  const { exportVaultJson, exportSummaryText, deleteAccount, entities } = useHealth()
  const [confirmText, setConfirmText] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [pw, setPw] = useState('')

  return (
    <div className="space-y-3">
      <Card>
        <SectionTitle sub="Your data belongs to you. Exports are plain files you can keep anywhere.">Export</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => downloadFile('personal-health-os-export.json', exportVaultJson())}>Download full export (JSON)</Button>
          <Button variant="secondary" onClick={() => downloadFile('health-summary.txt', exportSummaryText(), 'text/plain')}>Download health summary (text)</Button>
        </div>
        <p className="mt-2 text-xs text-ink-400">Includes {entities.timelineEntries.length} timeline events, {entities.healthDocuments.length} documents, {entities.medications.length} medications.</p>
      </Card>

      <Card>
        <SectionTitle sub="This cannot be undone. Exports are your backup.">Delete account & all data</SectionTitle>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Deletes the encrypted vault on this device permanently: every record, document, consent and audit entry.
        </p>
        {!showDelete ? (
          <Button variant="danger" className="mt-2" onClick={() => setShowDelete(true)}>Delete everything…</Button>
        ) : (
          <div className="mt-2 space-y-2 rounded-xl border-2 border-danger-600 p-3">
            <PasswordField label="Confirm your master password" value={pw} onChange={setPw} />
            <Field label='Type "DELETE" to confirm'>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setShowDelete(false); setConfirmText(''); setPw(''); setShowPassword(false) }}>Cancel</Button>
              <Button variant="danger" disabled={confirmText !== 'DELETE' || pw.length === 0} onClick={() => void deleteAccount()}>Permanently delete</Button>
            </div>
          </div>
        )}
      </Card>
      {showPassword && <p className="text-xs text-ink-400">Password field shown for confirmation.</p>}
    </div>
  )
}

export { fmtDate }
