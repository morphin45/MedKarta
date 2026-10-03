// ─── Emergency Mode ──────────────────────────────────────────────────────────
// High-contrast, stress-proof screen. Shows ONLY user-approved fields with
// verified/unverified separation, staleness warning, calling, sharing, QR and
// printable card. Reachable from lock screen, header, dashboard, mobile nav.

import { useMemo, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Callout, Card, Modal, VerifiedBadge } from '@/components/ui'
import { emergencyCardText } from '@/domain/emergency'
import { pseudoQrMatrix } from '@/lib/crypto'
import { ageFromDob, fmtDateTime, downloadFile } from '@/lib/util'
import type { ResolvedEmergencyProfile } from '@/types'

export function EmergencyMode() {
  const resolveEmergency = useHealth((s) => s.resolveEmergency)
  const phase = useHealth((s) => s.phase)
  const unlockFull = useHealth((s) => s.unlockWithPasskey)
  const setScreen = useHealth((s) => s.setScreen)
  const storedPreview = useHealth((s) => s.lockedPreview)
  const emergency = useHealth((s) => s.entities.emergencyProfiles[0])
  const unlocked = phase !== 'emergency-locked'
  // When locked we can only read the consent-gated cache — same approved fields.
  const profile = useMemo(
    () => (unlocked ? (resolveEmergency() ?? storedPreview) : storedPreview),
    [unlocked, resolveEmergency, storedPreview],
  )

  const [showShare, setShowShare] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [called, setCalled] = useState<string | null>(null)

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <Callout tone="warn" title="No emergency profile yet">
          Set up your emergency profile so this screen can help when it matters most.
        </Callout>
        <Button size="lg" onClick={() => setScreen('emergency-setup')}>Set up emergency profile</Button>
      </div>
    )
  }

  const hasContent =
    profile.allergies.length + profile.medications.length + profile.conditions.length + profile.contacts.length > 0

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">🆘 Emergency profile</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Last updated {fmtDateTime(emergency?.lastUpdatedAt ?? profile.generatedAt)} · shows only information approved for sharing
          </p>
        </div>
        {phase === 'emergency-locked' && (
          <Button variant="secondary" onClick={() => setScreen('welcome')}>Back to lock screen</Button>
        )}
      </div>

      {profile.stale && (
        <Callout tone="warn" title="This information may be outdated">
          The emergency profile was last updated more than 180 days ago. Please review it when you can.
        </Callout>
      )}

      {/* Primary actions — big, thumb-friendly, in priority order */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="danger" size="xl" className="text-xl"
          onClick={() => { setCalled('services'); window.location.href = 'tel:911' }}
        >
          📞 Call emergency services (911)
        </Button>
        {profile.contacts[0] ? (
          <Button
            variant="warning" size="xl" className="text-xl"
            onClick={() => { setCalled(profile.contacts[0]!.name); window.location.href = `tel:${profile.contacts[0]!.phone.replace(/[^\d+]/g, '')}` }}
          >
            📞 Call {profile.contacts[0]!.name} ({profile.contacts[0]!.relationship})
          </Button>
        ) : (
          <Button variant="secondary" size="xl" disabled>📞 No emergency contact added</Button>
        )}
      </div>

      {called && (
        <Callout tone="good" title={`Dialing ${called}…`}>
          If your device blocked the call, dial manually. If this is a medical emergency and you cannot call, ask someone nearby for help.
        </Callout>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="secondary" size="lg" onClick={() => window.print()}>🖨️ Print / save card</Button>
        <Button variant="secondary" size="lg" disabled={!unlocked} onClick={() => setShowShare(true)}>
          🔗 Share profile{!unlocked ? ' (unlock required)' : ''}
        </Button>
        <Button variant="secondary" size="lg" disabled={!unlocked} onClick={() => setShowQr(true)}>
          📷 Show QR code{!unlocked ? ' (unlock required)' : ''}
        </Button>
      </div>
      {!unlocked && (
        <Callout tone="info">
          Sharing and QR codes need the unlocked app so your consent settings can be checked. Printing and downloading
          the approved card works right now.
        </Callout>
      )}

      <Callout tone="info">
        This profile was created by the person from their own entries. It may be incomplete or out of date.
        {phase === 'emergency-locked' ? ' The full record is locked and stays private.' : ''}
      </Callout>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-extrabold">{profile.name || '(name hidden)'}</h2>
          {profile.preferredName && <span className="text-sm text-ink-500">Goes by “{profile.preferredName}”</span>}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-sm text-ink-600 dark:text-ink-300">
          {profile.dob && <span>DOB {profile.dob} (age {ageFromDob(profile.dob)})</span>}
          {profile.preferredLanguage && <span>· Language: {profile.preferredLanguage}</span>}
          {profile.bloodType ? (
            <span className="inline-flex items-center gap-1">· Blood type <strong>{profile.bloodType}</strong> <Badge tone="good">verified</Badge></span>
          ) : (
            <span className="text-ink-400">· Blood type not shown (not verified or not shared)</span>
          )}
          {profile.organDonorStatus === 'registered-donor' && <span>· Registered organ donor</span>}
        </div>
        {profile.accessibilityNeeds.length > 0 && (
          <p className="mt-2 text-sm"><strong>Accessibility:</strong> {profile.accessibilityNeeds.join(', ')}</p>
        )}

        {!hasContent && (
          <p className="mt-4 text-sm text-ink-500">No medical details have been approved for sharing yet.</p>
        )}

        {profile.allergies.length > 0 && (
          <Section title="Allergies" tone="high">
            {profile.allergies.map((a) => (
              <li key={a.substance} className="flex flex-wrap items-center gap-2">
                <strong>{a.substance}</strong>
                {a.reaction && <span>— {a.reaction}</span>}
                <VerifiedBadge verified={a.verified} label={a.verified ? 'Verified' : 'Unverified'} />
                <Badge tone={a.severity === 'severe' ? 'danger' : a.severity === 'unknown' ? 'neutral' : 'warn'}>{a.severity}</Badge>
              </li>
            ))}
          </Section>
        )}

        {profile.medications.length > 0 && (
          <Section title="Current medications">
            {profile.medications.map((m) => (
              <li key={m.name} className="flex flex-wrap items-center gap-2">
                <strong>{m.name}</strong> {m.dose}
                {m.instructions && <span className="text-ink-500">· {m.instructions}</span>}
                {m.confirmedByClinician ? <Badge tone="good">confirmed by clinician</Badge> : <Badge tone="warn">user-entered</Badge>}
              </li>
            ))}
          </Section>
        )}

        {profile.conditions.length > 0 && (
          <Section title="Medical conditions">
            {profile.conditions.map((c) => (
              <li key={c.name} className="flex flex-wrap items-center gap-2">
                <strong>{c.name}</strong> <span className="text-ink-500">({c.status})</span>
                {c.verified ? <Badge tone="good">verified</Badge> : <Badge tone="warn">user-entered</Badge>}
              </li>
            ))}
          </Section>
        )}

        {profile.devices.length > 0 && (
          <Section title="Implanted devices">
            {profile.devices.map((d) => <li key={d}>{d}</li>)}
          </Section>
        )}

        {profile.physicians.length > 0 && (
          <Section title="Physicians">
            {profile.physicians.map((d) => (
              <li key={d.name}>
                <strong>{d.name}</strong>{d.specialty ? `, ${d.specialty}` : ''}{d.phone ? ` — ${d.phone}` : ''}{d.isPrimary ? ' (primary)' : ''}
              </li>
            ))}
          </Section>
        )}

        {profile.contacts.length > 0 && (
          <Section title="Emergency contacts">
            {profile.contacts.map((c) => (
              <li key={c.phone} className="flex flex-wrap items-center gap-2">
                <strong>{c.name}</strong> ({c.relationship}) — <a className="font-semibold text-teal-700 underline dark:text-teal-300" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a>
              </li>
            ))}
          </Section>
        )}

        {profile.advanceDirectiveNote && (
          <Section title="Advance directive / preferences">
            <li>{profile.advanceDirectiveNote}</li>
          </Section>
        )}
        {profile.emergencyNotes && (
          <Section title="Notes">
            <li>{profile.emergencyNotes}</li>
          </Section>
        )}

        <p className="mt-4 text-xs text-ink-400">
          Included sections: {profile.includedSections.join(', ') || 'none'}. Generated {fmtDateTime(profile.generatedAt)}.
        </p>
      </Card>

      <div className="no-print flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => downloadFile('emergency-card.txt', emergencyCardText(profile), 'text/plain')}>
          ⬇️ Download as text
        </Button>
        {!unlocked && (
          <Button variant="ghost" onClick={() => void unlockFull().catch(() => undefined)}>Unlock full app with passkey</Button>
        )}
      </div>

      <ShareModal open={showShare} onClose={() => setShowShare(false)} profile={profile} />
      <QrModal open={showQr} onClose={() => setShowQr(false)} profile={profile} />
    </div>
  )
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'high' }) {
  return (
    <section className={`mt-4 ${tone === 'high' ? 'rounded-xl border-2 border-danger-600/40 bg-red-50/60 p-3 dark:bg-red-950/30' : ''}`}>
      <h3 className="mb-1 text-sm font-extrabold uppercase tracking-wide text-ink-600 dark:text-ink-300">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-[15px]">{children}</ul>
    </section>
  )
}

