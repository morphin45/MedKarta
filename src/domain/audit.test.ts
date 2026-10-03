import { describe, expect, it } from 'vitest'
import { appendAudit, verifyAuditChain } from './audit'
import type { AuditEntry } from '@/types'

describe('audit hash chain', () => {
  it('appends entries with sequential numbers and links hashes', async () => {
    let log: AuditEntry[] = []
    log = await appendAudit(log, { actor: 'user', action: 'vault.created' })
    log = await appendAudit(log, { actor: 'user', action: 'record.saved', entity: 'medications', entityId: 'med_1' })
    expect(log).toHaveLength(2)
    expect(log[0]!.seq).toBe(0)
    expect(log[1]!.seq).toBe(1)
    expect(log[1]!.prevHash).toBe(log[0]!.hash)
  })

  it('verifies an intact chain', async () => {
    let log: AuditEntry[] = []
    log = await appendAudit(log, { actor: 'user', action: 'a' })
    log = await appendAudit(log, { actor: 'user', action: 'b' })
    log = await appendAudit(log, { actor: 'caregiver', action: 'c', entity: 'emergencyProfile' })
    const result = await verifyAuditChain(log)
    expect(result.ok).toBe(true)
  })

  it('detects tampering when an entry is modified', async () => {
    let log: AuditEntry[] = []
    log = await appendAudit(log, { actor: 'user', action: 'a' })
    log = await appendAudit(log, { actor: 'user', action: 'b' })
    const tampered = log.map((e) => (e.seq === 0 ? { ...e, action: 'forged-action' } : e))
    const result = await verifyAuditChain(tampered)
    expect(result.ok).toBe(false)
    expect(result.firstBadSeq).toBe(0)
  })

  it('detects deletion of a middle entry', async () => {
    let log: AuditEntry[] = []
    log = await appendAudit(log, { actor: 'user', action: 'a' })
    log = await appendAudit(log, { actor: 'user', action: 'b' })
    log = await appendAudit(log, { actor: 'user', action: 'c' })
    const removed = log.filter((e) => e.seq !== 1)
    const result = await verifyAuditChain(removed)
    expect(result.ok).toBe(false)
  })
})
