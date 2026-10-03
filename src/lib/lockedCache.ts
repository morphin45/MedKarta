// ─── Lock-screen emergency cache ─────────────────────────────────────────────
// The emergency profile must be readable while the vault is locked. That means
// the approved subset has to survive a reload without the master password.
//
// Trade-off (documented in the security model and surfaced in Settings):
// this is exactly the trade-off of a physical medical bracelet or a phone's
// lock-screen Medical ID. We reduce exposure by (a) storing ONLY the fields the
// user explicitly approved for emergency sharing, (b) encrypting the cache with
// a device key so a copied IndexedDB dump is not plaintext, and (c) deleting the
// cache the moment the user turns the setting off or deletes their account.

import { idb } from './idb'
import { decryptWithKey, encryptWithKey, randomBytes } from './crypto'

const KEY_STORAGE = 'ph-os-device-key'
const RECORD_ID = 'locked-emergency'

async function deviceKey(): Promise<CryptoKey> {
  let b64 = localStorage.getItem(KEY_STORAGE)
  if (!b64) {
    const bytes = randomBytes(32)
    b64 = btoa(String.fromCharCode(...bytes))
    localStorage.setItem(KEY_STORAGE, b64)
  }
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('raw', raw as unknown as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export async function saveLockedPreview(payload: unknown): Promise<void> {
  const key = await deviceKey()
  const enc = await encryptWithKey(key, JSON.stringify(payload))
  await idb.put('meta', { id: RECORD_ID, updatedAt: new Date().toISOString(), enc })
}

export async function loadLockedPreview<T>(): Promise<T | null> {
  try {
    const rec = await idb.get<{ id: string; enc?: string }>('meta', RECORD_ID)
    if (!rec?.enc) return null
    const key = await deviceKey()
    return JSON.parse(await decryptWithKey(key, rec.enc)) as T
  } catch {
    return null
  }
}

export async function clearLockedPreview(): Promise<void> {
  try {
    await idb.del('meta', RECORD_ID)
  } catch {
    /* nothing cached */
  }
}

export async function clearDeviceKey(): Promise<void> {
  localStorage.removeItem(KEY_STORAGE)
}