function ShareModal({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: ResolvedEmergencyProfile }) {
  const { createShareLink, revokeShareLink, shareLinks, entities } = useHealth()
  const linkEnabled = entities.consents.find((c) => c.type === 'share-link-enabled')?.granted ?? false
  const [copied, setCopied] = useState(false)

  const make = async () => {
    const link = await createShareLink()
    const url = `${window.location.origin}${window.location.pathname}#e=${link.token}`
    await navigator.clipboard?.writeText(url).catch(() => undefined)
    setCopied(true)
  }

  const active = shareLinks.filter((l) => !l.revoked)

  return (
    <Modal open={open} onClose={onClose} title="Share emergency profile" wide>
      {!linkEnabled ? (
        <Callout tone="warn" title="Sharing is turned off">
          Turn on “Allow creating shareable emergency links” in Settings → Privacy first. Nothing has been shared.
        </Callout>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">
            A link contains <strong>only the fields you approved</strong> for the emergency profile — nothing else.
            Anyone with the link can read it, so share carefully.
          </p>
          <Button size="lg" onClick={() => void make()}>Create link & copy</Button>
          {copied && <p role="status" className="text-sm text-teal-700 dark:text-teal-300">Link copied to clipboard (also listed below).</p>}
          <ul className="space-y-2">
            {active.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl border border-ink-200 p-2 text-sm dark:border-ink-700">
                <code className="truncate">{l.token}</code>
                <Button variant="ghost" size="sm" onClick={() => void revokeShareLink(l.id)}>Revoke</Button>
              </li>
            ))}
          </ul>
          {!active.length && <p className="text-sm text-ink-500">No active links.</p>}
          <details>
            <summary className="cursor-pointer text-sm font-semibold">Preview exactly what a link shows</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-xs dark:bg-ink-800">{emergencyCardText(profile)}</pre>
          </details>
        </div>
      )}
    </Modal>
  )
}

