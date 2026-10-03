// ─── Emergency profile setup ─────────────────────────────────────────────────
// Explicit, per-field consent. Every toggle maps to one thing responders see.

import { useHealth } from '@/store/useHealth'
import { Button, Callout, Card, Field, SectionTitle, StepProgress, Textarea, Toggle, Badge } from '@/components/ui'
import { EMERGENCY_STALE_AFTER_DAYS } from '@/domain/emergency'
import { daysUntil, fmtDateTime } from '@/lib/util'

export function EmergencySetup({ mode = 'setup' }: { mode?: 'onboarding' | 'setup' }) {
  const { entities, saveEmergency, setScreen } = useHealth()
  const em = entities.emergencyProfiles[0]
  const profile = entities.userProfiles[0]
  const contacts = entities.emergencyContacts.filter((c) => !c.deletedAt)
  const lockConsent = entities.consents.find((c) => c.type === 'emergency-visible-when-locked')?.granted ?? false
  if (!em) return null

  const upd = (patch: Parameters<typeof saveEmergency>[0]) => void saveEmergency(patch)

  const staleDays = daysUntil(em.lastUpdatedAt) * -1
  const stale = staleDays > EMERGENCY_STALE_AFTER_DAYS

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {mode === 'onboarding' && (
        <StepProgress step={3} of={3} label="Emergency Profile" pct={100} />
      )}

      <SectionTitle sub="Choose exactly what appears in Emergency Mode, share links, QR codes and the printed card. Nothing is shared unless you switch it on.">
        {mode === 'onboarding' ? 'Build your emergency profile' : 'Emergency profile setup'}
      </SectionTitle>

      <Card>
        <SectionTitle sub="Shown at the top of the emergency card">Who I am</SectionTitle>
        <div className="divide-y divide-ink-100 dark:divide-ink-800">
          <Toggle checked={em.includeName} onChange={(v) => upd({ includeName: v })} label="Show my name" />
          <Toggle checked={em.includePreferredName} onChange={(v) => upd({ includePreferredName: v })} label="Show the name I prefer to be called" hint={entities.users[0]?.preferredName || 'Set a preferred name in Settings'} />
          <Toggle checked={em.includeDob} onChange={(v) => upd({ includeDob: v })} label="Show my date of birth / age" hint={profile?.dateOfBirth ? `On file: ${profile.dateOfBirth}` : 'No date of birth on file yet'} />
          <Toggle checked={em.includeLanguage} onChange={(v) => upd({ includeLanguage: v })} label="Show my preferred language" hint={profile?.preferredLanguage} />
          <Toggle checked={em.includeAccessibilityNeeds} onChange={(v) => upd({ includeAccessibilityNeeds: v })} label="Show my accessibility needs" hint={profile?.accessibilityNeeds.join(', ') || 'None recorded'} />
        </div>
      </Card>

      <Card>
        <SectionTitle sub="The medical picture a clinician would want first">Medical basics</SectionTitle>
        <div className="divide-y divide-ink-100 dark:divide-ink-800">
          <Toggle
            checked={em.includeAllergies}
            onChange={(v) => upd({ includeAllergies: v })}
            label="Show allergies"
            hint={`${entities.allergies.filter((a) => !a.deletedAt).length} recorded; verified ones are marked`}
          />
          <Toggle checked={em.includeMedications} onChange={(v) => upd({ includeMedications: v })} label="Show current medications" hint={`${entities.medications.filter((m) => m.status === 'active' && !m.deletedAt).length} active`} />
          <Toggle checked={em.includeConditions} onChange={(v) => upd({ includeConditions: v })} label="Show ongoing medical conditions" hint={`${entities.medicalConditions.filter((c) => c.status !== 'resolved' && !c.deletedAt).length} active/managed`} />
          <Toggle
            checked={em.includeBloodType && profile?.bloodTypeVerified === true}
            onChange={(v) => upd({ includeBloodType: v })}
            label="Show blood type (only if verified)"
            hint={profile?.bloodTypeVerified ? `Verified: ${profile.bloodType}` : profile?.bloodType ? `“${profile.bloodType}” is entered but NOT verified — enable after a clinician confirms it` : 'No blood type on file'}
          />
          <Toggle checked={em.includeDevices} onChange={(v) => upd({ includeDevices: v })} label="Show implanted devices" hint={em.emergencyDevices.join('; ') || 'None listed yet — add below'} />
          <Toggle checked={em.includePhysicians} onChange={(v) => upd({ includePhysicians: v })} label="Show my physicians" hint={`${entities.doctors.filter((d) => !d.deletedAt).length} recorded`} />
        </div>
        <div className="mt-3 space-y-2">
          <Field label="Implanted devices / medical hardware (one per line)">
            <Textarea
              value={em.emergencyDevices.join('\n')}
              onChange={(e) => upd({ emergencyDevices: e.target.value.split('\n') })}
              placeholder={'Cardiac stent (2019)\nCochlear implant (left ear)'}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Who should be called, and how you want decisions handled">When I cannot speak for myself</SectionTitle>
        <div className="divide-y divide-ink-100 dark:divide-ink-800">
          <Toggle checked={em.includeContacts} onChange={(v) => upd({ includeContacts: v })} label="Show emergency contacts" hint={`${contacts.filter((c) => c.isEmergencyContact).length} people marked as emergency contacts`} />
          <Toggle checked={em.includeAdvanceDirective} onChange={(v) => upd({ includeAdvanceDirective: v })} label="Show advance directive / care preferences" />
          <Toggle checked={em.includeOrganDonor && profile?.organDonorStatus === 'registered-donor'} onChange={(v) => upd({ includeOrganDonor: v })} label="Show organ donor status" hint="Only shown if you marked yourself a registered donor" />
        </div>
        <div className="mt-3 space-y-2">
          <Field label="Advance directive & care preferences" hint="Who decides for you; where you prefer to be treated; anything responders should know.">
            <Textarea value={em.advanceDirectiveNote} onChange={(e) => upd({ advanceDirectiveNote: e.target.value })} placeholder="e.g. Health care power of attorney: Elena Santos…" />
          </Field>
          <Field label="Emergency notes" hint="Short, practical notes only — this may be read under stress.">
            <Textarea value={em.emergencyNotes} onChange={(e) => upd({ emergencyNotes: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle sub="Controls when the app is locked">Lock screen access</SectionTitle>
        <Toggle
          checked={em.shareWhenLocked}
          onChange={(v) => { upd({ shareWhenLocked: v }); void useHealth.getState().setConsent('emergency-visible-when-locked', v) }}
          label="Allow Emergency Mode without unlocking"
          hint="Recommended for first responders’ access, but entirely your choice. Only approved fields are shown."
        />
        {em.shareWhenLocked && !lockConsent && (
          <Callout tone="warn" title="One more permission is needed">
            The privacy consent “Show emergency profile when the app is locked” is still off, so nothing will be
            reachable while locked.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void useHealth.getState().setConsent('emergency-visible-when-locked', true)}
            >
              Grant it now
            </button>
          </Callout>
        )}
        {em.shareWhenLocked && lockConsent && (
          <Callout tone="good" title="Emergency Mode works from the lock screen">
            Anyone can open Emergency Mode on this device and see only the fields approved above — the rest of your
            record stays encrypted.
          </Callout>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Badge tone={stale ? 'warn' : 'good'}>
          Last updated {fmtDateTime(em.lastUpdatedAt)}{stale ? ` — ${staleDays} days ago (over ${EMERGENCY_STALE_AFTER_DAYS}-day guideline)` : ''}
        </Badge>
        {mode === 'onboarding' ? (
          <Button size="lg" onClick={() => setScreen('dashboard')}>Finish setup</Button>
        ) : (
          <Button size="lg" onClick={() => setScreen('emergency')}>Preview Emergency Mode</Button>
        )}
      </div>

      <Callout tone="info" title="Why so many switches?">
        Emergency information is only useful if it is trusted and current. You decide exactly what is included — and the
        app always labels what is verified versus what you entered yourself.
      </Callout>
    </div>
  )
}
