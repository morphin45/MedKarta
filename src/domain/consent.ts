// ─── Consent catalog ─────────────────────────────────────────────────────────
// Every sharing/sensitive feature maps to an explicit, revocable consent with
// a plain-language description. Features stay off until the user opts in.

export type ConsentType =
  | 'emergency-visible-when-locked'
  | 'share-link-enabled'
  | 'qr-enabled'
  | 'alerts-to-caregivers'
  | 'reminder-notifications'
  | 'ocr-processing'

export interface ConsentDefinition {
  type: ConsentType
  title: string
  summary: string
  requiredAtOnboarding: boolean
}

export const CONSENT_CATALOG: ConsentDefinition[] = [
  {
    type: 'emergency-visible-when-locked',
    title: 'Show emergency profile when the app is locked',
    summary: 'Lets someone with your unlocked phone (or a first responder using Emergency Mode) see only the emergency fields you approved — nothing else.',
    requiredAtOnboarding: true,
  },
  {
    type: 'share-link-enabled',
    title: 'Allow creating shareable emergency links',
    summary: 'Creates a view-only link containing only your approved emergency fields. Anyone with the link can read it — you can delete links at any time.',
    requiredAtOnboarding: false,
  },
  {
    type: 'qr-enabled',
    title: 'Allow emergency QR code',
    summary: 'Renders your approved emergency fields as a scannable code you can print or keep on a lock screen. Photographing it gives only what you approved.',
    requiredAtOnboarding: false,
  },
  {
    type: 'alerts-to-caregivers',
    title: 'Send selected alerts to caregivers',
    summary: 'Allows app alerts (like missed medications) to be shared with people you granted that specific permission. Off by default.',
    requiredAtOnboarding: false,
  },
  {
    type: 'reminder-notifications',
    title: 'Medication and refill reminders',
    summary: 'Shows reminders inside the app (and as device notifications, if you allow it) at the times you set.',
    requiredAtOnboarding: false,
  },
  {
    type: 'ocr-processing',
    title: 'Extract details from uploaded documents',
    summary: 'Runs entirely on this device. Extracted text always waits in “Needs review” until you confirm it.',
    requiredAtOnboarding: false,
  },
]

export const CONSENT_VERSION = 1

export function consentById(type: ConsentType): ConsentDefinition | undefined {
  return CONSENT_CATALOG.find((c) => c.type === type)
}
