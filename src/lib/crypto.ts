// ─── WebCrypto helpers: key derivation, AES-GCM vault encryption, audit hash chain ──
// The vault key is derived from the user's master password (PBKDF2-SHA256,
// 310k iterations, per-user random salt) and lives only in memory. Nothing
// encrypted ever touches disk without passing through here.

const enc = new TextEncoder()
const dec = new TextDecoder()

export const PBKDF2_ITERATIONS = 310_000

export interface KdfParams {
  iterations: number
}

function toB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

export function toB64u(bytes: Uint8Array): string {
  return toB64(bytes)
}

export function fromB64u(b64: string): Uint8Array {
  return fromB64(b64)
}

export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  // extractable: true is required so the vault key can be wrapped with a PIN
  // or passkey-PRF secret (wrapKeyWithSecret). The key still lives only in
  // memory and is never persisted unwrapped.
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptWithKey(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    enc.encode(plaintext),
  )
  return `${toB64(iv)}.${toB64(ct)}`
}

export async function decryptWithKey(key: CryptoKey, payload: string): Promise<string> {
  const [ivB64, ctB64] = payload.split('.')
  if (!ivB64 || !ctB64) throw new Error('Malformed ciphertext')
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as unknown as BufferSource },
    key,
    fromB64(ctB64) as unknown as BufferSource,
  )
  return dec.decode(pt)
}

/** Wrap/unwrap the vault key with a second factor (PIN or passkey PRF output). */
export async function wrapKeyWithSecret(key: CryptoKey, secret: string): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  const salt = randomBytes(16)
  const wrapKey = await deriveKey(secret, salt, 5_000)
  const iv = randomBytes(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, wrapKey, raw)
  return `1.${toB64(salt)}.${toB64(iv)}.${toB64(ct)}`
}

export async function unwrapKeyWithSecret(wrapped: string, secret: string): Promise<CryptoKey> {
  const [, saltB64, ivB64, ctB64] = wrapped.split('.')
  if (!saltB64 || !ivB64 || !ctB64) throw new Error('Malformed wrapped key')
  const wrapKey = await deriveKey(secret, fromB64(saltB64), 5_000)
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as unknown as BufferSource },
    wrapKey,
    fromB64(ctB64) as unknown as BufferSource,
  )
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/** SHA-256 hex digest of a string (audit hash chain, code hashing). */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Primitive deterministic QR-style matrix for the emergency profile (visual demo). */
export function pseudoQrMatrix(seed: string, size = 21): boolean[][] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const cells: boolean[][] = []
  for (let y = 0; y < size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < size; x++) {
      h ^= h << 13; h ^= h >>> 17; h ^= h << 5
      const isFinder =
        (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7)
      if (isFinder) {
        const lx = x >= size - 7 ? x - (size - 7) : x
        const ly = y >= size - 7 ? y - (size - 7) : y
        const ring = Math.max(Math.abs(lx - 3), Math.abs(ly - 3))
        row.push(ring !== 2)
      } else {
        row.push(((h >>> 8) & 1) === 1)
      }
    }
    cells.push(row)
  }
  return cells
}
