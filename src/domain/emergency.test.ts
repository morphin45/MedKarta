import { describe, expect, it } from 'vitest'
import { resolveEmergencyProfile, emergencyCardText, EMERGENCY_STALE_AFTER_DAYS } from './emergency'
import { buildDemoData } from '@/data/seed'
import type { Allergy, EmergencyContact, EmergencyProfile, MedicalCondition, Medication, UserProfile } from '@/types'

const d = buildDemoData()

function inputs(overrides?: Partial<Parameters<typeof resolveEmergencyProfile>[0]>) {
  return {
    user: d.user,
    profile: d.profile,
    emergency: d.emergency,
    allergies: d.allergies,
    medications: d.medications,
    conditions: d.conditions,
    doctors: d.doctors,
    contacts: d.contacts,
    ...overrides,
  }
}

describe('emergency profile gating', () => {
  it('includes only consented sections', () => {
    const p = resolveEmergencyProfile(inputs())
    expect(p.name).toBe('Maria Santos')
    expect(p.allergies.length).toBeGreaterThan(0)
    expect(p.medications.length).toBeGreaterThan(0)
    expect(p.contacts.map((c) => c.name)).toContain('Elena Santos')
  })

  it('shows blood type only when verified AND enabled', () => {
    const enabledVerified = resolveEmergencyProfile(inputs())
    expect(enabledVerified.bloodType).toBe('O+')

    const enabledUnverified = resolveEmergencyProfile(
      inputs({ profile: { ...d.profile, bloodTypeVerified: false } as UserProfile }),
    )
    expect(enabledUnverified.bloodType).toBeUndefined()

    const disabledButVerified = resolveEmergencyProfile(
      inputs({ emergency: { ...d.emergency, includeBloodType: false } }),
    )
    expect(disabledButVerified.bloodType).toBeUndefined()
  })

  it('never includes organ donor status unless opted in and registered', () => {
    expect(d.emergency.includeOrganDonor).toBe(false)
    const p = resolveEmergencyProfile(inputs())
    expect(p.organDonorStatus).toBeUndefined()
  })

  it('omits allergies when not consented', () => {
    const p = resolveEmergencyProfile(inputs({ emergency: { ...d.emergency, includeAllergies: false } }))
    expect(p.allergies).toHaveLength(0)
    expect(p.includedSections).not.toContain('Allergies')
  })

  it('excludes resolved conditions and completed medications', () => {
    const p = resolveEmergencyProfile(inputs())
    expect(p.conditions.map((c) => c.name)).not.toContain('Appendectomy history')
    expect(p.medications.map((m) => m.name)).not.toContain('Amoxicillin')
  })

  it('sorts emergency contacts by priority and includes only flagged ones', () => {
    const p = resolveEmergencyProfile(inputs())
    expect(p.contacts[0]!.name).toBe('Elena Santos')
    expect(p.contacts.map((c) => c.name)).not.toContain('Rosa Delgado')
  })

  it('flags a stale profile', () => {
    const old = new Date(Date.now() - (EMERGENCY_STALE_AFTER_DAYS + 30) * 86_400_000).toISOString()
    const p = resolveEmergencyProfile(inputs({ emergency: { ...d.emergency, lastUpdatedAt: old } }))
    expect(p.stale).toBe(true)
  })

  it('suppresses sections that are toggled off via the contact list too', () => {
    const p = resolveEmergencyProfile(inputs({ emergency: { ...d.emergency, includeContacts: false } }))
    expect(p.contacts).toHaveLength(0)
  })

  it('renders a plain-text card with verified/unverified separation', () => {
    const p = resolveEmergencyProfile(inputs())
    const text = emergencyCardText(p)
    expect(text).toContain('EMERGENCY MEDICAL INFORMATION')
    expect(text).toContain('Penicillin')
    expect(text).toContain('verified')
    expect(text).toContain('unverified')
    expect(text.toLowerCase()).toContain('incomplete or outdated')
  })

  it('respects the allergy list it is given (no hidden data)', () => {
    const onlyOne: Allergy[] = [d.allergies[0]!]
    const p = resolveEmergencyProfile(inputs({ allergies: onlyOne }))
    expect(p.allergies).toHaveLength(1)
  })

  it('handles empty medication/condition lists safely', () => {
    const p = resolveEmergencyProfile(inputs({ medications: [] as Medication[], conditions: [] as MedicalCondition[], contacts: [] as EmergencyContact[] }))
    expect(p.medications).toHaveLength(0)
    expect(p.conditions).toHaveLength(0)
    expect(p.contacts).toHaveLength(0)
    expect(p.name).toBe('Maria Santos')
  })

  it('uses the EmergencyProfile shape as provided', () => {
    const em: EmergencyProfile = { ...d.emergency, includeMedications: false, includeAllergies: false }
    const p = resolveEmergencyProfile(inputs({ emergency: em }))
    expect(p.medications).toHaveLength(0)
    expect(p.allergies).toHaveLength(0)
  })
})
