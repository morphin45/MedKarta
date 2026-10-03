import { describe, expect, it } from 'vitest'
import { adherenceLast7Days, refillAlerts, todayDoseSlots } from './medications'
import { buildDemoData } from '@/data/seed'
import type { Medication } from '@/types'

const d = buildDemoData()

function medAt(times: string[], extra: Partial<Medication> = {}): Medication {
  return { ...d.medications[0]!, id: 'm_test', name: 'Testomed', reminderTimes: times, ...extra }
}

describe('dose schedule', () => {
  it('marks slots due, and missed when the time passed', () => {
    const now = new Date('2026-10-01T14:00:00')
    const med = medAt(['08:00', '20:00'])
    const slots = todayDoseSlots([med], [], now)
    expect(slots).toHaveLength(2)
    expect(slots.find((s) => s.time === '08:00')!.status).toBe('missed')
    expect(slots.find((s) => s.time === '20:00')!.status).toBe('due')
  })

  it('uses logs when present', () => {
    const now = new Date('2026-10-01T14:00:00')
    const med = medAt(['08:00'])
    const log = {
      id: 'l1', userId: 'u', medicationId: 'm_test', date: now.toISOString().slice(0, 10),
      time: '08:00', status: 'taken' as const, createdAt: '', updatedAt: '',
    }
    const slots = todayDoseSlots([med], [log], now)
    expect(slots[0]!.status).toBe('taken')
  })

  it('ignores paused/completed/discontinued medications', () => {
    const now = new Date('2026-10-01T14:00:00')
    const slots = todayDoseSlots([medAt(['08:00'], { status: 'paused' }), ...d.medications.filter((m) => m.status === 'completed')], [], now)
    expect(slots).toHaveLength(0)
  })
})

describe('adherence', () => {
  it('counts only scheduled days and doses', () => {
    const now = new Date('2026-10-01T12:00:00')
    const med = medAt(['08:00', '20:00'], { startDate: '2026-09-01' })
    const r = adherenceLast7Days([med], [], now)
    expect(r.scheduled).toBe(14)
    expect(r.taken).toBe(0)
    expect(r.pct).toBe(0)
  })

  it('returns 100% when nothing is scheduled (no divide-by-zero)', () => {
    const r = adherenceLast7Days([], [], new Date())
    expect(r.pct).toBe(100)
  })
})

describe('refill alerts', () => {
  it('alerts when supply is empty', () => {
    const alerts = refillAlerts([medAt(['08:00'], { supplyRemaining: 0, refillQuantity: 30 })])
    expect(alerts.some((a) => a.kind === 'supply-empty')).toBe(true)
  })

  it('alerts when supply is low relative to refill quantity', () => {
    const alerts = refillAlerts([medAt(['08:00'], { supplyRemaining: 4, refillQuantity: 30 })])
    expect(alerts.some((a) => a.kind === 'supply-low')).toBe(true)
  })

  it('alerts when refill date is near', () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString()
    const alerts = refillAlerts([medAt(['08:00'], { refillDueDate: soon })])
    expect(alerts.some((a) => a.kind === 'refill-due')).toBe(true)
  })

  it('stays quiet for healthy supply', () => {
    const far = new Date(Date.now() + 30 * 86_400_000).toISOString()
    const alerts = refillAlerts([medAt(['08:00'], { supplyRemaining: 25, refillQuantity: 30, refillDueDate: far })])
    expect(alerts).toHaveLength(0)
  })
})
