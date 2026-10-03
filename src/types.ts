// ─── Shared domain types for Personal Health OS ──────────────────────────────
// All timestamps are ISO-8601 strings. Records carry createdAt/updatedAt; soft
// delete via deletedAt. Audit records are immutable.

export type ID = string

export type VerificationStatus = 'verified' | 'user-entered' | 'needs-review'

export interface BaseRecord {
  id: ID
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

// ─── User & profile ──────────────────────────────────────────────────────────
export interface User extends BaseRecord {
  email: string
  name: string
  preferredName?: string
  autoLockMinutes: number
  textScale: number // 100 | 112 | 125 | 150
  theme: 'light' | 'dark' | 'system'
}

export interface UserProfile extends BaseRecord {
  userId: ID
  dateOfBirth?: string
  bloodType?: string
  bloodTypeVerified: boolean
  organDonorStatus?: 'registered-donor' | 'not-registered' | 'undecided'
  includeOrganDonorInEmergency: boolean
  preferredLanguage: string
  accessibilityNeeds: string[]
  weightKg?: number
  heightCm?: number
}

// ─── Emergency profile ───────────────────────────────────────────────────────
export interface EmergencyProfile extends BaseRecord {
  userId: ID
  includeName: boolean
  includePreferredName: boolean
  includeDob: boolean
  includeAddress: boolean
  includeBloodType: boolean // effective only if bloodTypeVerified
  includeConditions: boolean
  includeMedications: boolean
  includeAllergies: boolean
  includeDevices: boolean
  includePhysicians: boolean
  includeContacts: boolean
  includeAdvanceDirective: boolean
  includeOrganDonor: boolean
  includeAccessibilityNeeds: boolean
  includeLanguage: boolean
  shareWhenLocked: boolean // allow emergency profile w/o full unlock
  emergencyNotes: string // free-text emergency preferences
  emergencyDevices: string[] // implanted devices etc, free text list
  advanceDirectiveNote: string
  lastUpdatedAt: string
}

export interface ResolvedEmergencyProfile {
  generatedAt: string
  stale: boolean
  name: string
  preferredName?: string
  dob?: string
  bloodType?: string
  bloodTypeVerified: boolean
  organDonorStatus?: string
  preferredLanguage?: string
  accessibilityNeeds: string[]
  allergies: Array<{ substance: string; reaction?: string; severity: string; verified: boolean }>
  medications: Array<{ name: string; dose: string; instructions?: string; confirmedByClinician: boolean }>
  conditions: Array<{ name: string; status: string; verified: boolean }>
  devices: string[]
  physicians: Array<{ name: string; specialty?: string; phone?: string; isPrimary?: boolean }>
  contacts: Array<{ name: string; relationship: string; phone: string; priority: number }>
  emergencyNotes: string
  advanceDirectiveNote: string
  includedSections: string[]
}

// ─── Medical memory ──────────────────────────────────────────────────────────
export type TimelineCategory =
  | 'diagnosis' | 'symptom' | 'medication' | 'allergy' | 'procedure' | 'surgery'
  | 'test' | 'lab' | 'imaging' | 'hospital-visit' | 'vaccination' | 'specialist-visit'
  | 'care-plan' | 'note'

export const TIMELINE_CATEGORY_LABELS: Record<TimelineCategory, string> = {
  diagnosis: 'Diagnosis',
  symptom: 'Symptom',
  medication: 'Medication',
  allergy: 'Allergy',
  procedure: 'Procedure',
  surgery: 'Surgery',
  test: 'Test',
  lab: 'Lab result',
  imaging: 'Imaging',
  'hospital-visit': 'Hospital visit',
  vaccination: 'Vaccination',
  'specialist-visit': 'Specialist visit',
  'care-plan': 'Care plan',
  note: 'Note',
}

export interface TimelineEntry extends BaseRecord {
  userId: ID
  category: TimelineCategory
  title: string
  date: string
  providerId?: ID
  facilityId?: ID
  notes: string
  tags: string[]
  source: string // e.g. "Entered by me", "Lab portal", "Uploaded document"
  verificationStatus: VerificationStatus
  relatedIds: ID[]
}

export interface Allergy extends BaseRecord {
  userId: ID
  substance: string
  reaction?: string
  severity: 'mild' | 'moderate' | 'severe' | 'unknown'
  verified: boolean
  notes?: string
}

export interface MedicalCondition extends BaseRecord {
  userId: ID
  name: string
  status: 'active' | 'managed' | 'resolved'
  onsetDate?: string
  notes?: string
  verified: boolean
}

// ─── Medications ─────────────────────────────────────────────────────────────
export type MedicationStatus = 'active' | 'paused' | 'completed' | 'discontinued'

export interface Medication extends BaseRecord {
  userId: ID
  name: string
  brandName?: string
  dose: string
  form: string // tablet, capsule, injection…
  purpose?: string
  instructions?: string
  frequency: string
  prescriberId?: ID
  pharmacy?: string
  startDate?: string
  endDate?: string
  status: MedicationStatus
  supplyRemaining?: number
  refillQuantity?: number
  refillDueDate?: string
  reminderTimes: string[] // "08:00", "20:00"
  confirmedByClinician: boolean
  photoDocumentId?: ID
}

export interface MedicationLog extends BaseRecord {
  userId: ID
  medicationId: ID
  date: string // YYYY-MM-DD
  time: string // HH:MM
  status: 'taken' | 'skipped' | 'missed'
  note?: string
}

// ─── People & visits ─────────────────────────────────────────────────────────
export interface Doctor extends BaseRecord {
  userId: ID
  name: string
  specialty?: string
  clinic?: string
  phone?: string
  email?: string
  isPrimary: boolean
}

export interface HealthcareFacility extends BaseRecord {
  userId: ID
  name: string
  type?: string
  address?: string
  phone?: string
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Appointment extends BaseRecord {
  userId: ID
  doctorId?: ID
  facilityId?: ID
  datetime: string
  reason: string
  status: AppointmentStatus
  location?: string
  /** Goals the user wrote for this appointment; included in the summary. */
  prepGoals?: string
  prepSummary?: {
    text: string
    generatedAt: string
    sourceIds: ID[]
  }
  postVisit?: {
    summary: string
    instructions: string
    medicationChanges: string
    testsOrdered: string
    followUpDate?: string
    referrals: string
    openQuestions: string
    documentIds: ID[]
    recordedAt: string
  }
}

// ─── Health records (documents) ──────────────────────────────────────────────
export type DocumentCategory =
  | 'lab-result' | 'imaging-report' | 'hospital-discharge' | 'prescription'
  | 'vaccination-record' | 'insurance' | 'referral' | 'care-plan' | 'physician-note' | 'other'

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  'lab-result': 'Lab result',
  'imaging-report': 'Imaging report',
  'hospital-discharge': 'Hospital discharge',
  prescription: 'Prescription',
  'vaccination-record': 'Vaccination record',
  insurance: 'Insurance',
  referral: 'Referral letter',
  'care-plan': 'Care plan',
  'physician-note': 'Physician note',
  other: 'Other',
}

export interface ExtractedField {
  field: string
  value: string
  confidence: 'high' | 'medium' | 'low'
}

export interface HealthDocument extends BaseRecord {
  userId: ID
  name: string
  category: DocumentCategory
  mime: string
  size: number
  addedAt: string
  notes: string
  ciphertextB64?: string // encrypted file content (MVP keeps small files inline)
  ocrText?: string
  extractedFields: ExtractedField[]
  extractedReviewed: boolean
  version: number
  supersededBy?: ID
  archivedAt?: string
}

// ─── Contacts, caregivers, consent ───────────────────────────────────────────
export type ContactMethod = 'phone' | 'email' | 'sms' | 'any'

export interface EmergencyContact extends BaseRecord {
  userId: ID
  name: string
  relationship: string
  phone: string
  email?: string
  preferredMethod: ContactMethod
  priority: number // 1 = first called
  isEmergencyContact: boolean // shown in Emergency Mode
  notes?: string
}

export type CaregiverScope =
  | 'emergency-contact-only'
  | 'receive-selected-alerts'
  | 'view-emergency-profile'
  | 'view-medications'
  | 'view-appointments'
  | 'view-selected-records'
  | 'help-manage-medications'
  | 'full-caregiver'

export const CAREGIVER_SCOPE_LABELS: Record<CaregiverScope, string> = {
  'emergency-contact-only': 'Emergency contact only',
  'receive-selected-alerts': 'Receive selected alerts',
  'view-emergency-profile': 'View emergency profile',
  'view-medications': 'View medications',
  'view-appointments': 'View appointments',
  'view-selected-records': 'View selected records',
  'help-manage-medications': 'Help manage medications',
  'full-caregiver': 'Full caregiver access',
}

export type GrantStatus = 'invited' | 'active' | 'expired' | 'revoked'

export interface CaregiverGrant extends BaseRecord {
  userId: ID
  contactId: ID
  scopes: CaregiverScope[]
  status: GrantStatus
  invitedAt: string
  acceptedAt?: string
  expiresAt?: string
  /** One-time code the user shares with the invited person. Cleared once accepted. */
  acceptanceCode?: string
  acceptanceCodeHash?: string
  accessLog: Array<{ at: string; action: string }>
}

// ─── Consent, notifications, audit ───────────────────────────────────────────
export interface ConsentRecord extends BaseRecord {
  userId: ID
  type: string // e.g. 'emergency-profile-visible-when-locked'
  granted: boolean
  version: number
  textSummary: string
  grantedAt?: string
  revokedAt?: string
}

export type NotificationSeverity = 'info' | 'warning' | 'urgent'

export interface Notification extends BaseRecord {
  userId: ID
  type: string
  title: string
  body: string
  severity: NotificationSeverity
  scheduledFor?: string
  readAt?: string
}

export interface AuditEntry {
  seq: number
  at: string
  actor: 'user' | 'caregiver' | 'system'
  action: string
  entity?: string
  entityId?: ID
  meta?: Record<string, string | number | boolean | undefined> // never PHI
  prevHash: string
  hash: string
}

export interface VerificationRecord extends BaseRecord {
  userId: ID
  entityType: string
  entityId: ID
  verifiedBy: string
  verifiedAt: string
  method: 'clinician' | 'document' | 'user-attestation'
  note?: string
}

export interface SessionInfo {
  deviceId: string
  label: string
  createdAt: string
  lastSeenAt: string
  current: boolean
}

// ─── Vault envelope ──────────────────────────────────────────────────────────
export interface VaultSnapshot {
  version: 1
  exportedAt: string
  appName: 'personal-health-os'
  // Export contains plaintext JSON of every entity for user-held portability.
  data: Record<string, unknown[]>
}
