// ─── Central store: auth, encrypted vault, actions ───────────────────────────
// The entire entity map is serialized to JSON, encrypted with AES-GCM, and
// persisted as one blob. The vault key exists only in memory while unlocked.

import { create } from 'zustand'
import type {
  Allergy, Appointment, AuditEntry, CaregiverGrant, ConsentRecord,
  Doctor, EmergencyContact, EmergencyProfile, HealthDocument, MedicalCondition,
  Medication, MedicationLog, Notification, ResolvedEmergencyProfile, TimelineEntry,
  User, UserProfile, VerificationRecord, ID,
} from '@/types'
import {
  deriveKey, encryptWithKey, decryptWithKey, sha256Hex, wrapKeyWithSecret, unwrapKeyWithSecret, PBKDF2_ITERATIONS,
} from '@/lib/crypto'
import { idb, touchSession, thisDeviceId, thisDeviceLabel } from '@/lib/idb'
import { saveLockedPreview, loadLockedPreview, clearLockedPreview, clearDeviceKey } from '@/lib/lockedCache'
import { buildDemoData } from '@/data/seed'
import { appendAudit, verifyAuditChain } from '@/domain/audit'
import { nowIso, uid } from '@/lib/util'
import { resolveEmergencyProfile, mayCacheForLockScreen, type EmergencyInputs } from '@/domain/emergency'
import { CONSENT_VERSION, CONSENT_CATALOG, type ConsentType } from '@/domain/consent'
import { normalizeScopes } from '@/domain/permissions'

export interface Entities {
  users: User[]
  userProfiles: UserProfile[]
  emergencyProfiles: EmergencyProfile[]
  allergies: Allergy[]
  medicalConditions: MedicalCondition[]
  medications: Medication[]
  medicationLogs: MedicationLog[]
  doctors: Doctor[]
  facilities: Array<{ id: ID; userId: ID; name: string; type?: string; address?: string; phone?: string; createdAt: string; updatedAt: string; deletedAt?: string }>
  appointments: Appointment[]
  timelineEntries: TimelineEntry[]
  healthDocuments: HealthDocument[]
  emergencyContacts: EmergencyContact[]
  caregiverGrants: CaregiverGrant[]
  consents: ConsentRecord[]
  notifications: Notification[]
  auditLog: AuditEntry[]
  verificationRecords: VerificationRecord[]
}

export function emptyEntities(): Entities {
  return {
    users: [], userProfiles: [], emergencyProfiles: [], allergies: [], medicalConditions: [],
    medications: [], medicationLogs: [], doctors: [], facilities: [], appointments: [],
    timelineEntries: [], healthDocuments: [], emergencyContacts: [], caregiverGrants: [],
    consents: [], notifications: [], auditLog: [], verificationRecords: [],
  }
}

export type Screen =
  | 'welcome' | 'create-account' | 'onboarding-consent' | 'onboarding-emergency' | 'dashboard'
  | 'emergency' | 'emergency-setup' | 'memory' | 'medications' | 'medication-edit' | 'records'
  | 'visits' | 'contacts' | 'notifications' | 'settings' | 'security' | 'data' | 'menu'

type Phase = 'boot' | 'setup' | 'locked' | 'unlocked' | 'emergency-locked'

interface ShareLink {
  id: string
  createdAt: string
  token: string
  revoked: boolean
}

interface VaultState {
  phase: Phase
  screen: Screen
  error: string | null
  busy: string | null
  vaultKey: CryptoKey | null
  entities: Entities
  lockedPreview: ResolvedEmergencyProfile | null
  lastActivityAt: number
  shareLinks: ShareLink[]
  demoMode: boolean

