// ─── IndexedDB vault repository ──────────────────────────────────────────────
// Two object stores:
//  - kv:        app-level envelopes ('account', 'vault' ciphertext, 'audit')
//  - meta:      unencrypted structural index (sessions, notification stubs)
// The vault envelope holds AES-GCM ciphertext of the entire entity map, so a
// lost device or copied DB file yields nothing readable.

export const DB_NAME = 'personal-health-os'
export const DB_VERSION = 1

export interface VaultEnvelope {
  id: string
  kdf: { iterations: number; saltB64: string }
  verifierHash: string // sha256(stretched verifier) — proves password without keeping it
  wrappedVault?: string // PIN-wrapped vault key (optional)
  passkeyWrappedVault?: string // passkey-PRF-wrapped vault key (optional)
  passkeyCredentialId?: string
  vault: string // "iv.ciphertext" AES-GCM of serialized entity map
  updatedAt: string
}

export interface AccountRecord {
  id: string
  email: string
  name: string
  createdAt: string
}

const dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION)
  req.onupgradeneeded = () => {
    const db = req.result
    if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'id' })
    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' })
  }
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
})

function tx<T>(store: 'kv' | 'meta', mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return dbPromise.then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result as T)
        req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'))
      }),
  )
}

export const idb = {
  get: <T>(store: 'kv' | 'meta', id: string) => tx<T>('kv' === store ? 'kv' : 'meta', 'readonly', (s) => s.get(id)),
  put: <T>(store: 'kv' | 'meta', value: T) => tx<unknown>('kv' === store ? 'kv' : 'meta', 'readwrite', (s) => s.put(value as unknown as IDBValidKey extends never ? never : { id: string } & T)),
  del: (store: 'kv' | 'meta', id: string) => tx<undefined>(store === 'kv' ? 'kv' : 'meta', 'readwrite', (s) => s.delete(id)),
  clear: (store: 'kv' | 'meta') => tx<undefined>(store === 'kv' ? 'kv' : 'meta', 'readwrite', (s) => s.clear()),
}

// ─── Session/device metadata (non-sensitive) ─────────────────────────────────
export interface DeviceSession {
  id: string
  label: string
  createdAt: string
  lastSeenAt: string
}

export async function loadSessions(): Promise<DeviceSession[]> {
  const rec = await idb.get<{ id: string; sessions: DeviceSession[] }>('meta', 'sessions')
  return rec?.sessions ?? []
}

export async function saveSessions(sessions: DeviceSession[]): Promise<void> {
  await idb.put('meta', { id: 'sessions', sessions })
}

export async function touchSession(id: string, label: string): Promise<void> {
  const sessions = await loadSessions()
  const now = new Date().toISOString()
  const existing = sessions.find((s) => s.id === id)
  if (existing) {
    existing.lastSeenAt = now
  } else {
    sessions.push({ id, label, createdAt: now, lastSeenAt: now })
    if (sessions.length > 8) sessions.shift()
  }
  await saveSessions(sessions)
}

export function thisDeviceId(): string {
  const KEY = 'ph-os-device-id'
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = `dev-${crypto.randomUUID().slice(0, 8)}`
    localStorage.setItem(KEY, id)
  }
  return id
}

export function thisDeviceLabel(): string {
  const ua = navigator.userAgent
  const browser = /Firefox/.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser'
  const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : 'Device'
  return `${browser} on ${os}`
}

// ─── Persisted UI prefs (non-health data) ────────────────────────────────────
export function loadUiPrefs(): { theme?: string } {
  try {
    return JSON.parse(localStorage.getItem('ph-os-prefs') ?? '{}') as { theme?: string }
  } catch {
    return {}
  }
}

export function saveUiPrefs(prefs: { theme?: string }): void {
  localStorage.setItem('ph-os-prefs', JSON.stringify(prefs))
}
