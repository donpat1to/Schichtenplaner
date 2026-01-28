// backend/src/oidc/middleware/pkce.middleware.ts
import crypto from 'crypto';

/**
 * PKCE State store entry
 */
interface PkceStateEntry {
  idpId: string;
  codeVerifier: string;
  returnUrl: string;
  nonce: string;
  createdAt: number;
}

/**
 * In-memory store for PKCE state
 */
const stateStore = new Map<string, PkceStateEntry>();

// State TTL in milliseconds (10 minutes)
const STATE_TTL = 10 * 60 * 1000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

// Periodic cleanup of expired states
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  const sizeBefore = stateStore.size;

  for (const [key, value] of stateStore) {
    if (now - value.createdAt > STATE_TTL) {
      console.log(`[PKCE] Cleanup: removing expired state ${key.substring(0, 8)}... for IDP "${value.idpId}" (age: ${Math.round((now - value.createdAt) / 1000)}s)`);
      stateStore.delete(key);
      cleaned++;
    }
  }

  console.log(`[PKCE] Cleanup cycle complete (removed: ${cleaned}, before: ${sizeBefore}, after: ${stateStore.size})`);
}, CLEANUP_INTERVAL);

/**
 * Generate PKCE state, code verifier, and code challenge
 */
export function generatePkceState(
  idpId: string,
  returnUrl: string
): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  nonce: string;
} {
  // Generate cryptographically secure random values
  const state = crypto.randomBytes(32).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(16).toString('hex');

  // Generate code challenge using S256 method
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Store state with associated data
  stateStore.set(state, {
    idpId,
    codeVerifier,
    returnUrl,
    nonce,
    createdAt: Date.now(),
  });

  console.log(`[PKCE] Generated state for IDP "${idpId}" (state: ${state.substring(0, 8)}..., returnUrl: ${returnUrl}, storeSize: ${stateStore.size})`);

  return { state, codeVerifier, codeChallenge, nonce };
}

/**
 * Validate and consume PKCE state (one-time use)
 */
export function validateAndConsumePkceState(
  state: string
): PkceStateEntry | null {
  console.log(`[PKCE] Validating state: ${state.substring(0, 8)}... (storeSize: ${stateStore.size})`);

  const entry = stateStore.get(state);

  if (!entry) {
    console.log(`[PKCE] State not found: ${state.substring(0, 8)}... (available keys: ${[...stateStore.keys()].map(k => k.substring(0, 8)).join(', ')})`);
    return null;
  }

  const ageMs = Date.now() - entry.createdAt;

  // Check expiration
  if (ageMs > STATE_TTL) {
    stateStore.delete(state);
    console.log(`[PKCE] State expired: ${state.substring(0, 8)}... (age: ${Math.round(ageMs / 1000)}s, TTL: ${STATE_TTL / 1000}s)`);
    return null;
  }

  // Delete after validation (one-time use)
  stateStore.delete(state);

  console.log(`[PKCE] State validated successfully for IDP "${entry.idpId}" (state: ${state.substring(0, 8)}..., age: ${Math.round(ageMs / 1000)}s, remainingStates: ${stateStore.size})`);

  return entry;
}

/**
 * Get current state store size (for debugging)
 */
export function getStateStoreSize(): number {
  return stateStore.size;
}

/**
 * Clear all states (for testing)
 */
export function clearStateStore(): void {
  stateStore.clear();
}
