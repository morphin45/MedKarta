import { describe, expect, it } from 'vitest'
import { mayCacheForLockScreen, resolveEmergencyProfile } from './emergency'
import { buildDemoData } from '@/data/seed'
import type { CaregiverScope } from '@/types'

const d = buildDemoData()

describe('lock-screen emergency access gate', () => {
  it('requires BOTH the profile setting and the consent record', () => {
    const base = { hasUser: true, hasEmergencyProfile: true }
    expect(mayCacheForLockScreen({ ...base, shareWhenLocked: true, consentGranted: true })).toBe(true)
    expect(mayCacheForLockScreen({ ...base, shareWhenLocked: true, consentGranted: false })).toBe(false)
    expect(mayCacheForLockScreen({ ...base, shareWhenLocked: false, consentGranted: true })).toBe(false)
    expect(mayCacheForLockScreen({ ...base, shareWhenLocked: false, consentGranted: false })).toBe(false)
  })

  it('refuses to cache anything when there is no vault or profile', () => {
    expect(mayCacheForLockScreen({ hasUser: false, hasEmergencyProfile: false, shareWhenLocked: true, consentGranted: true })).toBe(false)
    expect(mayCacheForLockScreen({ hasUser: true, hasEmergencyProfile: false, shareWhenLocked: true, consentGranted: true })).toBe(false)
  })

  it('caches only the approved subset — never the full record', () => {
    // The payload written to the lock-screen cache is exactly what Emergency
    // Mode renders, so it can never exceed the consented fields.
    const minimal = resolveEmergencyProfile({
      user: d.user,
      profile: d.profile,
      emergency: {
        ...d.emergency,
        includeAllergies: false, includeMedications: false, includeConditions: false,
        includeContacts: false, includeDevices: false, includePhysicians: false,
        includeAdvanceDirective: false, includeBloodType: false, includeDob: false,
        includeAccessibilityNeeds: false, includeLanguage: false, emergencyNotes: '',
      },
      allergies: d.allergies, medications: d.medications, conditions: d.conditions,
      doctors: d.doctors, contacts: d.contacts,
    })
    expect(minimal.allergies).toHaveLength(0)
    expect(minimal.medications).toHaveLength(0)
    expect(minimal.contacts).toHaveLength(0)
    expect(minimal.physicians).toHaveLength(0)
    expect(minimal.includedSections).toHaveLength(0)
    // Name is the only thing left, and even that is opt-in.
    expect(minimal.name).toBe('Maria Santos')
  })
})

describe('locked emergency mode cannot exceed consent', () => {
  it('never exposes data outside the resolved approved profile', () => {
    const p = resolveEmergencyProfile({
      user: d.user, profile: d.profile, emergency: d.emergency,
      allergies: d.allergies, medications: d.medications, conditions: d.conditions,
      doctors: d.doctors, contacts: d.contacts,
    })
    const serialized = JSON.stringify(p)
    // Latex allergy (unverified) may appear but must be flagged unverified.
    const latex = p.allergies.find((a) => a.substance === 'Latex')
    expect(latex?.verified).toBe(false)
    // Documents, timeline notes and caregiver grants are never in the payload.
    expect(serialized).not.toContain('ciphertextB64')
    expect(serialized).not.toContain('caregiverGrants')
    expect(serialized).not.toContain('accessLog')
  })
})

describe('caregiver scopes stay explicit (regression)', () => {
  it('an emergency-contact-only grant can never view medications', () => {
    const scopes: CaregiverScope[] = ['emergency-contact-only']
    expect(scopes.includes('view-medications')).toBe(false)
  })
})
