/**
 * WebAuthn (Passkey) biometric authentication utilities for rødën OS.
 *
 * Flow:
 *   1. First login with email+password (Supabase).
 *   2. App offers to register a biometric credential on this device.
 *   3. registerBiometric() stores {credentialId, userId, email, refreshToken} in localStorage.
 *      The private key lives in the device's Secure Enclave / TPM — never exported.
 *   4. Next time: fingerprint button → authenticateWithBiometric() triggers the native prompt.
 *      On success, we refresh the Supabase session with the stored refresh token.
 */

const CREDENTIAL_KEY = 'roden_biometric_v1';
const DECLINED_KEY   = 'roden_biometric_declined';

export interface BiometricCredential {
  credentialId: string; // base64
  userId: string;
  email: string;
  refreshToken: string;
}

// ── Availability ──────────────────────────────────────────────────────────────

/** True if the device has a platform authenticator (Touch ID, Face ID, fingerprint). */
export const isBiometricAvailable = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

// ── Storage helpers ───────────────────────────────────────────────────────────

export const hasBiometricCredential = (): boolean => {
  try { return !!localStorage.getItem(CREDENTIAL_KEY); } catch { return false; }
};

export const getBiometricEmail = (): string | null => {
  try {
    const raw = localStorage.getItem(CREDENTIAL_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as BiometricCredential).email;
  } catch { return null; }
};

export const hasBiometricDeclined = (): boolean => {
  try { return !!localStorage.getItem(DECLINED_KEY); } catch { return false; }
};

export const setBiometricDeclined = (): void => {
  try { localStorage.setItem(DECLINED_KEY, '1'); } catch {}
};

export const removeBiometricCredential = (): void => {
  try {
    localStorage.removeItem(CREDENTIAL_KEY);
    localStorage.removeItem(DECLINED_KEY);
  } catch {}
};

// ── Registration ──────────────────────────────────────────────────────────────

/**
 * Register a biometric credential for this device.
 * Call this AFTER a successful email+password Supabase login.
 *
 * @param userId       Supabase user UUID
 * @param email        User email (shown in native biometric prompt)
 * @param refreshToken Supabase refresh_token to restore future sessions
 * @returns true on success, false if user cancelled or device unsupported
 */
export const registerBiometric = async (
  userId: string,
  email: string,
  refreshToken: string,
): Promise<boolean> => {
  try {
    const challenge   = crypto.getRandomValues(new Uint8Array(32));
    // WebAuthn user.id must be ≤64 bytes; we encode the UUID (36 chars)
    const userIdBytes = new TextEncoder().encode(userId.slice(0, 64));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'rødën OS',
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes,
          name: email,
          displayName: email.split('@')[0],
        },
        pubKeyCredParams: [
          { alg: -7,   type: 'public-key' }, // ECDSA P-256  (iOS, Android)
          { alg: -257, type: 'public-key' }, // RSASSA-PKCS1 (Windows Hello)
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // Built-in only (no USB keys)
          userVerification: 'required',          // Biometric mandatory
          residentKey: 'preferred',
        },
        timeout: 60000,
        excludeCredentials: [],
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    // Encode the credential ID as base64 for localStorage storage
    const credentialId = btoa(
      String.fromCharCode(...new Uint8Array(credential.rawId))
    );

    const stored: BiometricCredential = { credentialId, userId, email, refreshToken };
    localStorage.setItem(CREDENTIAL_KEY, JSON.stringify(stored));
    return true;

  } catch (err: any) {
    // NotAllowedError = user cancelled; NotSupportedError = no authenticator
    console.warn('[WebAuthn] Registration failed:', err?.name, err?.message);
    return false;
  }
};

// ── Authentication ────────────────────────────────────────────────────────────

/**
 * Trigger the native biometric prompt.
 * Returns the stored credential (including refreshToken) on success, null otherwise.
 *
 * The caller should then call:
 *   supabase.auth.refreshSession({ refresh_token: result.refreshToken })
 */
export const authenticateWithBiometric = async (): Promise<BiometricCredential | null> => {
  let stored: BiometricCredential | null = null;
  try {
    const raw = localStorage.getItem(CREDENTIAL_KEY);
    if (!raw) return null;
    stored = JSON.parse(raw) as BiometricCredential;
  } catch { return null; }

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credentialIdBytes = Uint8Array.from(
      atob(stored.credentialId),
      (c) => c.charCodeAt(0),
    );

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: credentialIdBytes,
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    if (!assertion) return null;
    return stored; // Biometric verified ✓ — return the stored session info

  } catch (err: any) {
    console.warn('[WebAuthn] Authentication failed:', err?.name, err?.message);
    return null;
  }
};
