// ─── Menu: the 5th tab — every remaining destination in one place ────────────

import { useHealth, type Screen } from '@/store/useHealth'
import { Ico } from '@/components/ui'

interface Item {
  screen?: Screen
  icon: string
  label: string
  hint?: string
  onClick?: () => void
  badge?: number
}

function Row({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-surface-container-low active:bg-surface-container"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-container text-on-surface-variant">
        <Ico name={item.icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-label-md font-semibold text-on-surface">{item.label}</span>
        {item.hint && <span className="truncate text-body-sm text-on-surface-variant">{item.hint}</span>}
      </span>
      {item.badge ? (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-error px-1.5 text-[11px] font-bold text-on-error">
          {item.badge}
        </span>
      ) : null}
      <Ico name="chevron_right" size={20} className="shrink-0 text-outline" />
    </button>
  )
}

function Group({ title, items }: { title: string; items: Item[] }) {
  const setScreen = useHealth((s) => s.setScreen)
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant">{title}</h2>
      <div className="flex flex-col divide-y divide-surface-container rounded-xl bg-surface-container-lowest shadow-sm">
        {items.map((item) => (
          <Row
            key={item.label}
            item={item}
            onClick={() => (item.onClick ? item.onClick() : item.screen ? setScreen(item.screen) : undefined)}
          />
        ))}
      </div>
    </section>
  )
}

export function Menu() {
  const lock = useHealth((s) => s.lock)
  const notifications = useHealth((s) => s.entities.notifications)
  const unread = notifications.filter((n) => !n.readAt).length
  const user = useHealth((s) => s.entities.users[0])

  return (
    <div className="flex flex-col gap-space-lg pb-4">
      {/* Account card */}
      <div className="flex items-center gap-3.5 rounded-xl bg-surface-container-lowest p-4 shadow-sm">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary-fixed text-on-primary-fixed">
          <Ico name="person" size={24} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-headline-sm text-on-surface">{user?.name ?? 'Your health vault'}</span>
          <span className="text-body-sm text-on-surface-variant">Private · encrypted on this device</span>
        </div>
      </div>

      <Group
        title="Health"
        items={[
          { screen: 'visits', icon: 'event', label: 'Doctor Visits', hint: 'Prep agendas & visit summaries' },
          { screen: 'contacts', icon: 'group', label: 'Contacts & Caregivers', hint: 'Emergency contacts and shared access' },
          { screen: 'emergency-setup', icon: 'medical_information', label: 'Emergency Profile', hint: 'Medical ID, allergies & SOS card' },
        ]}
      />

      <Group
        title="Reminders"
        items={[
          { screen: 'notifications', icon: 'notifications', label: 'Notifications', hint: 'Refills, doses & appointments', badge: unread },
        ]}
      />

      <Group
        title="Privacy & data"
        items={[
          { screen: 'settings', icon: 'settings', label: 'Settings & Privacy', hint: 'Consent, security, export & audit' },
        ]}
      />

      <Group
        title="Session"
        items={[
          { icon: 'lock', label: 'Lock now', hint: 'Require password, PIN or passkey to reopen', onClick: lock },
        ]}
      />

      <p className="px-1 text-center text-body-sm text-on-surface-variant">
        Personal Health OS organizes personal health information and supports emergency
        preparedness. It does not replace licensed medical professionals.
      </p>
    </div>
  )
}