  // boot / auth
  boot: () => Promise<void>
  createAccount: (name: string, email: string, password: string, demo: boolean) => Promise<void>
  unlock: (password: string) => Promise<void>
  unlockWithPin: (pin: string) => Promise<void>
  unlockWithPasskey: () => Promise<void>
  setupPin: (pin: string) => Promise<void>
  setupPasskey: () => Promise<void>
  removePin: () => Promise<void>
  removePasskey: () => Promise<void>
  lock: () => void
  setScreen: (s: Screen) => void
  touch: () => void
  enterEmergencyFromLock: () => void
  refreshLockedPreview: () => Promise<void>

  // emergency (works in emergency-locked phase)
  resolveEmergency: () => ResolvedEmergencyProfile | null
  saveEmergency: (patch: Partial<EmergencyProfile>) => Promise<void>
  createShareLink: () => Promise<ShareLink>
  revokeShareLink: (id: string) => Promise<void>

  // consent
  setConsent: (type: ConsentType, granted: boolean) => Promise<void>

  // generic entity ops
  upsert: <K extends keyof Entities>(key: K, item: Entities[K][number]) => Promise<void>
  softDelete: <K extends keyof Entities>(key: K, id: ID) => Promise<void>

  // helpers
  logAudit: (action: string, entity?: string, entityId?: string, meta?: Record<string, string | number | boolean | undefined>) => Promise<void>
  markAllNotificationsRead: () => Promise<void>
  addMedicationLog: (medicationId: string, time: string, status: 'taken' | 'skipped' | 'missed', note?: string) => Promise<void>
  generatePrepSummary: (appointmentId: string, goals?: string) => Promise<void>
  exportVaultJson: () => string
  exportSummaryText: () => string
  verifyAudit: () => Promise<boolean>
  deleteAccount: () => Promise<void>
  factoryResetDemo: () => Promise<void>
}

const VERIFIER_PREFIX = 'ph-os-v1:'

async function makeVerifier(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const stretched = await deriveKey(password, salt, iterations)
  const raw = await crypto.subtle.exportKey('raw', stretched)
  return VERIFIER_PREFIX + (await sha256Hex(Array.from(new Uint8Array(raw)).join(',')))
}

function hasAccount(e: Entities): boolean {
  return e.users.length > 0
}

