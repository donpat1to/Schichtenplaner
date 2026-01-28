// backend/src/oidc/strategies/oidc-client.ts
import * as client from 'openid-client';
import { IdpConfig } from '../config/idp.schema.js';
import { generatePkceState, validateAndConsumePkceState } from '../middleware/pkce.middleware.js';
import { userMappingService, type InternalUser } from '../services/user-mapping.service.js';

/**
 * Profile structure from OIDC provider (replaces passport OidcProfile)
 */
export interface OidcProfile {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
  _json: Record<string, unknown>;
}

/**
 * Cached server configuration per IdP
 */
interface CachedConfig {
  serverUrl: URL;
  config: client.Configuration;
}

const configCache = new Map<string, CachedConfig>();

/**
 * Discover and cache the OIDC configuration for an IdP
 */
export async function discoverAndConfigure(idp: IdpConfig): Promise<client.Configuration> {
  const existing = configCache.get(idp.id);
  if (existing) {
    console.log(`[OIDC] Using cached configuration for "${idp.name}" (${idp.id})`);
    return existing.config;
  }

  console.log(`[OIDC] Discovering issuer for "${idp.name}": ${idp.issuer}`);

  const issuerUrl = new URL(idp.issuer);
  const clientSecret = idp.clientSecret.trim();

  // For confidential clients (with a secret), use client_secret_basic authentication
  // (HTTP Basic auth with client_id:client_secret in Authorization header)
  const clientAuth = clientSecret ? client.ClientSecretBasic(clientSecret) : client.None();

  const executeOptions: ((config: client.Configuration) => void)[] = [];

  // Third parameter is clientMetadata (not clientSecret!) - secret is passed via clientAuth
  const config = await client.discovery(issuerUrl, idp.clientId.trim(), undefined, clientAuth, {
    execute: executeOptions,
  });

  console.log(`[OIDC] Discovery complete for "${idp.name}" (${idp.id})`);
  console.log(`[OIDC]   Authorization endpoint: ${config.serverMetadata().authorization_endpoint}`);
  console.log(`[OIDC]   Token endpoint: ${config.serverMetadata().token_endpoint}`);
  console.log(`[OIDC]   UserInfo endpoint: ${config.serverMetadata().userinfo_endpoint}`);

  configCache.set(idp.id, { serverUrl: issuerUrl, config });
  return config;
}

/**
 * Build the authorization URL for an IdP, including PKCE parameters
 */
export async function buildAuthorizationUrl(
  idp: IdpConfig,
  returnUrl: string,
): Promise<{ url: string; state: string }> {
  const config = await discoverAndConfigure(idp);

  const callbackURL = `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/auth/external/${idp.slug}/callback`;

  // Generate PKCE state, code verifier, code challenge, nonce (PKCE conditional on idp.pkce)
  const pkceEnabled = idp.pkce !== false;
  const pkce = generatePkceState(idp.id, returnUrl, pkceEnabled);

  console.log(`[OIDC] Building authorization URL for "${idp.name}"`);
  console.log(`[OIDC]   Callback URL: ${callbackURL}`);
  console.log(`[OIDC]   State: ${pkce.state.substring(0, 8)}...`);
  console.log(`[OIDC]   Nonce: ${pkce.nonce.substring(0, 8)}...`);
  console.log(`[OIDC]   PKCE enabled: ${pkceEnabled}`);
  if (pkceEnabled) {
    console.log(`[OIDC]   PKCE code_challenge: ${pkce.codeChallenge.substring(0, 16)}...`);
  }

  const scopes = [...new Set(idp.scope)].join(' ');

  const parameters: Record<string, string> = {
    redirect_uri: callbackURL,
    scope: scopes,
    state: pkce.state,
    nonce: pkce.nonce,
  };

  // Only include PKCE parameters if enabled
  if (pkceEnabled) {
    parameters.code_challenge = pkce.codeChallenge;
    parameters.code_challenge_method = 'S256';
  }

  const redirectTo = client.buildAuthorizationUrl(config, parameters);

  console.log(`[OIDC] Authorization URL built for "${idp.name}": ${redirectTo.href.substring(0, 80)}...`);

  return { url: redirectTo.href, state: pkce.state };
}

/**
 * Handle the OIDC callback: validate state, exchange code, fetch userinfo, map user
 */