function QrModal({ open, onClose, profile }: { open: boolean; onClose: () => void; profile: ResolvedEmergencyProfile }) {
  const qrEnabled = useHealth((s) => s.entities.consents.find((c) => c.type === 'qr-enabled')?.granted) ?? false
  const matrix = useMemo(() => pseudoQrMatrix(JSON.stringify(profile)), [profile])
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title="Emergency QR code">
      {!qrEnabled ? (
        <Callout tone="warn" title="QR sharing is turned off">
          Enable “Allow emergency QR code” in Settings → Privacy. Until then, nothing scannable is produced.
        </Callout>
      ) : (
        <div className="space-y-3 text-center">
          <div className="mx-auto grid w-fit gap-0.5 rounded-xl bg-white p-3 shadow" style={{ gridTemplateColumns: `repeat(${matrix.length}, 1fr)` }} aria-label="Emergency profile QR code (visual representation)">
            {matrix.flatMap((row, y) => row.map((on, x) => (
              <span key={`${x}-${y}`} className={`h-2.5 w-2.5 ${on ? 'bg-ink-900' : 'bg-white'}`} />
            )))}
          </div>
          <p className="text-xs text-ink-500">
            Concept rendering for MVP — scanning displays your approved emergency fields. A production build would use a
            standard QR payload; NFC wristbands/bracelets can carry the same profile.
          </p>
        </div>
      )}
    </Modal>
  )
}
