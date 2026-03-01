/**
 * The Seal Engine
 * Cryptographic utilities using Web Crypto API
 *
 * Visual Integration:
 * - The delay in PBKDF2 allows the stroke-dasharray animation to complete a full circle
 * - Errors trigger the 'SEAL_BROKEN' state → Cinnabar Red heartbeat animation in TheSeal.tsx
 */

import type { EncryptedPayload } from '@/types/void';

type LegacyCrypto = Crypto & {
  webkitSubtle?: SubtleCrypto;
};

function getCryptoContext(): { cryptoApi: Crypto; subtle: SubtleCrypto } {
  const cryptoApi = globalThis.crypto;
  const subtle = (cryptoApi as LegacyCrypto | undefined)?.subtle
    ?? (cryptoApi as LegacyCrypto | undefined)?.webkitSubtle;
  if (!cryptoApi || !subtle) {
    throw new Error('WEB_CRYPTO_UNAVAILABLE');
  }
  return { cryptoApi, subtle };
}

export function isWebCryptoAvailable(): boolean {
  try {
    getCryptoContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive encryption key from password using PBKDF2
 *
 * @param password - User's password
 * @param salt - Cryptographic salt (16 bytes)
 * @returns CryptoKey for AES-GCM encryption
 *
 * Note: 100,000 iterations intentionally takes 500ms-1000ms
 * This delay allows the "Golden Line" animation to complete naturally
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const { subtle } = getCryptoContext();
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Import password as key material
  const keyMaterial = await subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  // 100,000 iterations for security + visual timing
  const key = await subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Encrypt plaintext note content
 *
 * @param text - Plaintext content
 * @param password - User's password
 * @returns JSON string containing {iv, salt, data}
 */
export async function encryptNote(
  text: string,
  password: string
): Promise<string> {
  const { cryptoApi, subtle } = getCryptoContext();

  // Generate random salt and IV
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM

  // Derive key from password
  const key = await deriveKey(password, salt);

  // Encrypt the text
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(text);

  const encryptedBuffer = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBuffer
  );

  // Convert to Base64 for JSON storage
  const payload: EncryptedPayload = {
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    data: arrayBufferToBase64(encryptedBuffer),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt encrypted note content
 *
 * @param encryptedData - JSON string from encryptNote()
 * @param password - User's password
 * @returns Decrypted plaintext
 * @throws Error('SEAL_BROKEN') if decryption fails (wrong password/corrupted data)
 *
 * This error state triggers the animate-heartbeat in TheSeal.tsx
 */
export async function decryptNote(
  encryptedData: string,
  password: string
): Promise<string> {
  try {
    const { subtle } = getCryptoContext();

    // Parse encrypted payload
    const payload: EncryptedPayload = JSON.parse(encryptedData);

    // Convert Base64 back to ArrayBuffer
    const iv = base64ToArrayBuffer(payload.iv);
    const salt = base64ToArrayBuffer(payload.salt);
    const data = base64ToArrayBuffer(payload.data);

    // Derive key from password (with intentional delay for animation)
    const key = await deriveKey(password, new Uint8Array(salt));

    // Attempt decryption
    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv),
      },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    if (error instanceof Error && error.message === 'WEB_CRYPTO_UNAVAILABLE') {
      throw error;
    }
    // Any error (wrong password, tag mismatch, corrupted data) becomes SEAL_BROKEN
    throw new Error('SEAL_BROKEN');
  }
}

/**
 * Generate a unique visual fingerprint from a CryptoKey
 * Extract a numerical array (entropy) from the key material
 * This array will be passed to the "Star Map" page to draw a unique constellation
 *
 * @param key - CryptoKey to generate fingerprint from
 * @returns Array of numbers (0-255) representing entropy visualization (12 points for constellation)
 */
export async function generateKeyFingerprint(key: CryptoKey): Promise<number[]> {
  const { subtle } = getCryptoContext();

  // Export the key to get its raw material
  const exportedKey = await subtle.exportKey('jwk', key);

  // Convert key material to string for hashing
  const keyString = JSON.stringify(exportedKey);
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyString);

  // Hash the key material to get deterministic entropy
  const hashBuffer = await subtle.digest('SHA-256', keyData);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to array of numbers for visualization
  // Take first 12 bytes for a 12-point constellation
  return Array.from(hashArray.slice(0, 12));
}

/**
 * Helper: Generate fingerprint from password string
 * Used when we don't have a CryptoKey yet but need a fingerprint
 *
 * @param password - User's password
 * @returns Array of numbers for visualization
 */
export async function generateFingerprintFromPassword(password: string): Promise<number[]> {
  const hashArray = new Uint8Array(await sha256(password));

  // Convert to array of numbers for visualization
  // Take first 12 bytes for a 12-point constellation
  return Array.from(hashArray.slice(0, 12));
}

/**
 * Generate a master key and return its fingerprint
 * Used during initial key generation phase
 */
export async function generateMasterKey(): Promise<{
  key: CryptoKey;
  fingerprint: number[];
  exportable: JsonWebKey;
}> {
  const { subtle } = getCryptoContext();

  // Generate a random AES-GCM key
  const key = await subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Export key for backup
  const exportable = await subtle.exportKey('jwk', key);

  // Generate fingerprint from the CryptoKey
  const fingerprint = await generateKeyFingerprint(key);

  return { key, fingerprint, exportable };
}

export async function sha256(data: string): Promise<ArrayBuffer> {
  const { subtle } = getCryptoContext();
  const encoder = new TextEncoder();
  return subtle.digest('SHA-256', encoder.encode(data));
}

export async function sha256Hex(data: string): Promise<string> {
  const hashArray = new Uint8Array(await sha256(data));
  return Array.from(hashArray).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Utility: Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
