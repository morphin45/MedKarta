// ─── Tamper-evident audit log ────────────────────────────────────────────────
// Append-only, hash-chained (each entry hashes the previous hash), so any
// deletion or edit breaks verification. Entries contain NO health content —
// only action + entity type/id references.

import type { AuditEntry } from '@/types'
import { sha256Hex } from '@/lib/crypto'
import { nowIso } from '@/lib/util'

export const GENESIS = '0'.repeat(64)

export async function appendAudit(
  log: AuditEntry[],
  entry: Omit<AuditEntry, 'seq' | 'at' | 'prevHash' | 'hash'>,
): Promise<AuditEntry[]> {
  const prev = log.length ? log[log.length - 1]! : undefined
  const seq = (prev?.seq ?? -1) + 1
  const at = nowIso()
  const prevHash = prev?.hash ?? GENESIS
  const hash = await sha256Hex(`${seq}|${at}|${entry.actor}|${entry.action}|${entry.entity ?? ''}|${entry.entityId ?? ''}|${JSON.stringify(entry.meta ?? {})}|${prevHash}`)
  const full: AuditEntry = { seq, at, prevHash, hash, ...entry }
  return [...log, full]
}

export async function verifyAuditChain(log: AuditEntry[]): Promise<{ ok: boolean; firstBadSeq?: number }> {
  let prevHash = GENESIS
  for (const e of log) {
    const hash = await sha256Hex(`${e.seq}|${e.at}|${e.actor}|${e.action}|${e.entity ?? ''}|${e.entityId ?? ''}|${JSON.stringify(e.meta ?? {})}|${prevHash}`)
    if (hash !== e.hash || e.prevHash !== prevHash) return { ok: false, firstBadSeq: e.seq }
    prevHash = e.hash
  }
  return { ok: true }
}

export function auditLabel(a: AuditEntry): string {
  return `${a.action}${a.entity ? ` · ${a.entity}` : ''}${a.entityId ? ` (${a.entityId})` : ''}`
}
