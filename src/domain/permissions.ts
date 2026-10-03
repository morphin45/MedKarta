// ─── Caregiver permission model ──────────────────────────────────────────────
// Default = no access. A grant does nothing until accepted, expires on its
// expiry date, and can be revoked instantly. Scope checks are pure functions
// so the access decision is testable and auditable.

import type { CaregiverGrant, CaregiverScope, EmergencyContact } from '@/types'
import { nowIso } from '@/lib/util'

export const SCOPE_DEPENDENCIES: Partial<Record<CaregiverScope, CaregiverScope[]>> = {
  'help-manage-medications': ['view-medications'],
  'full-caregiver': ['view-medications', 'view-appointments', 'view-emergency-profile', 'view-selected-records'],
}

export function normalizeScopes(scopes: CaregiverScope[]): CaregiverScope[] {
  const set = new Set(scopes)
  for (const s of scopes) for (const dep of SCOPE_DEPENDENCIES[s] ?? []) set.add(dep)
  // "Emergency contact only" is mutually exclusive with real information
  // access. Keeping both would make the grant self-contradictory (and its
  // plain-language description wrong), so real access wins and the person is
  // still listed as an emergency contact via the contact record itself.
  const hasInfoAccess = [...set].some((s) => s !== 'emergency-contact-only')
  if (hasInfoAccess) set.delete('emergency-contact-only')
  return [...set]
}

export function grantStatus(g: CaregiverGrant, now = new Date()): CaregiverGrant['status'] {
  if (g.status === 'revoked') return 'revoked'
  if (g.status === 'expired') return 'expired'
  if (g.expiresAt && new Date(g.expiresAt).getTime() < now.getTime()) return 'expired'
  if (g.status === 'invited') return 'invited'
  return 'active'
}

export function grantHasAccess(g: CaregiverGrant, now = new Date()): boolean {
  return grantStatus(g, now) === 'active'
}

export function grantAllows(g: CaregiverGrant, scope: CaregiverScope, now = new Date()): boolean {
  return grantHasAccess(g, now) && g.scopes.includes(scope)
}

export function activeGrantForContact(grants: CaregiverGrant[], contactId: string): CaregiverGrant | undefined {
  return grants.find((g) => g.contactId === contactId && grantHasAccess(g))
}

export function describeGrantAccess(g: CaregiverGrant): string {
  const s = new Set(g.scopes)
  if (s.has('full-caregiver')) return 'Full caregiver access — can view emergency profile, medications, appointments and shared records, and help manage medications.'
  const infoScopes = [...s].filter((x) => x !== 'emergency-contact-only')
  if (infoScopes.length === 0) return 'Emergency contact only — no information access; listed for calling during emergencies.'
  const parts: string[] = []
  if (s.has('receive-selected-alerts')) parts.push('receives selected alerts')
  if (s.has('view-emergency-profile')) parts.push('can view the emergency profile')
  if (s.has('view-medications')) parts.push('can view medications')
  if (s.has('view-appointments')) parts.push('can view appointments')
  if (s.has('view-selected-records')) parts.push('can view shared records')
  if (s.has('help-manage-medications')) parts.push('can help manage medications')
  return parts.length ? `This person ${parts.join(', ')}.` : 'No access granted.'
}

/** The invited person can only activate a grant by entering the shared code. */
export function acceptanceMatches(g: CaregiverGrant, enteredCodeHash: string): boolean {
  return !!g.acceptanceCodeHash && enteredCodeHash.trim().length > 0 && g.acceptanceCodeHash === enteredCodeHash
}

/** One-time use: accepting clears the code so it cannot be replayed. */
export function markAccepted(g: CaregiverGrant, now = new Date()): CaregiverGrant {
  const at = now.toISOString()
  return {
    ...g,
    status: 'active',
    acceptedAt: at,
    updatedAt: at,
    acceptanceCode: undefined,
    accessLog: [...g.accessLog, { at, action: 'Invitation accepted by the invited person' }],
  }
}

export function revokeGrant(g: CaregiverGrant, now = new Date()): CaregiverGrant {
  const at = now.toISOString()
  return {
    ...g,
    status: 'revoked',
    updatedAt: at,
    accessLog: [...g.accessLog, { at, action: 'Access revoked by the user' }],
  }
}

/** Called on load: a grant past its expiry is marked expired (never deleted). */
export function expireIfStale(g: CaregiverGrant, now = new Date()): CaregiverGrant {
  if (g.status === 'active' && g.expiresAt && new Date(g.expiresAt).getTime() < now.getTime()) {
    const at = now.toISOString()
    return { ...g, status: 'expired', updatedAt: at, accessLog: [...g.accessLog, { at, action: 'Access expired automatically' }] }
  }
  return g
}

export interface AccessCheckResult {
  allowed: boolean
  reason: string
}

export function checkCaregiverAccess(
  grants: CaregiverGrant[],
  contactId: string,
  scope: CaregiverScope,
  now = new Date(),
): AccessCheckResult {
  const g = grants.find((x) => x.contactId === contactId)
  if (!g) return { allowed: false, reason: 'No invitation exists for this person.' }
  const status = grantStatus(g, now)
  if (status === 'revoked') return { allowed: false, reason: 'Access was revoked.' }
  if (status === 'expired') return { allowed: false, reason: 'Access has expired.' }
  if (status === 'invited') return { allowed: false, reason: 'The invitation has not been accepted yet.' }
  if (!g.scopes.includes(scope)) return { allowed: false, reason: 'This permission was not granted.' }
  return { allowed: true, reason: 'Allowed by an active grant.' }
}

export function newGrantDraft(contactId: string, scopes: CaregiverScope[], expiresAt?: string): Omit<CaregiverGrant, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId: 'self',
    contactId,
    scopes: normalizeScopes(scopes),
    status: 'invited',
    invitedAt: nowIso(),
    expiresAt,
    accessLog: [],
  }
}

export function contactsForEmergencyList(contacts: EmergencyContact[]): EmergencyContact[] {
  return contacts.filter((c) => c.isEmergencyContact && !c.deletedAt).sort((a, b) => a.priority - b.priority)
}
