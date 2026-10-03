// ─── Notifications center ────────────────────────────────────────────────────
// Titles only here — body text stays generic and never contains sensitive
// medical details (no PHI in notification previews).

import { useHealth } from '@/store/useHealth'
import { Badge, Button, Card, EmptyState, SectionTitle } from '@/components/ui'
import { fmtDateTime } from '@/lib/util'

export function Notifications() {
  const { entities, markAllNotificationsRead, softDelete } = useHealth()
  const items = [...entities.notifications].filter((n) => !n.deletedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle sub="Reminders and access events. Previews are kept vague on purpose — open the app for details.">
          🔔 Notifications
        </SectionTitle>
        {items.some((n) => !n.readAt) && <Button variant="secondary" onClick={() => void markAllNotificationsRead()}>Mark all read</Button>}
      </div>

      {items.length === 0 ? (
        <EmptyState icon="🔔" title="You’re all caught up" body="Reminders about refills, appointments and shared access will appear here." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id}>
              <Card className={`!p-4 ${n.readAt ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {n.severity === 'urgent' && <Badge tone="danger">urgent</Badge>}
                      {n.severity === 'warning' && <Badge tone="warn">notice</Badge>}
                      {n.severity === 'info' && <Badge tone="info">info</Badge>}
                      {!n.readAt && <Badge tone="good">new</Badge>}
                    </div>
                    <p className="mt-1 font-bold">{n.title}</p>
                    <p className="text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-400">{fmtDateTime(n.createdAt)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => void softDelete('notifications', n.id)}>Dismiss</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