export async function handleCallback(
  idp: IdpConfig,
  callbackUrl: string,
  currentUrl: URL,
): Promise<InternalUser> {
  console.log(`[OIDC] Handling callback for "${idp.name}" (${idp.id})`);

  // Extract state from the callback URL
  const state = currentUrl.searchParams.get('state');
  if (!state) {
    throw new Error('Missing state parameter in callback');
  }

  console.log(`[OIDC] Callback state: ${state.substring(0, 8)}...`);

  // Validate and consume PKCE state
  const pkceEntry = validateAndConsumePkceState(state);
  if (!pkceEntry) {
    throw new Error('Invalid or expired PKCE state');
  }

  if (pkceEntry.idpId !== idp.id) {
    throw new Error(`PKCE state IdP mismatch: expected ${idp.id}, got ${pkceEntry.idpId}`);
  }

  const pkceEnabled = pkceEntry.codeVerifier !== '';

  console.log(`[OIDC] PKCE state validated for "${idp.name}"`);
  console.log(`[OIDC]   PKCE enabled: ${pkceEnabled}`);
  if (pkceEnabled) {
    console.log(`[OIDC]   Code verifier: ${pkceEntry.codeVerifier.substring(0, 8)}...`);
  }
  console.log(`[OIDC]   Return URL: ${pkceEntry.returnUrl}`);

  const config = await discoverAndConfigure(idp);

  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/auth/external/${idp.slug}/callback`;

  console.log(`[OIDC] Exchanging code for tokens...`);

  // Build token exchange options (include PKCE code verifier only if enabled)
  const tokenOptions: Parameters<typeof client.authorizationCodeGrant>[2] = {
    expectedNonce: pkceEntry.nonce,
    expectedState: state,
    idTokenExpected: true,
  };

  if (pkceEnabled) {
    tokenOptions.pkceCodeVerifier = pkceEntry.codeVerifier;
  }

  // Exchange code for tokens
  let tokenResponse: Awaited<ReturnType<typeof client.authorizationCodeGrant>>;
  try {
    tokenResponse = await client.authorizationCodeGrant(config, currentUrl, tokenOptions);
  } catch (err) {
    console.error(`[OIDC] Token exchange failed for "${idp.name}":`, err);
    throw err;
  }

  console.log(`[OIDC] Token exchange successful for "${idp.name}"`);
  console.log(`[OIDC]   Has access_token: ${!!tokenResponse.access_token}`);
  console.log(`[OIDC]   Has id_token: ${!!tokenResponse.id_token}`);
  console.log(`[OIDC]   Has refresh_token: ${!!tokenResponse.refresh_token}`);

  // Fetch userinfo
  console.log(`[OIDC] Fetching userinfo for "${idp.name}"...`);
  let claims: Record<string, unknown>;
  try {
    const idTokenClaims = tokenResponse.claims();
    const sub = idTokenClaims?.sub;
    const userInfoResponse = await client.fetchUserInfo(config, tokenResponse.access_token, sub!);
    claims = userInfoResponse as unknown as Record<string, unknown>;
  } catch (err) {
    console.warn(`[OIDC] UserInfo fetch failed, falling back to id_token claims:`, err);
    const idTokenClaims = tokenResponse.claims();
    claims = (idTokenClaims as unknown as Record<string, unknown>) || {};
  }

  console.log(`[OIDC] UserInfo claims keys:`, Object.keys(claims));

  // Build an OidcProfile compatible with user-mapping.service
  const profile: OidcProfile = {
    id: (claims.sub as string) || '',
    displayName: (claims.name as string) || undefined,
    emails: claims.email ? [{ value: claims.email as string }] : undefined,
    _json: claims,
  };

  console.log(`[OIDC] Mapping user for "${idp.name}" - sub: ${profile.id}, email: ${claims.email}`);

  // Map user via userMappingService
  const user = await userMappingService.mapAndUpsert({
    idpId: idp.id,
    profile,
    idToken: tokenResponse.id_token || '',
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    claims,
    config: idp,
  });

  console.log(`[OIDC] User mapped successfully for "${idp.name}": ${user.username} (${user.email})`);

  return user;
}

/**
 * Clear the configuration cache (for hot-reload)
 */
export function clearConfigCache(): void {
  configCache.clear();
  console.log(`[OIDC] Configuration cache cleared`);
}

/**
 * Get cached config count (for debugging)
 */
export function getCachedConfigCount(): number {
  return configCache.size;
}
