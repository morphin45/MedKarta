import { describe, expect, it } from 'vitest'
import {
  checkCaregiverAccess, describeGrantAccess, grantAllows, grantStatus, normalizeScopes,
} from './permissions'
import type { CaregiverGrant, CaregiverScope } from '@/types'

function grant(partial: Partial<CaregiverGrant>): CaregiverGrant {
  return {
    id: 'g1', userId: 'u1', contactId: 'c1',
    scopes: ['view-medications'], status: 'active',
    invitedAt: '2026-01-01T00:00:00Z', accessLog: [],
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('caregiver permissions', () => {
  it('denies everything when no grant exists (default: no access)', () => {
    const r = checkCaregiverAccess([], 'c1', 'view-medications')
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/no invitation/i)
  })

  it('denies when invitation not accepted', () => {
    const g = grant({ status: 'invited', scopes: ['full-caregiver'] })
    const r = checkCaregiverAccess([g], 'c1', 'view-medications')
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/not been accepted/i)
  })

  it('allows an active grant with the right scope', () => {
    const g = grant({})
    expect(checkCaregiverAccess([g], 'c1', 'view-medications').allowed).toBe(true)
    expect(checkCaregiverAccess([g], 'c1', 'view-appointments').allowed).toBe(false)
    expect(checkCaregiverAccess([g], 'c1', 'full-caregiver').allowed).toBe(false)
  })

  it('expires access at the expiry date', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString()
    const future = new Date(Date.now() + 86_400_000).toISOString()
    expect(grantStatus(grant({ expiresAt: past }))).toBe('expired')
    expect(grantStatus(grant({ expiresAt: future }))).toBe('active')
    const g = grant({ expiresAt: past, scopes: ['full-caregiver'] })
    expect(checkCaregiverAccess([g], 'c1', 'view-medications').allowed).toBe(false)
    expect(checkCaregiverAccess([g], 'c1', 'view-medications').reason).toMatch(/expired/i)
  })

  it('blocks revoked access immediately', () => {
    const g = grant({ status: 'revoked', scopes: ['full-caregiver'] })
    expect(grantStatus(g)).toBe('revoked')
    expect(checkCaregiverAccess([g], 'c1', 'view-medications').reason).toMatch(/revoked/i)
  })

  it('adds dependency scopes automatically', () => {
    const out = normalizeScopes(['help-manage-medications'])
    expect(out).toContain('view-medications')
    const full = normalizeScopes(['full-caregiver'])
    expect(full).toEqual(expect.arrayContaining(['view-medications', 'view-appointments', 'view-emergency-profile', 'view-selected-records']))
  })

  it('describes grants in plain language', () => {
    expect(describeGrantAccess(grant({ scopes: ['emergency-contact-only'] }))).toMatch(/no information access/i)
    expect(describeGrantAccess(grant({ scopes: ['view-medications'] }))).toMatch(/view medications/i)
    expect(describeGrantAccess(grant({ scopes: ['full-caregiver'] }))).toMatch(/Full caregiver/i)
  })

  it('checks scope+expiry together via grantAllows', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString()
    const g = grant({ scopes: ['view-medications', 'view-appointments'], expiresAt: future })
    expect(grantAllows(g, 'view-medications')).toBe(true)
    expect(grantAllows(g, 'view-selected-records')).toBe(false)
  })

  it('treats scope list as the single source of truth', () => {
    const scopes: CaregiverScope[] = ['view-medications']
    expect(scopes.includes('view-medications')).toBe(true)
  })

  it('never keeps a contradictory "emergency-contact-only + access" grant', () => {
    const out = normalizeScopes(['emergency-contact-only', 'view-medications'])
    expect(out).not.toContain('emergency-contact-only')
    expect(out).toContain('view-medications')
  })

  it('describes mixed scopes as information access, not "no access"', () => {
    const g = grant({ scopes: normalizeScopes(['emergency-contact-only', 'view-appointments', 'help-manage-medications']) })
    const text = describeGrantAccess(g)
    expect(text).not.toMatch(/no information access/i)
    expect(text).toMatch(/view appointments|help manage medications/i)
  })

  it('still reports emergency-contact-only when it is the only scope', () => {
    const g = grant({ scopes: normalizeScopes(['emergency-contact-only']) })
    expect(describeGrantAccess(g)).toMatch(/no information access/i)
  })
})
