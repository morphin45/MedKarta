// ─── Emergency profile resolution ────────────────────────────────────────────
// Pure functions. The resolved profile contains ONLY fields the user
// explicitly enabled. Hard safety rules that consent cannot override:
//   • Blood type appears only if the user verified it.
//   • Organ-donor status appears only if the user opted in.
// This module never invents data; missing data is simply omitted.

import type {
  Allergy, EmergencyContact, EmergencyProfile, MedicalCondition, Medication,
  ResolvedEmergencyProfile, User, UserProfile,
} from '@/types'
import { ageFromDob } from '@/lib/util'

export const EMERGENCY_STALE_AFTER_DAYS = 180

export interface EmergencyInputs {
  user: Pick<User, 'name' | 'preferredName'>
  profile?: UserProfile
  emergency: EmergencyProfile
  allergies: Allergy[]
  medications: Medication[]
  conditions: MedicalCondition[]
  doctors: Array<{ name: string; specialty?: string; phone?: string; isPrimary: boolean }>
  contacts: EmergencyContact[]
}

function activeMeds(meds: Medication[]): Medication[] {
  return meds.filter((m) => m.status === 'active' && !m.deletedAt)
}

export function resolveEmergencyProfile(input: EmergencyInputs, now = new Date()): ResolvedEmergencyProfile {
  const { emergency: e } = input
  const includedSections: string[] = []
  const lastUpdated = new Date(e.lastUpdatedAt)
  const ageDays = (now.getTime() - lastUpdated.getTime()) / 86_400_000

  const allergies = e.includeAllergies
    ? input.allergies
        .filter((a) => !a.deletedAt)
        .map((a) => ({ substance: a.substance, reaction: a.reaction, severity: a.severity, verified: a.verified }))
    : []
  if (allergies.length) includedSections.push('Allergies')

  const medications = e.includeMedications
    ? activeMeds(input.medications).map((m) => ({
        name: m.name,
        dose: m.dose,
        instructions: m.instructions,
        confirmedByClinician: m.confirmedByClinician,
      }))
    : []
  if (medications.length) includedSections.push('Current medications')

  const conditions = e.includeConditions
    ? input.conditions
        .filter((c) => c.status !== 'resolved' && !c.deletedAt)
        .map((c) => ({ name: c.name, status: c.status, verified: c.verified }))
    : []
  if (conditions.length) includedSections.push('Medical conditions')

  const bloodTypeVerified = input.profile?.bloodTypeVerified === true
  const bloodType = e.includeBloodType && bloodTypeVerified ? input.profile?.bloodType : undefined
  if (bloodType) includedSections.push('Blood type (verified)')

  const devices = e.includeDevices ? input.emergency.emergencyDevices.filter((d) => d.trim()) : []
  if (devices.length) includedSections.push('Medical devices')

  const physicians = e.includePhysicians
    ? input.doctors
        .filter((d) => d.name.trim())
        .map((d) => ({ name: d.name, specialty: d.specialty, phone: d.phone, isPrimary: d.isPrimary }))
    : []
  if (physicians.length) includedSections.push('Physicians')

  const contacts = e.includeContacts
    ? input.contacts
        .filter((c) => c.isEmergencyContact && !c.deletedAt)
        .sort((a, b) => a.priority - b.priority)
        .map((c) => ({ name: c.name, relationship: c.relationship, phone: c.phone, priority: c.priority }))
    : []
  if (contacts.length) includedSections.push('Emergency contacts')

  const dob = e.includeDob ? input.profile?.dateOfBirth : undefined
  if (dob) includedSections.push('Date of birth')
  const organDonor = e.includeOrganDonor ? input.profile?.organDonorStatus : undefined
  if (organDonor && organDonor !== 'undecided') includedSections.push('Organ donor status')
  const accessibilityNeeds = e.includeAccessibilityNeeds ? (input.profile?.accessibilityNeeds ?? []) : []
  const preferredLanguage = e.includeLanguage ? input.profile?.preferredLanguage : undefined

  return {
    generatedAt: now.toISOString(),
    stale: ageDays > EMERGENCY_STALE_AFTER_DAYS,
    name: e.includeName ? input.user.name : '',
    preferredName: e.includePreferredName ? input.user.preferredName : undefined,
    dob,
    bloodType,
    bloodTypeVerified,
    organDonorStatus: organDonor !== 'undecided' ? organDonor : undefined,
    preferredLanguage,
    accessibilityNeeds,
    allergies,
    medications,
    conditions,
    devices,
    physicians,
    contacts,
    emergencyNotes: e.emergencyNotes.trim(),
    advanceDirectiveNote: e.includeAdvanceDirective ? e.advanceDirectiveNote.trim() : '',
    includedSections,
  }
}