export const useHealth = create<VaultState>((set, get) => ({
  phase: 'boot',
  screen: 'welcome',
  error: null,
  busy: null,
  vaultKey: null,
  entities: emptyEntities(),
  lockedPreview: null,
  lastActivityAt: Date.now(),
  shareLinks: [],
  demoMode: false,

  async boot() {
    try {
      const env = await idb.get<{ id: string; kdf: { iterations: number; saltB64: string }; verifierHash: string; vault: string; updatedAt: string }>('kv', 'account')
      if (!env) {
        set({ phase: 'setup', screen: 'welcome' })
        return
      }
      // Restore the consent-gated emergency preview so Emergency Mode works
      // from the lock screen even after a reload.
      const preview = await loadLockedPreview<ResolvedEmergencyProfile>()
      set({ phase: 'locked', screen: 'welcome', lockedPreview: preview })
      get().touch()
    } catch {
      set({ phase: 'setup', screen: 'welcome' })
    }
  },

  async createAccount(name, email, password, demo) {
    set({ busy: 'Creating your encrypted vault…', error: null })
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const verifier = await makeVerifier(password, salt, PBKDF2_ITERATIONS)
      const key = await deriveKey(password, salt, PBKDF2_ITERATIONS)

      const entities = emptyEntities()
      const userId = uid('user')
      const now = nowIso()
      entities.users = [{ id: userId, email, name, autoLockMinutes: 15, textScale: 100, theme: 'system', createdAt: now, updatedAt: now }]
      entities.userProfiles = [{
        id: uid('prof'), userId, bloodTypeVerified: false, organDonorStatus: 'undecided',
        includeOrganDonorInEmergency: false, preferredLanguage: 'English', accessibilityNeeds: [],
        createdAt: now, updatedAt: now,
      }]
      entities.emergencyProfiles = [{
        id: uid('em'), userId,
        includeName: true, includePreferredName: false, includeDob: false, includeAddress: false,
        includeBloodType: false, includeConditions: false, includeMedications: false, includeAllergies: false,
        includeDevices: false, includePhysicians: false, includeContacts: false, includeAdvanceDirective: false,
        includeOrganDonor: false, includeAccessibilityNeeds: false, includeLanguage: false,
        shareWhenLocked: false, emergencyNotes: '', advanceDirectiveNote: '', emergencyDevices: [],
        lastUpdatedAt: now, createdAt: now, updatedAt: now,
      }]
      entities.consents = CONSENT_CATALOG.map((c) => ({
        id: uid('cons'), userId, type: c.type,
        // Demo data models someone who already finished onboarding, so the
        // onboarding consent is granted so the lock-screen emergency card is
        // demonstrable. Real accounts start with everything off.
        granted: demo ? c.requiredAtOnboarding : false,
        version: CONSENT_VERSION, textSummary: c.summary,
        grantedAt: demo && c.requiredAtOnboarding ? now : undefined,
        createdAt: now, updatedAt: now,
      }))

      if (demo) {
        const d = buildDemoData()
        d.user.id = userId
        d.user.email = email
        d.user.name = name
        d.profile.userId = userId
        d.emergency.userId = userId
        const relink = <T extends { userId: string }>(rows: T[]) => rows.map((r) => ({ ...r, userId }))
        entities.allergies = relink(d.allergies)
        entities.medicalConditions = relink(d.conditions)
        entities.medications = relink(d.medications)
        entities.timelineEntries = relink(d.timeline)
        entities.doctors = relink(d.doctors)
        entities.emergencyContacts = relink(d.contacts)
        entities.healthDocuments = relink(d.documents)
        entities.appointments = relink(d.appointments)
        entities.emergencyProfiles = [{ ...d.emergency, userId }]
        // The demo profile carries DOB, verified blood type and accessibility
        // needs — without this the emergency card silently omits them.
        entities.userProfiles = [{ ...d.profile, userId }]
      }

      const vaultJson = JSON.stringify(entities)
      const vault = await encryptWithKey(key, vaultJson)
      const envelope = {
        id: 'account', kdf: { iterations: PBKDF2_ITERATIONS, saltB64: btoa(String.fromCharCode(...salt)) },
        verifierHash: verifier, vault, updatedAt: now,
      }
      await idb.put('kv', envelope)
      await touchSession(thisDeviceId(), thisDeviceLabel())
      const audit = await appendAudit([], { actor: 'user', action: demo ? 'vault.created (demo data)' : 'vault.created' })
      entities.auditLog = audit
      const auditV2 = await encryptWithKey(key, JSON.stringify({ ...entities, auditLog: audit }))
      await idb.put('kv', { ...envelope, vault: auditV2 })

      set({ entities, vaultKey: key, phase: 'unlocked', screen: demo ? 'dashboard' : 'onboarding-consent', demoMode: demo, busy: null, lastActivityAt: Date.now() })
      await get().refreshLockedPreview()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Could not create account', busy: null })
    }
  },

  async unlock(password) {
    set({ busy: 'Unlocking…', error: null })
    try {
      const env = await idb.get<{ id: string; kdf: { iterations: number; saltB64: string }; verifierHash: string; vault: string }>('kv', 'account')
      if (!env) throw new Error('No account found on this device.')
      const salt = Uint8Array.from(atob(env.kdf.saltB64), (c) => c.charCodeAt(0))
      const candidate = await makeVerifier(password, salt, env.kdf.iterations)
      if (candidate !== env.verifierHash) throw new Error('Incorrect master password.')
      const key = await deriveKey(password, salt, env.kdf.iterations)
      const json = await decryptWithKey(key, env.vault)
      const entities = { ...emptyEntities(), ...(JSON.parse(json) as Entities) }
      await touchSession(thisDeviceId(), thisDeviceLabel())
      set({ entities, vaultKey: key, phase: 'unlocked', screen: 'dashboard', error: null, busy: null, lastActivityAt: Date.now() })
      await get().refreshLockedPreview()
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unlock failed', busy: null })
    }
  },

  async unlockWithPin(pin) {
    set({ busy: 'Unlocking…', error: null })
    try {
      const env = await idb.get<{ wrappedVault?: string }>('kv', 'account')
      if (!env?.wrappedVault) throw new Error('No PIN is set up.')
      const key = await unwrapKeyWithSecret(env.wrappedVault, pinStretch(pin))
      const rawEnv = await idb.get<{ vault: string }>('kv', 'account')
      const json = await decryptWithKey(key, rawEnv!.vault)
      const entities = { ...emptyEntities(), ...(JSON.parse(json) as Entities) }
      await touchSession(thisDeviceId(), thisDeviceLabel())
      set({ entities, vaultKey: key, phase: 'unlocked', screen: 'dashboard', error: null, busy: null, lastActivityAt: Date.now() })
      await get().refreshLockedPreview()
    } catch {
      set({ error: 'Incorrect PIN.', busy: null })
    }
  },

  async unlockWithPasskey() {
    set({ busy: 'Waiting for your passkey…', error: null })
    try {
      const env = await idb.get<{ passkeyWrappedVault?: string; passkeyCredentialId?: string }>('kv', 'account')
      if (!env?.passkeyWrappedVault || !env.passkeyCredentialId) throw new Error('No passkey is set up.')
      const salt = new TextEncoder().encode('personal-health-os-prf')
      const { getPrfSecret } = await import('@/lib/passkey')
      const secret = await getPrfSecret(env.passkeyCredentialId, salt)
      const key = await unwrapKeyWithSecret(env.passkeyWrappedVault, secret)
      const rawEnv = await idb.get<{ vault: string }>('kv', 'account')
      const json = await decryptWithKey(key, rawEnv!.vault)
      const entities = { ...emptyEntities(), ...(JSON.parse(json) as Entities) }
      set({ entities, vaultKey: key, phase: 'unlocked', screen: 'dashboard', error: null, busy: null, lastActivityAt: Date.now() })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Passkey unlock failed', busy: null })
    }
  },

  async setupPin(pin) {
    const key = get().vaultKey
    if (!key) return
    const wrapped = await wrapKeyWithSecret(key, pinStretch(pin))
    const env = await idb.get<Record<string, unknown>>('kv', 'account')
    await idb.put('kv', { ...env, wrappedVault: wrapped })
    await get().logAudit('security.pin_enabled', 'security')
    set({ entities: { ...get().entities } })
  },

  async setupPasskey() {
    const key = get().vaultKey
    if (!key) return
    const { createPasskeyWithPrf } = await import('@/lib/passkey')
    const user = get().entities.users[0]
    const res = await createPasskeyWithPrf(user?.name ?? 'Health OS user')
    const wrapped = await wrapKeyWithSecret(key, res.prfSecretB64)
    const env = await idb.get<Record<string, unknown>>('kv', 'account')
    await idb.put('kv', { ...env, passkeyWrappedVault: wrapped, passkeyCredentialId: res.credentialIdB64u })
    await get().logAudit('security.passkey_enabled', 'security')
    set({ entities: { ...get().entities } })
  },

  async removePin() {
    const env = await idb.get<Record<string, unknown>>('kv', 'account')
    const { wrappedVault: _w, ...rest } = env ?? {}
    void _w
    await idb.put('kv', rest)
    await get().logAudit('security.pin_removed', 'security')
    set({ entities: { ...get().entities } })
  },

  async removePasskey() {
    const env = await idb.get<Record<string, unknown>>('kv', 'account')
    const { passkeyWrappedVault: _p, passkeyCredentialId: _c, ...rest } = env ?? {}
    void _p
    void _c
    await idb.put('kv', rest)
    await get().logAudit('security.passkey_removed', 'security')
    set({ entities: { ...get().entities } })
  },

  lock() {
    // Keep lockedPreview: it is the approved emergency subset that must remain
    // reachable from the lock screen. Everything else leaves memory.
    set({ phase: 'locked', vaultKey: null, entities: emptyEntities(), screen: 'welcome' })
  },

  setScreen(screen) {
    set({ screen, error: null })
    get().touch()
  },

  touch() {
    set({ lastActivityAt: Date.now() })
  },

  enterEmergencyFromLock() {
    const e = get().entities
    const resolved = e.users.length ? get().resolveEmergency() : null
    set({ phase: 'emergency-locked', lockedPreview: resolved ?? get().lockedPreview, screen: 'emergency' })
  },

  /** Recompute the lock-screen cache from the current consent + emergency profile. */
  async refreshLockedPreview() {
    const e = get().entities
    const user = e.users[0]
    const emergency = e.emergencyProfiles.find((p) => p.userId === user?.id)
    const consent = e.consents.find((c) => c.type === 'emergency-visible-when-locked')?.granted ?? false
    const allowed = mayCacheForLockScreen({
      hasUser: !!user,
      hasEmergencyProfile: !!emergency,
      shareWhenLocked: emergency?.shareWhenLocked ?? false,
      consentGranted: consent,
    })
    if (!allowed) {
      await clearLockedPreview()
      set({ lockedPreview: null })
      return
    }
    const resolved = get().resolveEmergency()
    if (!resolved) return
    await saveLockedPreview(resolved)
    set({ lockedPreview: resolved })
  },

  resolveEmergency(): ResolvedEmergencyProfile | null {
    const e = get().entities
    if (!hasAccount(e)) return null
    const user = e.users[0]!
    const profile = e.userProfiles.find((p) => p.userId === user.id)
    const emergency = e.emergencyProfiles.find((p) => p.userId === user.id)
    if (!emergency) return null
    const inputs: EmergencyInputs = {
      user,
      profile,
      emergency,
      allergies: e.allergies,
      medications: e.medications,
      conditions: e.medicalConditions,
      doctors: e.doctors.filter((d) => !d.deletedAt),
      contacts: e.emergencyContacts,
    }
    return resolveEmergencyProfile(inputs)
  },

  async saveEmergency(patch) {
    const e = get().entities
    const emergency = e.emergencyProfiles[0]
    if (!emergency) return
    const updated: EmergencyProfile = { ...emergency, ...patch, lastUpdatedAt: nowIso(), updatedAt: nowIso() }
    await get().upsert('emergencyProfiles', updated)
    await get().logAudit('emergency.updated', 'emergencyProfile', emergency.id)
  },

  async createShareLink() {
    const token = uid('lnk')
    const link: ShareLink = { id: uid('share'), createdAt: nowIso(), token, revoked: false }
    set({ shareLinks: [...get().shareLinks, link] })
    await get().logAudit('emergency.share_link_created', 'emergencyProfile')
    return link
  },

  async revokeShareLink(id) {
    set({ shareLinks: get().shareLinks.map((l) => (l.id === id ? { ...l, revoked: true } : l)) })
    await get().logAudit('emergency.share_link_revoked', 'emergencyProfile')
  },

  async setConsent(type, granted) {
    const e = get().entities
    const c = e.consents.find((x) => x.type === type)
    const now = nowIso()
    if (c) {
      const updated: ConsentRecord = { ...c, granted, version: CONSENT_VERSION, grantedAt: granted ? now : c.grantedAt, revokedAt: granted ? c.revokedAt : now, updatedAt: now }
      await get().upsert('consents', updated)
    } else {
      const def = CONSENT_CATALOG.find((x) => x.type === type)
      await get().upsert('consents', {
        id: uid('cons'), userId: e.users[0]?.id ?? 'self', type, granted, version: CONSENT_VERSION,
        textSummary: def?.summary ?? '', grantedAt: granted ? now : undefined, revokedAt: granted ? undefined : now,
        createdAt: now, updatedAt: now,
      })
    }
    await get().logAudit(granted ? 'consent.granted' : 'consent.revoked', 'consent', type)
    if (type === 'emergency-visible-when-locked') {
      const em = e.emergencyProfiles[0]
      if (em) await get().saveEmergency({ shareWhenLocked: granted })
    }
  },

  async upsert(key, item) {
    const e = get().entities
    const list = e[key] as unknown as Array<Record<string, unknown>>
    const idx = list.findIndex((x) => x.id === (item as unknown as { id: string }).id)
    const stamped = { ...(item as unknown as Record<string, unknown>), updatedAt: nowIso() }
    const next = idx >= 0 ? list.map((x, i) => (i === idx ? stamped : x)) : [...list, stamped]
    const entities = { ...e, [key]: next } as Entities
    await persist(set, get, entities, key === 'auditLog' ? 'vault.saved' : 'record.saved', key as string, (item as unknown as { id: string }).id)
  },

  async softDelete(key, id) {
    const e = get().entities
    const list = e[key] as unknown as Array<Record<string, unknown>>
    const next = list.map((x) => (x.id === id && !x.deletedAt ? { ...x, deletedAt: nowIso(), updatedAt: nowIso() } : x))
    const entities = { ...e, [key]: next } as Entities
    await persist(set, get, entities, 'record.soft_deleted', key as string, id)
  },

  async logAudit(action, entity, entityId, meta) {
    const e = get().entities
    const log = await appendAudit(e.auditLog, { actor: 'user', action, entity, entityId, meta })
    await persist(set, get, { ...e, auditLog: log }, 'audit.appended')
  },

  async markAllNotificationsRead() {
    const e = get().entities
    const notifications = e.notifications.map((n) => (n.readAt ? n : { ...n, readAt: nowIso() }))
    await persist(set, get, { ...e, notifications }, 'notifications.read')
  },

  async addMedicationLog(medicationId, time, status, note) {
    const e = get().entities
    const today = nowIso().slice(0, 10)
    const existing = e.medicationLogs.find((l) => l.medicationId === medicationId && l.date === today && l.time === time && !l.deletedAt)
    const log: MedicationLog = existing
      ? { ...existing, status, note, updatedAt: nowIso() }
      : { id: uid('mlog'), userId: e.users[0]?.id ?? 'self', medicationId, date: today, time, status, note, createdAt: nowIso(), updatedAt: nowIso() }
    const others = e.medicationLogs.filter((l) => l.id !== log.id)
    const entities = { ...e, medicationLogs: [...others, log] }
    await persist(set, get, entities, 'medication.logged', 'medicationLog', medicationId)
  },

  async generatePrepSummary(appointmentId, goals) {
    const e = get().entities
    const appt = e.appointments.find((a) => a.id === appointmentId)
    if (!appt) return
    const { buildVisitPrepSummary } = await import('@/domain/visits')
    const withGoals: Appointment = goals === undefined ? appt : { ...appt, prepGoals: goals }
    const summary = buildVisitPrepSummary({
      appointment: withGoals,
      medications: e.medications,
      allergies: e.allergies,
      conditions: e.medicalConditions,
      timeline: e.timelineEntries,
    })
    const updated: Appointment = { ...withGoals, prepSummary: { text: summary.text, generatedAt: summary.generatedAt, sourceIds: summary.sourceIds } }
    await get().upsert('appointments', updated)
    await get().logAudit('visit.prep_generated', 'appointment', appointmentId)
  },

  exportVaultJson(): string {
    const snap = {
      version: 1,
      exportedAt: nowIso(),
      appName: 'personal-health-os',
      data: get().entities as unknown as Record<string, unknown[]>,
    }
    return JSON.stringify(snap, null, 2)
  },

  exportSummaryText(): string {
    const e = get().entities
    const L: string[] = []
    const user = e.users[0]
    const profile = e.userProfiles[0]
    L.push('PERSONAL HEALTH SUMMARY')
    L.push(`Prepared ${new Date().toLocaleDateString()} — reflects user-entered information; may be incomplete.`)
    if (user) L.push(`Name: ${user.name}${user.preferredName ? ` (prefers ${user.preferredName})` : ''}`)
    if (profile?.dateOfBirth) L.push(`DOB: ${profile.dateOfBirth}`)
    if (profile?.bloodType) L.push(`Blood type: ${profile.bloodType}${profile.bloodTypeVerified ? ' (verified)' : ' (NOT verified)'}`)
    const sec = (title: string, rows: string[]) => { L.push('', title); if (!rows.length) L.push('  (none)'); for (const r of rows) L.push(`  • ${r}`) }
    sec('ALLERGIES', e.allergies.filter((a) => !a.deletedAt).map((a) => `${a.substance} — ${a.reaction ?? 'reaction unknown'} [${a.severity}${a.verified ? ', verified' : ''}]`))
    sec('CONDITIONS', e.medicalConditions.filter((c) => !c.deletedAt).map((c) => `${c.name} [${c.status}]`))
    sec('MEDICATIONS', e.medications.filter((m) => !m.deletedAt && m.status === 'active').map((m) => `${m.name} ${m.dose} — ${m.frequency}`))
    sec('ALLERGIES-DUP', [])
    const tl = [...e.timelineEntries].filter((t) => !t.deletedAt).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40)
    sec('RECENT TIMELINE', tl.map((t) => `${t.date} — ${t.title} [${t.category}]`))
    return L.join('\n')
  },

  async verifyAudit() {
    return (await verifyAuditChain(get().entities.auditLog)).ok
  },

  async deleteAccount() {
    set({ busy: 'Deleting your vault…' })
    await idb.clear('kv')
    await idb.clear('meta')
    await clearLockedPreview()
    await clearDeviceKey()
    localStorage.removeItem('ph-os-device-id')
    set({ phase: 'setup', screen: 'welcome', entities: emptyEntities(), vaultKey: null, shareLinks: [], demoMode: false, busy: null })
  },

  async factoryResetDemo() {
    const user = get().entities.users[0]
    if (!user) return
    const { entities } = get()
    const fresh = buildDemoData()
    fresh.user.id = user.id
    fresh.user.email = user.email
    fresh.user.name = user.name
    const relink = <T extends { userId: string }>(rows: T[]) => rows.map((r) => ({ ...r, userId: user.id }))
    const next: Entities = {
      ...entities,
      allergies: relink(fresh.allergies),
      medicalConditions: relink(fresh.conditions),
      medications: relink(fresh.medications),
      timelineEntries: relink(fresh.timeline),
      doctors: relink(fresh.doctors),
      emergencyContacts: relink(fresh.contacts),
      healthDocuments: relink(fresh.documents),
      appointments: relink(fresh.appointments),
      emergencyProfiles: [{ ...fresh.emergency, userId: user.id }],
      userProfiles: [{ ...fresh.profile, userId: user.id }],
    }
    await persist(set, get, next, 'demo.reset')
  },
}))

async function persist(
  set: (partial: Partial<VaultState> | ((s: VaultState) => Partial<VaultState>)) => void,
  get: () => VaultState,
  entities: Entities,
  action: string,
  entity?: string,
  entityId?: string,
): Promise<void> {
  const key = get().vaultKey
  if (!key) return
  let log = entities.auditLog
  if (action !== 'audit.appended') log = await appendAudit(log, { actor: 'user', action, entity, entityId })
  const withLog = { ...entities, auditLog: log }
  const json = JSON.stringify(withLog)
  const vault = await encryptWithKey(key, json)
  const env = await idb.get<Record<string, unknown>>('kv', 'account')
  await idb.put('kv', { ...env, vault, updatedAt: nowIso() })
  set({ entities: withLog })
  // Keep the lock-screen emergency cache in step with the vault (consent-gated).
  await get().refreshLockedPreview()
}

function pinStretch(pin: string): string {
  return `ph-os-pin:${pin}`
}

// Re-export for screens
export { normalizeScopes }
