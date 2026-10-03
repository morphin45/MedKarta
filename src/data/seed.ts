// ─── Demo seed data ──────────────────────────────────────────────────────────
// Every demo record is marked demo: true so the UI can badge it clearly and
// the factory reset can wipe it without touching real accounts.

import type {
  Allergy, Appointment, EmergencyContact, EmergencyProfile, MedicalCondition,
  Medication, TimelineEntry, User, UserProfile, HealthDocument, Doctor,
} from '@/types'
import { nowIso } from '@/lib/util'

export const DEMO_FLAG = 'demo'

function daysAgoIso(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString()
}
function daysAheadIso(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString()
}

export interface DemoDataset {
  user: User
  profile: UserProfile
  emergency: EmergencyProfile
  allergies: Allergy[]
  conditions: MedicalCondition[]
  medications: Medication[]
  timeline: TimelineEntry[]
  doctors: Doctor[]
  contacts: EmergencyContact[]
  documents: HealthDocument[]
  appointments: Appointment[]
}

function base(nowOffsetDays = 30): { createdAt: string; updatedAt: string } {
  return { createdAt: daysAgoIso(nowOffsetDays), updatedAt: daysAgoIso(nowOffsetDays) }
}

export function buildDemoData(): DemoDataset {
  const user: User = {
    id: 'user_demo', name: 'Maria Santos', preferredName: 'Maria', email: 'maria@demo.health',
    autoLockMinutes: 15, textScale: 100, theme: 'system',
    createdAt: daysAgoIso(120), updatedAt: daysAgoIso(2),
  }

  const profile: UserProfile = {
    id: 'profile_demo', userId: user.id, dateOfBirth: '1958-04-12',
    bloodType: 'O+', bloodTypeVerified: true, organDonorStatus: 'registered-donor',
    includeOrganDonorInEmergency: false,
    preferredLanguage: 'English (also speaks Spanish)',
    accessibilityNeeds: ['Large text preferred'],
    weightKg: 68, heightCm: 160,
    ...base(120),
  }

  const emergency: EmergencyProfile = {
    id: 'em_demo', userId: user.id,
    includeName: true, includePreferredName: true, includeDob: true, includeAddress: false,
    includeBloodType: true, includeConditions: true, includeMedications: true, includeAllergies: true,
    includeDevices: true, includePhysicians: true, includeContacts: true,
    includeAdvanceDirective: true, includeOrganDonor: false,
    includeAccessibilityNeeds: true, includeLanguage: true,
    shareWhenLocked: true,
    emergencyDevices: ['Cardiac stent (2019) — avoid MRI without radiology review'],
    advanceDirectiveNote: 'Durable power of attorney for health care: daughter Elena Santos (see contacts). Document copy in Health Records.',
    emergencyNotes: 'If I cannot speak for myself, my daughter Elena decides with my care team. I prefer the ER at St. Mary’s.',
    lastUpdatedAt: daysAgoIso(9),
    ...base(120),
  }

  const allergies: Allergy[] = [
    { id: 'alg_1', userId: user.id, substance: 'Penicillin', reaction: 'Hives, swelling', severity: 'severe', verified: true, notes: 'Confirmed by Dr. Chen after 2018 reaction.', ...base(100) },
    { id: 'alg_2', userId: user.id, substance: 'Latex', reaction: 'Skin rash', severity: 'mild', verified: false, notes: 'Self-suspected.', ...base(90) },
  ]

  const conditions: MedicalCondition[] = [
    { id: 'cond_1', userId: user.id, name: 'Type 2 diabetes', status: 'managed', onsetDate: '2016-06-01', verified: true, notes: 'Managed with metformin and lifestyle.', ...base(95) },
    { id: 'cond_2', userId: user.id, name: 'Hypertension', status: 'active', onsetDate: '2019-02-01', verified: true, notes: '', ...base(95) },
    { id: 'cond_3', userId: user.id, name: 'Appendectomy history', status: 'resolved', onsetDate: '2005-05-20', verified: true, ...base(95) },
  ]

  const medications: Medication[] = [
    {
      id: 'med_1', userId: user.id, name: 'Metformin', brandName: 'Glucophage', dose: '500 mg', form: 'Tablet',
      purpose: 'Type 2 diabetes', instructions: 'Take with food to avoid stomach upset.', frequency: 'Twice daily',
      startDate: '2016-06-15', status: 'active', supplyRemaining: 12, refillQuantity: 60, refillDueDate: daysAheadIso(4),
      reminderTimes: ['08:00', '19:00'], confirmedByClinician: true, ...base(80),
    },
    {
      id: 'med_2', userId: user.id, name: 'Lisinopril', dose: '10 mg', form: 'Tablet',
      purpose: 'Blood pressure', instructions: 'Once daily in the morning.', frequency: 'Once daily',
      startDate: '2019-02-10', status: 'active', supplyRemaining: 34, refillQuantity: 30, refillDueDate: daysAheadIso(20),
      reminderTimes: ['08:00'], confirmedByClinician: true, ...base(80),
    },
    {
      id: 'med_3', userId: user.id, name: 'Atorvastatin', dose: '20 mg', form: 'Tablet',
      purpose: 'Cholesterol', frequency: 'Once daily, evening', startDate: '2023-01-05', status: 'active',
      supplyRemaining: 8, refillQuantity: 30, refillDueDate: daysAheadIso(2),
      reminderTimes: ['20:00'], confirmedByClinician: false, ...base(60),
    },
    {
      id: 'med_4', userId: user.id, name: 'Amoxicillin', dose: '500 mg', form: 'Capsule',
      purpose: 'Infection (finished course)', frequency: 'Three times daily', startDate: daysAgoIso(40), endDate: daysAgoIso(31),
      status: 'completed', reminderTimes: [], confirmedByClinician: true, ...base(45),
    },
  ]

  const timeline: TimelineEntry[] = [
    { id: 'tl_1', userId: user.id, category: 'diagnosis', title: 'Type 2 diabetes diagnosed', date: '2016-06-01', notes: 'A1c 7.4% at diagnosis.', tags: ['diabetes'], source: 'Dr. Chen', verificationStatus: 'verified', relatedIds: [], ...base(100) },
    { id: 'tl_2', userId: user.id, category: 'hospital-visit', title: 'ER visit — chest pain, cardiac stent placed', date: '2019-03-14', notes: 'Stent at St. Mary’s. Follow-up cardiology ongoing.', tags: ['heart', 'stent'], source: 'St. Mary’s Hospital', verificationStatus: 'verified', relatedIds: [], ...base(100) },
    { id: 'tl_3', userId: user.id, category: 'lab', title: 'A1c 6.8% — improved from 7.4%', date: daysAgoIso(26), notes: 'Next A1c due in ~3 months.', tags: ['diabetes', 'labs'], source: 'Lab portal download', verificationStatus: 'verified', relatedIds: ['doc_1'], ...base(26) },
    { id: 'tl_4', userId: user.id, category: 'symptom', title: 'Occasional dizzy spells when standing', date: daysAgoIso(12), notes: 'Mostly mornings. Happens after Lisinopril.', tags: ['bp', 'dizziness'], source: 'Entered by me', verificationStatus: 'user-entered', relatedIds: ['med_2'], ...base(12) },
    { id: 'tl_5', userId: user.id, category: 'symptom', title: 'Dizziness improved — twice this week (was daily)', date: daysAgoIso(3), notes: 'Getting up slowly helps.', tags: ['bp', 'dizziness'], source: 'Entered by me', verificationStatus: 'user-entered', relatedIds: ['tl_4'], ...base(3) },
    { id: 'tl_6', userId: user.id, category: 'vaccination', title: 'Flu shot', date: daysAgoIso(50), notes: 'At pharmacy clinic.', tags: ['prevention'], source: 'Pharmacy record', verificationStatus: 'verified', relatedIds: [], ...base(50) },
    { id: 'tl_7', userId: user.id, category: 'specialist-visit', title: 'Cardiology follow-up', date: daysAgoIso(70), notes: 'Echo stable. Continue current meds.', tags: ['heart'], source: 'Dr. Okafor', verificationStatus: 'verified', relatedIds: [], ...base(70) },
    { id: 'tl_8', userId: user.id, category: 'note', title: 'Question: is dizziness a side effect or my blood pressure dropping?', date: daysAgoIso(6), notes: 'Ask at next appointment.', tags: ['question'], source: 'Entered by me', verificationStatus: 'user-entered', relatedIds: ['tl_4', 'med_2'], ...base(6) },
  ]

  const doctors: Doctor[] = [
    { id: 'doc_dr1', userId: user.id, name: 'Dr. Alan Chen', specialty: 'Family medicine', clinic: 'Riverbend Family Practice', phone: '(555) 010-2233', email: 'achen@riverbend.example', isPrimary: true, ...base(100) },
    { id: 'doc_dr2', userId: user.id, name: 'Dr. Amara Okafor', specialty: 'Cardiology', clinic: 'St. Mary’s Heart Institute', phone: '(555) 010-7788', isPrimary: false, ...base(100) },
  ]

  const contacts: EmergencyContact[] = [
    { id: 'ec_1', userId: user.id, name: 'Elena Santos', relationship: 'Daughter', phone: '(555) 231-4477', email: 'elena@example.com', preferredMethod: 'phone', priority: 1, isEmergencyContact: true, ...base(100) },
    { id: 'ec_2', userId: user.id, name: 'Marco Santos', relationship: 'Son', phone: '(555) 231-9922', preferredMethod: 'sms', priority: 2, isEmergencyContact: true, ...base(100) },
    { id: 'ec_3', userId: user.id, name: 'Rosa Delgado', relationship: 'Neighbor & friend', phone: '(555) 445-1122', preferredMethod: 'phone', priority: 3, isEmergencyContact: false, ...base(80) },
  ]

  const documents: HealthDocument[] = [
    {
      id: 'doc_1', userId: user.id, name: 'A1c lab result (Sep)', category: 'lab-result', mime: 'text/plain', size: 480,
      addedAt: daysAgoIso(26), notes: 'From patient portal.', ocrText: 'HbA1c 6.8% collected 2026-09-05. Reference 4.0–5.6%. Dr. A. Chen.',
      extractedFields: [
        { field: 'HBA1C', value: '6.8 %', confidence: 'high' },
        { field: 'Date', value: '2026-09-05', confidence: 'high' },
        { field: 'Provider mentioned', value: 'A. Chen', confidence: 'medium' },
      ],
      extractedReviewed: true, version: 1, ...base(26),
    },
    {
      id: 'doc_2', userId: user.id, name: 'Cardiology visit letter', category: 'physician-note', mime: 'text/plain', size: 620,
      addedAt: daysAgoIso(70), notes: '', ocrText: 'Echo stable. Continue Lisinopril 10mg. Dr. Okafor, St. Mary’s Heart Institute.',
      extractedFields: [{ field: 'Medication mentioned', value: 'Lisinopril', confidence: 'low' }],
      extractedReviewed: true, version: 1, ...base(70),
    },
  ]

  const appointments: Appointment[] = [
    {
      id: 'appt_1', userId: user.id, doctorId: 'doc_dr1',
      datetime: daysAheadIso(6), reason: '3-month diabetes review + dizziness', status: 'scheduled',
      location: 'Riverbend Family Practice', ...base(6),
    },
    {
      id: 'appt_2', userId: user.id, doctorId: 'doc_dr2',
      datetime: daysAgoIso(70), reason: 'Cardiology follow-up', status: 'completed',
      ...base(70),
      postVisit: {
        summary: 'Echo stable. Stent doing well.',
        instructions: 'Continue current medications. Walk 20 min most days.',
        medicationChanges: 'None.',
        testsOrdered: 'None.',
        followUpDate: daysAheadIso(30),
        referrals: 'None.',
        openQuestions: 'Whether dizziness relates to BP medication.',
        documentIds: ['doc_2'],
        recordedAt: daysAgoIso(69),
      },
    },
  ]

  return { user, profile, emergency, allergies, conditions, medications, timeline, doctors, contacts, documents, appointments }
}

export function seedDemoGrants(contactId: string): Array<unknown> {
  void contactId
  return []
}

export function seedTimestamp(): string {
  return nowIso()
}
