// ─── Emergency Contacts & Caregivers ─────────────────────────────────────────
// Nobody has access by default. Every grant is explicit, scoped, expiring,
// revocable, and logged. Access checks are pure functions (domain/permissions).

import { useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Badge, Button, Callout, Card, EmptyState, Field, Input, Modal, SectionTitle, Select, Toggle } from '@/components/ui'
import type { CaregiverGrant, CaregiverScope, EmergencyContact } from '@/types'
import { CAREGIVER_SCOPE_LABELS } from '@/types'
import { acceptanceMatches, describeGrantAccess, grantStatus, markAccepted, normalizeScopes, revokeGrant } from '@/domain/permissions'
import { sha256Hex } from '@/lib/crypto'
import { fmtDate, nowIso, uid } from '@/lib/util'

function makeAcceptanceCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alike characters
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

const SCOPES = Object.keys(CAREGIVER_SCOPE_LABELS) as CaregiverScope[]

export function Contacts() {
  const { entities, upsert, softDelete, demoMode } = useHealth()
  const [editing, setEditing] = useState<EmergencyContact | null>(null)
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState<EmergencyContact | null>(null)

  const contacts = entities.emergencyContacts.filter((c) => !c.deletedAt).sort((a, b) => a.priority - b.priority)

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle sub="People to call in an emergency, and (only if you choose) people who can see selected information.">
          👨‍👩‍👧 Contacts & Caregivers
        </SectionTitle>
        <Button size="lg" onClick={() => setCreating(true)}>+ Add person</Button>
      </div>

      {demoMode && <p className="text-xs text-ink-400">Sample data shown.</p>}

      <Callout tone="info" title="Default: nobody can see anything">
        Being an emergency contact means we list a person to call. Seeing information requires a separate, explicit,
        expiring grant that you can revoke instantly.
      </Callout>

      {contacts.length === 0 ? (
        <EmptyState icon="👥" title="No contacts yet" body="Add the people who should be called in an emergency, and anyone who helps with your care." action={<Button onClick={() => setCreating(true)}>+ Add person</Button>} />
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => {
            const grant = entities.caregiverGrants.find((g) => g.contactId === c.id && !g.deletedAt)
            const status = grant ? grantStatus(grant) : null
            return (
              <li key={c.id}>
                <Card className="!p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold">{c.name}</p>
                        <Badge>{c.relationship}</Badge>
                        {c.isEmergencyContact && <Badge tone="danger">emergency contact #{c.priority}</Badge>}
                        {status === 'active' && <Badge tone="good">caregiver access active</Badge>}
                        {status === 'invited' && <Badge tone="warn">invitation pending</Badge>}
                        {status === 'expired' && <Badge>access expired</Badge>}
                        {status === 'revoked' && <Badge>access revoked</Badge>}
                      </div>
                      <p className="mt-1 text-sm">
                        📞 <a className="font-semibold text-teal-700 underline dark:text-teal-300" href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}>{c.phone}</a>
                        {c.email && ` · ✉️ ${c.email}`}
                        {` · prefers ${c.preferredMethod}`}
                      </p>
                      {grant && (
                        <div className="mt-2 rounded-xl bg-ink-50 p-2 text-sm dark:bg-ink-800">
                          <p>{describeGrantAccess(grant)}</p>
                          {grant.expiresAt && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Expires {fmtDate(grant.expiresAt)}</p>}
                          {grant.status === 'invited' && grant.acceptanceCode && (
                            <div className="mt-2 rounded-lg border border-warn-100 bg-warn-50 p-2 text-xs text-warn-900 dark:bg-warn-900/40 dark:text-warn-100">
                              <p className="font-bold">Share this one-time code with {c.name}</p>
                              <p className="mt-0.5 font-mono text-base tracking-widest">{grant.acceptanceCode}</p>
                              <p className="mt-1">They enter it on their own device to accept. Nothing is visible to them until then.</p>
                              <AcceptInvite grant={grant} onVerified={() => void upsert('caregiverGrants', markAccepted(grant))} />
                            </div>
                          )}
                          {grant.accessLog.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs font-semibold">Access log ({grant.accessLog.length})</summary>
                              <ul className="mt-1 space-y-0.5 text-xs text-ink-500">
                                {grant.accessLog.map((l, i) => <li key={i}>{fmtDate(l.at)} — {l.action}</li>)}
                              </ul>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>Edit</Button>
                        <Button variant="ghost" size="sm" onClick={() => void softDelete('emergencyContacts', c.id)}>Delete</Button>
                      </div>
                      <div className="flex gap-1">
                        {(!grant || (status !== 'active' && status !== 'invited')) && (
                          <Button size="sm" onClick={() => setInviting(c)}>Grant access…</Button>
                        )}
                        {status === 'invited' && <Badge tone="warn">awaiting acceptance</Badge>}
                        {status === 'active' && (
                          <Button
                            size="sm" variant="danger"
                            onClick={() => {
                              const g = entities.caregiverGrants.find((x) => x.contactId === c.id)!
                              void upsert('caregiverGrants', revokeGrant(g))
                            }}
                          >
                            Revoke now
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <ContactModal
        open={creating || !!editing}
        initial={editing ?? undefined}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSave={(c) => { void upsert('emergencyContacts', c); setCreating(false); setEditing(null) }}
      />

      <InviteModal
        contact={inviting}
        onClose={() => setInviting(null)}
        onInvite={async (contactId, scopes, expiresAt) => {
          const now = nowIso()
          const code = makeAcceptanceCode()
          void upsert('caregiverGrants', {
            id: uid('grant'), userId: entities.users[0]?.id ?? 'self', contactId,
            scopes: normalizeScopes(scopes), status: 'invited', invitedAt: now, expiresAt,
            acceptanceCode: code,
            acceptanceCodeHash: await sha256Hex(`ph-os-invite:${code}`),
            accessLog: [{ at: now, action: 'Invitation created with scopes: ' + scopes.join(', ') }],
            createdAt: now, updatedAt: now,
          })
          setInviting(null)
        }}
      />
    </div>
  )
}

function ContactModal({ open, initial, onClose, onSave }: { open: boolean; initial?: EmergencyContact; onClose: () => void; onSave: (c: EmergencyContact) => void }) {
  const { entities } = useHealth()
  const [c, setC] = useState<Partial<EmergencyContact>>(initial ?? {})
  const set = (patch: Partial<EmergencyContact>) => setC((s) => ({ ...s, ...patch }))
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit person' : 'Add person'} wide>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          const now = nowIso()
          onSave({
            id: initial?.id ?? uid('ec'), userId: initial?.userId ?? entities.users[0]?.id ?? 'self',
            name: c.name?.trim() ?? '', relationship: c.relationship?.trim() ?? '',
            phone: c.phone?.trim() ?? '', email: c.email || undefined,
            preferredMethod: c.preferredMethod ?? 'phone', priority: c.priority ?? 3,
            isEmergencyContact: c.isEmergencyContact ?? true, notes: c.notes || undefined,
            createdAt: initial?.createdAt ?? now, updatedAt: now,
          })
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required><Input value={c.name ?? ''} onChange={(e) => set({ name: e.target.value })} required /></Field>
          <Field label="Relationship" required><Input value={c.relationship ?? ''} onChange={(e) => set({ relationship: e.target.value })} required placeholder="Daughter, neighbor, caregiver…" /></Field>
          <Field label="Phone" required><Input value={c.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} required type="tel" /></Field>
          <Field label="Email"><Input type="email" value={c.email ?? ''} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="Preferred contact method">
            <Select value={c.preferredMethod ?? 'phone'} onChange={(e) => set({ preferredMethod: e.target.value as EmergencyContact['preferredMethod'] })}>
              {['phone', 'sms', 'email', 'any'].map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="Emergency priority" hint="1 = called first">
            <Select value={String(c.priority ?? 3)} onChange={(e) => set({ priority: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
        </div>
        <Toggle checked={c.isEmergencyContact ?? true} onChange={(v) => set({ isEmergencyContact: v })} label="List on emergency profile" hint="Shown to responders (only if the emergency profile includes contacts)." />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save person</Button>
        </div>
      </form>
    </Modal>
  )
}

function AcceptInvite({ grant, onVerified }: { grant: CaregiverGrant; onVerified: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      className="mt-2 flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const hash = await sha256Hex(`ph-os-invite:${code.trim().toUpperCase()}`)
        if (acceptanceMatches(grant, hash)) {
          setError('')
          onVerified()
        } else {
          setError('That code does not match. Check it with the person who invited you.')
        }
      }}
    >
      <label className="flex-1 text-xs font-semibold">
        Their acceptance code
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABC123"
          className="mt-1 font-mono tracking-widest"
          aria-label="Acceptance code"
        />
      </label>
      <Button type="submit" size="sm" disabled={code.trim().length < 4}>Accept invitation</Button>
      {error && <p role="alert" className="w-full text-xs font-semibold text-danger-700">{error}</p>}
    </form>
  )
}

function InviteModal({ contact, onClose, onInvite }: { contact: EmergencyContact | null; onClose: () => void; onInvite: (contactId: string, scopes: CaregiverScope[], expiresAt?: string) => void | Promise<void> }) {
  const [scopes, setScopes] = useState<CaregiverScope[]>(['emergency-contact-only'])
  const [expires, setExpires] = useState('')
  const [confirm, setConfirm] = useState(false)
  if (!contact) return null

  return (
    <Modal open onClose={onClose} title={`Grant access to ${contact.name}`} wide>
      {!confirm ? (
        <div className="space-y-3">
          <Callout tone="warn" title="Before you continue">
            {contact.name} will be invited to create their own account. Until they accept, they see nothing. You can
            revoke at any time and access expires automatically on the date you pick.
          </Callout>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">What may {contact.name} see or do?</legend>
            <div className="divide-y divide-ink-100 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-700">
              {SCOPES.map((s) => (
                <Toggle
                  key={s}
                  checked={scopes.includes(s)}
                  onChange={(v) => setScopes((cur) => {
                    if (!v) return cur.filter((x) => x !== s)
                    // "Emergency contact only" and real information access are
                    // mutually exclusive — picking one clears the other so the
                    // grant is never self-contradictory.
                    if (s === 'emergency-contact-only') return ['emergency-contact-only']
                    return [...cur.filter((x) => x !== 'emergency-contact-only'), s]
                  })}
                  label={CAREGIVER_SCOPE_LABELS[s]}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-500">“Help manage medications” automatically includes “View medications”. Full caregiver access includes view permissions.</p>
          </fieldset>
          <Field label="Access expires (recommended)" hint="Temporary access ends automatically on this date.">
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button disabled={scopes.length === 0} onClick={() => setConfirm(true)}>Review invitation</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <SectionTitle sub="Please read carefully — this is a high-impact action.">Confirm access grant</SectionTitle>
          <Card>
            <p><strong>{contact.name}</strong> ({contact.relationship}) will be able to:</p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {scopes.map((s) => <li key={s}>{CAREGIVER_SCOPE_LABELS[s]}</li>)}
            </ul>
            <p className="mt-2 text-sm text-ink-500">{expires ? `Access expires ${fmtDate(expires)}.` : 'No expiry set — consider adding one.'}</p>
          </Card>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>Back</Button>
            <Button
              onClick={() => {
                onInvite(contact.id, scopes, expires ? new Date(`${expires}T23:59:59`).toISOString() : undefined)
                onClose()
              }}
            >
              Send invitation
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