/**
 * The single decision point for whether an emergency subset may be readable
 * while the vault is locked. Both the explicit profile setting AND the consent
 * record must agree — either one being off deletes the cache.
 */
export function mayCacheForLockScreen(input: {
  hasUser: boolean
  hasEmergencyProfile: boolean
  shareWhenLocked: boolean
  consentGranted: boolean
}): boolean {
  return input.hasUser && input.hasEmergencyProfile && input.shareWhenLocked && input.consentGranted
}

/** Human-readable plain-text card used for print and "copy for paramedics". */
export function emergencyCardText(p: ResolvedEmergencyProfile): string {
  const lines: string[] = []
  const who = [p.name, p.preferredName && `“${p.preferredName}”`].filter(Boolean).join(' · ')
  const dobAge = [p.dob, ageFromDob(p.dob) && `Age ${ageFromDob(p.dob)}`].filter(Boolean).join(' · ')
  lines.push('EMERGENCY MEDICAL INFORMATION')
  if (who) lines.push(who)
  if (dobAge) lines.push(dobAge)
  if (p.bloodType) lines.push(`Blood type: ${p.bloodType} (verified)`)
  if (p.allergies.length) {
    lines.push('', 'ALLERGIES')
    for (const a of p.allergies) lines.push(`• ${a.substance}${a.reaction ? ` — ${a.reaction}` : ''} [${a.severity}${a.verified ? ', verified' : ', unverified'}]`)
  }
  if (p.medications.length) {
    lines.push('', 'CURRENT MEDICATIONS')
    for (const m of p.medications) lines.push(`• ${m.name} ${m.dose}${m.confirmedByClinician ? '' : ' (user-entered)'}`)
  }
  if (p.conditions.length) {
    lines.push('', 'MEDICAL CONDITIONS')
    for (const c of p.conditions) lines.push(`• ${c.name} [${c.status}${c.verified ? ', verified' : ''}]`)
  }
  if (p.devices.length) {
    lines.push('', 'IMPLANTED DEVICES')
    for (const d of p.devices) lines.push(`• ${d}`)
  }
  if (p.physicians.length) {
    lines.push('', 'PHYSICIANS')
    for (const d of p.physicians) lines.push(`• ${d.name}${d.specialty ? `, ${d.specialty}` : ''}${d.phone ? ` — ${d.phone}` : ''}`)
  }
  if (p.contacts.length) {
    lines.push('', 'EMERGENCY CONTACTS')
    for (const c of p.contacts) lines.push(`• ${c.name} (${c.relationship}) — ${c.phone}`)
  }
  if (p.advanceDirectiveNote) lines.push('', `ADVANCE DIRECTIVE / PREFERENCES: ${p.advanceDirectiveNote}`)
  if (p.emergencyNotes) lines.push('', `NOTES: ${p.emergencyNotes}`)
  if (p.preferredLanguage) lines.push(`Preferred language: ${p.preferredLanguage}`)
  if (p.accessibilityNeeds.length) lines.push(`Accessibility: ${p.accessibilityNeeds.join(', ')}`)
  lines.push('', `Prepared by Personal Health OS from information the person entered. May be incomplete or outdated (updated ${new Date(p.generatedAt).toLocaleDateString()}).`)
  return lines.join('\n')
}
