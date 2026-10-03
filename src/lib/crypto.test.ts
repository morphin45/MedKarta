import { describe, expect, it } from 'vitest'
import {
  deriveKey, encryptWithKey, decryptWithKey, sha256Hex, wrapKeyWithSecret, unwrapKeyWithSecret, pseudoQrMatrix,
} from './crypto'

const hasWebCrypto = typeof crypto !== 'undefined' && !!crypto.subtle

describe('crypto', () => {
  it.skipIf(!hasWebCrypto)('round-trips AES-GCM encryption', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await deriveKey('correct horse battery staple', salt, 1000)
    const ct = await encryptWithKey(key, 'Penicillin allergy — severe')
    expect(ct).not.toContain('Penicillin')
    const pt = await decryptWithKey(key, ct)
    expect(pt).toBe('Penicillin allergy — severe')
  })

  it.skipIf(!hasWebCrypto)('produces different ciphertexts per encryption (random IV)', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await deriveKey('pw', salt, 1000)
    const a = await encryptWithKey(key, 'same plaintext')
    const b = await encryptWithKey(key, 'same plaintext')
    expect(a).not.toBe(b)
  })

  it.skipIf(!hasWebCrypto)('fails to decrypt with the wrong key', async () => {
    const keyA = await deriveKey('pw-a', crypto.getRandomValues(new Uint8Array(16)), 1000)
    const keyB = await deriveKey('pw-b', crypto.getRandomValues(new Uint8Array(16)), 1000)
    const ct = await encryptWithKey(keyA, 'secret')
    await expect(decryptWithKey(keyB, ct)).rejects.toThrow()
  })

  it.skipIf(!hasWebCrypto)('wraps and unwraps the vault key with a PIN', async () => {
    const key = await deriveKey('master-password', crypto.getRandomValues(new Uint8Array(16)), 1000)
    const wrapped = await wrapKeyWithSecret(key, 'pin-1234')
    const unwrapped = await unwrapKeyWithSecret(wrapped, 'pin-1234')
    const rawA = await crypto.subtle.exportKey('raw', key)
    const rawB = await crypto.subtle.exportKey('raw', unwrapped)
    expect(new Uint8Array(rawB)).toEqual(new Uint8Array(rawA))
    await expect(unwrapKeyWithSecret(wrapped, '0000')).rejects.toThrow()
  })

  it('hashes deterministically for the audit chain', async () => {
    it.skipIf(!hasWebCrypto)
    const a = await sha256Hex('test')
    const b = await sha256Hex('test')
    const c = await sha256Hex('other')
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
    expect(a).not.toBe(c)
  })

  it('renders a pseudo-QR matrix with finder patterns', () => {
    const m = pseudoQrMatrix('test-seed', 21)
    expect(m).toHaveLength(21)
    expect(m[0]![0]).toBe(true) // finder corner
    expect(m.every((row) => row.length === 21)).toBe(true)
    const other = pseudoQrMatrix('different-seed', 21)
    expect(JSON.stringify(m)).not.toBe(JSON.stringify(other))
  })
})
