// ─── Passkey (WebAuthn) support via PRF extension ────────────────────────────
// Used for optional biometric/PIN-screen unlock: the PRF output becomes the
// secret that wraps the vault key. Best-effort: if the browser or authenticator
// lacks PRF support we say so plainly and the user keeps password/PIN unlock.

export interface PasskeySupport {
  available: boolean
  platformAuthenticator: boolean
}

export async function passkeySupport(): Promise<PasskeySupport> {
  const w = window as unknown as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean> } }
  let platform = false
  try {
    platform = (await w.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.()) ?? false
  } catch {
    platform = false
  }
  return { available: typeof window.PublicKeyCredential !== 'undefined', platformAuthenticator: platform }
}

function b64uEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64uDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export interface PrfCreateResult {
  credentialIdB64u: string
  prfSecretB64: string
}

/** Create a discoverable passkey and capture its PRF output (first evaluation). */
export async function createPasskeyWithPrf(userName: string): Promise<PrfCreateResult> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Personal Health OS' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: userName, displayName: userName },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
      extensions: { prf: {} },
    },
  })) as PublicKeyCredential | null
  if (!cred) throw new Error('Passkey creation was cancelled.')
  const ext = cred.getClientExtensionResults() as unknown as { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } }
  const first = ext.prf?.results?.first
  if (!ext.prf?.enabled || !first) throw new Error('This authenticator does not support the PRF extension (needed to derive an unlock key).')
  const secret = new Uint8Array(first)
  return { credentialIdB64u: b64uEncode(new Uint8Array(cred.rawId)), prfSecretB64: btoa(String.fromCharCode(...secret)) }
}

/** Get a PRF assertion for an existing credential → same secret as at creation. */
export async function getPrfSecret(credentialIdB64u: string, salt: Uint8Array): Promise<string> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: b64uDecode(credentialIdB64u) as unknown as BufferSource }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: salt as unknown as BufferSource } } },
    },
  })) as PublicKeyCredential | null
  if (!assertion) throw new Error('Passkey unlock was cancelled.')
  const ext = assertion.getClientExtensionResults() as unknown as { prf?: { results?: { first?: ArrayBuffer } } }
  const first = ext.prf?.results?.first
  if (!first) throw new Error('Passkey did not provide an unlock key. Use your master password this time.')
  const secret = new Uint8Array(first)
  return btoa(String.fromCharCode(...secret))
}
