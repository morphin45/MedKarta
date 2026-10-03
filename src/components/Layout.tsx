// ─── App shell: Material 3 mobile frame (fixed header + bottom tab bar) ─────
// Emergency (SOS) is always one tap away from the header on every screen.

import type { ReactNode } from 'react'
import { useHealth, type Screen } from '@/store/useHealth'
import { Ico, MaskIcon, PillIcon } from './ui'

// Custom icon artwork per tab: `mask` points at /public/icons (Streamline
// Nova), `svg: 'pill'` is inline vector. Material ligatures remain the default
// for anything without custom artwork.
export const TAB_NAV: Array<
  { screen: Screen; label: string; icon: string; svg?: 'pill'; mask?: string }
> = [
  { screen: 'dashboard', label: 'Dashboard', icon: 'dashboard', mask: 'grid.png' },
  { screen: 'memory', label: 'Memory', icon: 'psychology', mask: 'memory.png' },
  { screen: 'medications', label: 'Meds', icon: 'pill', svg: 'pill' },
  { screen: 'records', label: 'Records', icon: 'folder_shared', mask: 'records.png' },
  { screen: 'menu', label: 'Menu', icon: 'menu', mask: 'layout.png' },
]

export const SCREEN_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  memory: 'Medical Memory',
  medications: 'Medications',
  records: 'Health Records',
  visits: 'Doctor Visits',
  contacts: 'Contacts & Caregivers',
  notifications: 'Notifications',
  settings: 'Settings & Privacy',
  emergency: 'Emergency Mode',
  'emergency-setup': 'Emergency Profile',
  'onboarding-consent': 'Privacy & Consent',
  'onboarding-emergency': 'Emergency Profile',
  'create-account': 'Account Creation',
  menu: 'Menu',
  welcome: 'Personal Health OS',
}

/** Screens reached via the bottom tab bar; everything else is a stack screen with a back button. */
const TAB_SCREENS: Screen[] = ['dashboard', 'memory', 'medications', 'records', 'menu']

const SHELL_WIDTH = 'max-w-[440px]'

export function Layout({ children, screen, onBack }: { children: ReactNode; screen: Screen; onBack?: () => void }) {
  const setScreen = useHealth((s) => s.setScreen)
  const notifications = useHealth((s) => s.entities.notifications)
  const unread = notifications.filter((n) => !n.readAt).length
  const isTab = TAB_SCREENS.includes(screen)
  const title = SCREEN_TITLES[screen] ?? 'Personal Health OS'

  return (
    <div className="min-h-dvh bg-surface">
      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Fixed header: avatar/stack title + always-visible SOS */}
      <header className="fixed top-0 z-40 left-1/2 w-full -translate-x-1/2 bg-surface/80 pt-safe backdrop-blur-xl">
        <div className={`mx-auto ${SHELL_WIDTH} flex h-16 items-center justify-between px-space-gutter`}>
          <div className="flex min-w-0 items-center gap-space-sm">
            {isTab ? (
              <button
                onClick={() => setScreen('dashboard')}
                aria-label="Go to dashboard"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-on-primary transition-transform active:scale-95"
              >
                <Ico name="person" size={18} />
              </button>
            ) : (
              <button
                aria-label="Go back"
                onClick={onBack ?? (() => setScreen('dashboard'))}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-on-surface transition-all hover:bg-surface-container active:scale-95"
              >
                <Ico name="arrow_back" size={24} />
              </button>
            )}
            <span className="truncate text-headline-sm text-on-surface dark:text-ink-100">{title}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {unread > 0 && screen !== 'notifications' && (
              <button
                onClick={() => setScreen('notifications')}
                aria-label={`Notifications, ${unread} unread`}
                className="relative grid h-11 w-11 place-items-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <Ico name="notifications" size={22} />
                <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-bold text-on-error">
                  {unread}
                </span>
              </button>
            )}
            <button
              onClick={() => setScreen('emergency')}
              className="flex h-12 items-center gap-space-xs rounded-full bg-error px-space-md font-label-md text-on-error shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform active:scale-95"
            >
              <Ico name="sos" size={20} />
              <span>SOS</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main column */}
      <main
        id="main"
        className={`mx-auto flex w-full ${SHELL_WIDTH} flex-col px-space-gutter pt-16 ${isTab ? 'pb-28' : 'pb-12'} dark:bg-[#10131a]`}
      >
        {children}
      </main>

      {/* Bottom tab bar */}
      {isTab && (
        <nav
          aria-label="Primary"
          className="fixed bottom-0 left-1/2 z-40 w-full -translate-x-1/2 bg-surface/90 pb-safe backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] dark:bg-[#10131a]/90"
        >
          <div className={`mx-auto ${SHELL_WIDTH} flex h-20 items-center justify-around px-space-xs`}>
            {TAB_NAV.map((item) => {
              const active = screen === item.screen
              return (
                <button
                  key={item.screen}
                  onClick={() => setScreen(item.screen)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-16 w-16 flex-col items-center justify-center gap-space-xs rounded-xl transition-all ${
                    active ? 'bg-secondary-container/20 font-bold text-secondary' : 'text-on-surface-variant'
                  }`}
                >
                  {item.svg === 'pill'
                    ? <PillIcon size={24} className="shrink-0" />
                    : item.mask
                      ? <MaskIcon file={item.mask} size={24} />
                      : <Ico name={item.icon} size={24} />}
                  <span className="text-label-sm">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
