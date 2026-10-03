// ─── App root: screen router, auto-lock, boot ────────────────────────────────

import { useEffect } from 'react'
import { useHealth } from '@/store/useHealth'
import { Layout } from '@/components/Layout'
import { Welcome, CreateAccount, OnboardingConsent, OnboardingEmergencySetup } from '@/views/Welcome'
import { LockScreen } from '@/views/Lock'
import { EmergencyMode } from '@/views/Emergency'
import { EmergencySetup } from '@/views/EmergencySetup'
import { Dashboard } from '@/views/Dashboard'
import { Memory } from '@/views/Memory'
import { Medications } from '@/views/Medications'
import { Records } from '@/views/Records'
import { Visits } from '@/views/Visits'
import { Contacts } from '@/views/Contacts'
import { Notifications } from '@/views/Notifications'
import { Settings } from '@/views/Settings'
import { Menu } from '@/views/Menu'

export default function App() {
  const phase = useHealth((s) => s.phase)
  const screen = useHealth((s) => s.screen)
  const boot = useHealth((s) => s.boot)
  const lock = useHealth((s) => s.lock)
  const setScreen = useHealth((s) => s.setScreen)
  const lastActivityAt = useHealth((s) => s.lastActivityAt)
  const entities = useHealth((s) => s.entities)

  useEffect(() => { void boot() }, [boot])

  // Auto-lock after inactivity (default 15 min, from user settings)
  useEffect(() => {
    if (phase !== 'unlocked') return
    const minutes = entities.users[0]?.autoLockMinutes ?? 15
    const t = window.setInterval(() => {
      if (Date.now() - useHealth.getState().lastActivityAt > minutes * 60_000) lock()
    }, 30_000)
    return () => window.clearInterval(t)
  }, [phase, lock, entities.users, lastActivityAt])

  // Register activity listeners
  useEffect(() => {
    const touch = () => useHealth.getState().touch()
    window.addEventListener('pointerdown', touch)
    window.addEventListener('keydown', touch)
    return () => {
      window.removeEventListener('pointerdown', touch)
      window.removeEventListener('keydown', touch)
    }
  }, [])

  if (phase === 'boot') {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface text-on-surface-variant" role="status">
        <span className="flex items-center gap-2 text-body-md">
          <span className="material-symbols-outlined fill animate-spin">progress_activity</span>
          Loading…
        </span>
      </div>
    )
  }

  // In setup phase the onboarding stack is reachable too — Welcome itself is
  // only the entry point, so honour `screen` instead of always rendering it.
  if (phase === 'setup') {
    if (screen === 'welcome') return <Welcome />
    return <Layout screen={screen} onBack={() => setScreen('welcome')}><CreateAccount /></Layout>
  }
  if (phase === 'locked') return <LockScreen />

  // emergency-locked: only emergency screen reachable, back returns to lock
  if (phase === 'emergency-locked') {
    return (
      <Layout screen="emergency" onBack={lock}>
        <EmergencyMode />
      </Layout>
    )
  }

  const body = (() => {
    switch (screen) {
      case 'welcome': return <Welcome />
      case 'create-account': return <CreateAccount />
      case 'onboarding-consent': return <OnboardingConsent />
      case 'onboarding-emergency': return <OnboardingEmergencySetup />
      case 'emergency': return <EmergencyMode />
      case 'emergency-setup': return <EmergencySetup />
      case 'memory': return <Memory />
      case 'medications': return <Medications />
      case 'records': return <Records />
      case 'visits': return <Visits />
      case 'contacts': return <Contacts />
      case 'notifications': return <Notifications />
      case 'settings': return <Settings />
      case 'menu': return <Menu />
      case 'dashboard': return <Dashboard />
      default: return <Dashboard />
    }
  })()

  // The welcome screen renders as a blank canvas (no header / tab bar)
  if (screen === 'welcome') return body

  // Onboarding stack screens step backwards through the flow
  if (screen === 'create-account') {
    return <Layout screen={screen} onBack={() => setScreen('welcome')}>{body}</Layout>
  }
  if (screen === 'onboarding-consent') {
    return <Layout screen={screen} onBack={() => setScreen('welcome')}>{body}</Layout>
  }
  if (screen === 'onboarding-emergency') {
    return <Layout screen={screen} onBack={() => setScreen('onboarding-consent')}>{body}</Layout>
  }

  return <Layout screen={screen}>{body}</Layout>
}
