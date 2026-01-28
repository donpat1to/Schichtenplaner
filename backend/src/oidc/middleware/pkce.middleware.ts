// backend/src/auth/middleware/pkce.middleware.ts
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
 * In production, consider using Redis for distributed deployments
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

  for (const [key, value] of stateStore) {
    if (now - value.createdAt > STATE_TTL) {
      stateStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[PKCE] Cleaned ${cleaned} expired state(s)`);
  }
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

  return { state, codeVerifier, codeChallenge, nonce };
}

/**
 * Validate and consume PKCE state (one-time use)
 */
export function validateAndConsumePkceState(
  state: string
): PkceStateEntry | null {
  const entry = stateStore.get(state);

  if (!entry) {
    console.log('[PKCE] State not found:', state.substring(0, 8) + '...');
    return null;
  }

  // Check expiration
  if (Date.now() - entry.createdAt > STATE_TTL) {
    stateStore.delete(state);
    console.log('[PKCE] State expired:', state.substring(0, 8) + '...');
    return null;
  }

  // Delete after validation (one-time use)
  stateStore.delete(state);

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
