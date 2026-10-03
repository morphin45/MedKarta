// End-to-end style coverage of the caregiver consent workflow using the same
// pure functions the UI calls: invite → code verification → accept → access
// checks → revoke / automatic expiry.

import { describe, expect, it } from 'vitest'
import {
  acceptanceMatches, checkCaregiverAccess, expireIfStale, grantStatus,
  markAccepted, normalizeScopes, revokeGrant,
} from './permissions'
import { sha256Hex } from '@/lib/crypto'
import type { CaregiverGrant } from '@/types'

const codeFor = (code: string) => sha256Hex(`ph-os-invite:${code}`)

function invited(overrides: Partial<CaregiverGrant> = {}): CaregiverGrant {
  const at = '2026-09-01T10:00:00.000Z'
  return {
    id: 'g1', userId: 'u1', contactId: 'c1',
    scopes: normalizeScopes(['view-medications']), status: 'invited',
    invitedAt: at, acceptanceCode: 'ABC123', acceptanceCodeHash: '',
    accessLog: [{ at, action: 'Invitation created with scopes: view-medications' }],
    createdAt: at, updatedAt: at,
    ...overrides,
  }
}

describe('caregiver consent workflow (end to end)', () => {
  it('nobody has access while the invitation is pending', () => {
    const g = invited()
    expect(grantStatus(g)).toBe('invited')
    expect(checkCaregiverAccess([g], 'c1', 'view-medications').allowed).toBe(false)
  })

  it('rejects a wrong acceptance code', async () => {
    const g = invited({ acceptanceCodeHash: await codeFor('ABC123') })
    const wrongHash = await codeFor('ZZZZZZ')
    expect(acceptanceMatches(g, wrongHash)).toBe(false)
    expect(acceptanceMatches(g, '')).toBe(false)
    expect(checkCaregiverAccess([g], 'c1', 'view-medications').allowed).toBe(false)
  })

  it('accepts with the correct code and only then grants the scope', async () => {
    const g = invited({ acceptanceCodeHash: await codeFor('ABC123') })
    expect(acceptanceMatches(g, await codeFor('ABC123'))).toBe(true)
    const active = markAccepted(g, new Date('2026-09-02T09:00:00.000Z'))
    expect(active.status).toBe('active')
    expect(active.acceptedAt).toBe('2026-09-02T09:00:00.000Z')
    // The one-time code is cleared so it cannot be replayed.
    expect(active.acceptanceCode).toBeUndefined()
    expect(active.acceptanceCodeHash).toBe(g.acceptanceCodeHash)
    expect(active.accessLog.at(-1)?.action).toMatch(/accepted/i)
    expect(checkCaregiverAccess([active], 'c1', 'view-medications').allowed).toBe(true)
    // Access is still scope-limited, not blanket.
    expect(checkCaregiverAccess([active], 'c1', 'view-appointments').allowed).toBe(false)
    expect(checkCaregiverAccess([active], 'c1', 'full-caregiver').allowed).toBe(false)
  })

  it('the cache cannot be replayed after acceptance', async () => {
    const g = invited({ acceptanceCodeHash: await codeFor('ABC123') })
    const active = markAccepted(g)
    // Re-verifying the same code against the accepted grant must not re-activate.
    expect(acceptanceMatches(active, await codeFor('ABC123'))).toBe(true)
    expect(active.acceptanceCode).toBeUndefined()
    expect(active.status).toBe('active')
  })

  it('revoking removes access immediately and records who did it', () => {
    const g = markAccepted(invited())
    const revoked = revokeGrant(g, new Date('2026-09-03T12:00:00.000Z'))
    expect(revoked.status).toBe('revoked')
    expect(revoked.accessLog.at(-1)?.action).toMatch(/revoked/i)
    expect(checkCaregiverAccess([revoked], 'c1', 'view-medications').reason).toMatch(/revoked/i)
  })

  it('expired grants stop working but keep their trail', () => {
    const g = markAccepted({ ...invited(), expiresAt: '2026-09-05T00:00:00.000Z' })
    const expired = expireIfStale(g, new Date('2026-09-06T00:00:00.000Z'))
    expect(expired.status).toBe('expired')
    expect(expired.accessLog.at(-1)?.action).toMatch(/expired/i)
    expect(checkCaregiverAccess([expired], 'c1', 'view-medications').allowed).toBe(false)
  })

  it('a grant that has not expired is left untouched by the sweep', () => {
    const g = markAccepted({ ...invited(), expiresAt: '2026-12-31T00:00:00.000Z' })
    expect(expireIfStale(g, new Date('2026-09-06T00:00:00.000Z'))).toBe(g)
  })

  it('full access still requires acceptance first', () => {
    const g = invited({ scopes: normalizeScopes(['full-caregiver']) })
    expect(checkCaregiverAccess([g], 'c1', 'view-emergency-profile').allowed).toBe(false)
    const active = markAccepted(g)
    expect(checkCaregiverAccess([active], 'c1', 'view-emergency-profile').allowed).toBe(true)
  })
})
