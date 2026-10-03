// ─── Locked screen ───────────────────────────────────────────────────────────
// While locked, ONLY the emergency profile the user approved is reachable —
// everything else stays encrypted and unreachable without the master password.

import { useEffect, useState } from 'react'
import { useHealth } from '@/store/useHealth'
import { Button, Callout, Card, PasswordField, Input } from '@/components/ui'
import { idb } from '@/lib/idb'

export function LockScreen() {
  const { unlock, unlockWithPin, unlockWithPasskey, deleteAccount, error, busy, lockedPreview } = useHealth()
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'password' | 'pin'>('password')
  const [hasPasskey, setHasPasskey] = useState(false)
  const [hasPin, setHasPin] = useState(false)
  const [showReset, setShowReset] = useState(false)

  useEffect(() => {
    void (async () => {
      const acct = await idb.get<{ passkeyWrappedVault?: string; wrappedVault?: string }>('kv', 'account')
      setHasPasskey(!!acct?.passkeyWrappedVault)
      setHasPin(!!acct?.wrappedVault)
    })()
  }, [])

  // The unlocked emergency subset, cached under the user's explicit consent.
  const emergencyAvailable = !!lockedPreview

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-5">
      <div className="text-center">
        <div aria-hidden="true" className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-3xl bg-ink-800 text-2xl text-white">🔒</div>
        <h1 className="text-2xl font-extrabold">Personal Health OS is locked</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">Your information stays on this device, encrypted.</p>
      </div>

      {emergencyAvailable && <LockedEmergencyCard />}

      <Card>
        {mode === 'password' ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void unlock(password)
            }}
          >
            <PasswordField
              label="Master password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              hint="Unlocks the full vault."
            />
            {error && <Callout tone="danger">{error}</Callout>}
            {busy && <p className="text-sm text-ink-500" role="status">{busy}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={!password || !!busy}>Unlock</Button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void unlockWithPin(pin)
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink-700 dark:text-ink-200">PIN</span>
              <Input
                inputMode="numeric"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="••••"
                className="text-center text-2xl tracking-[0.5em]"
                aria-label="PIN"
              />
            </label>
            {error && <Callout tone="danger">{error}</Callout>}
            {busy && <p className="text-sm text-ink-500" role="status">{busy}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={pin.length < 4 || !!busy}>Unlock with PIN</Button>
          </form>
        )}

        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
          {mode === 'password'
            ? hasPin && <Button variant="ghost" size="sm" onClick={() => setMode('pin')}>Use PIN instead</Button>
            : <Button variant="ghost" size="sm" onClick={() => setMode('password')}>Use master password</Button>}
        </div>
      </Card>

      {hasPasskey && (
        <Button variant="secondary" size="lg" onClick={() => void unlockWithPasskey()}>
          🔑 Unlock with passkey / biometrics
        </Button>
      )}

      <div className="text-center">
        <p className="text-xs text-ink-400">
          Forgot your master password? A local vault cannot be recovered without it — that is what keeps it private.
        </p>
        <button
          type="button"
          onClick={() => setShowReset((v) => !v)}
          className="mt-2 text-xs font-semibold text-danger-600 underline dark:text-danger-400"
          aria-expanded={showReset}
        >
          {showReset ? 'Keep my vault' : 'I cannot remember it — start over'}
        </button>
      </div>

      {showReset && (
        <Callout tone="danger" title="Erase this vault and start fresh?">
          <p>
            Every record, consent and audit entry on this device is permanently deleted. This cannot be undone and there
            is no recovery copy.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowReset(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={!!busy}
              onClick={() => {
                if (confirm('Permanently delete your vault and all health data on this device?')) void deleteAccount()
              }}
            >
              Erase and start over
            </Button>
          </div>
        </Callout>
      )}
    </div>
  )
}

function LockedEmergencyCard() {
  const lockedPreview = useHealth((s) => s.lockedPreview)
  const enterEmergencyFromLock = useHealth((s) => s.enterEmergencyFromLock)
  const updated = lockedPreview?.generatedAt
  return (
    <Card className="border-danger-600/40">
      <p className="text-sm font-bold">🆘 Emergency profile available</p>
      <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
        You chose to keep this reachable without unlocking.
        {lockedPreview?.includedSections.length
          ? ` Includes: ${lockedPreview.includedSections.join(', ')}.`
          : ' Name only.'}
        {updated ? ` Prepared ${new Date(updated).toLocaleString()}.` : ''}
      </p>
      <Button variant="danger" size="xl" className="mt-3 w-full text-xl" onClick={enterEmergencyFromLock}>
        🆘 Open Emergency Mode
      </Button>
      <p className="mt-2 text-xs text-ink-400">
        Your full record, medications history, documents and caregivers stay locked.
      </p>
    </Card>
  )
}
