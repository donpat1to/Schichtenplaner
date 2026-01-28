// backend/src/oidc/strategies/oidc.strategy.ts
import { Strategy as OpenIDConnectStrategy, VerifyCallback } from 'passport-openidconnect';
import type { Request } from 'express';
import { IdpConfig } from '../config/idp.schema.js';
import { userMappingService } from '../services/user-mapping.service.js';

/**
 * Profile structure from OIDC provider
 */
export interface OidcProfile {
  id: string;
  displayName?: string;
  emails?: Array<{ value: string }>;
  _json: Record<string, unknown>;
}

/**
 * Create a Passport OIDC strategy for a specific Identity Provider
 */
export function createOidcStrategy(idp: IdpConfig): OpenIDConnectStrategy {
  const callbackURL = `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/auth/external/${idp.slug}/callback`;

  // For Authentik, extract base URL up to /o/ for endpoint construction
  const getAuthentikBaseUrl = (issuer: string): string | null => {
    const match = issuer.match(/^(.*\/o\/)/);
    return match ? match[1] : null;
  };

  const authentikBase = getAuthentikBaseUrl(idp.issuer);

  // Build strategy options
  const strategyOptions = {
    issuer: idp.issuer,
    authorizationURL: idp.authorizationURL || (authentikBase ? `${authentikBase}authorize/` : `${idp.issuer}/authorize`),
    tokenURL: idp.tokenURL || (authentikBase ? `${authentikBase}token/` : `${idp.issuer}/token`),
    userInfoURL: idp.userInfoURL || (authentikBase ? `${authentikBase}userinfo/` : `${idp.issuer}/userinfo`),
    clientID: idp.clientId.trim(), // Trim whitespace
    clientSecret: idp.clientSecret.trim(),
    callbackURL,
    scope: [...new Set(idp.scope)].filter(s => s !== 'openid').join(' '), // Remove openid - passport-openidconnect adds it automatically
    passReqToCallback: true as const,
    // Use client_secret_post for Authentik compatibility (sends credentials in body instead of Authorization header)
    tokenEndpointAuthMethod: 'client_secret_post',
  };

  // Create verify function that handles the OIDC response
  // passport-openidconnect 0.1.x uses this signature with passReqToCallback: true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const verifyFunction = function (...args: any[]): void {
    console.log(`[OIDC] Verify function called for ${idp.id}`);
    console.log(`[OIDC] Number of arguments: ${args.length}`);

    // The done callback is always the last argument
    const done: VerifyCallback = args[args.length - 1];

    // Find profile and tokens from arguments
    let profile: OidcProfile | undefined;
    let accessToken = '';
    let refreshToken = '';
    let claims: Record<string, unknown> = {};

    for (let i = 1; i < args.length - 1; i++) {
      const arg = args[i];
      if (typeof arg === 'object' && arg !== null) {
        // Check if this looks like a profile object (has id or displayName or emails)
        if ('id' in arg || 'displayName' in arg || 'emails' in arg || '_json' in arg) {
          profile = arg as OidcProfile;
          // Use _json if available, otherwise use the profile itself as claims
          claims = profile._json || arg as Record<string, unknown>;
          console.log(`[OIDC] Found profile at arg[${i}]`);
        }
      } else if (typeof arg === 'string' && arg.length > 20) {
        // Likely a token (tokens are long strings)
        if (!accessToken) {
          accessToken = arg;
        } else if (!refreshToken) {
          refreshToken = arg;
        }
      }
    }

    console.log(`[OIDC] Profile found: ${!!profile}, has email: ${!!(profile?.emails?.[0]?.value)}`);
    console.log(`[OIDC] Claims keys:`, Object.keys(claims));

    if (!profile) {
      console.error(`[OIDC] No profile found in arguments. Args:`, args.map((a, i) => `[${i}]: ${typeof a}`).join(', '));
      return done(new Error('No profile returned from IdP'));
    }

    const processAuth = async () => {
      try {
        const user = await userMappingService.mapAndUpsert({
          idpId: idp.id,
          profile: profile!,
          idToken: '',
          accessToken: accessToken || '',
          refreshToken: refreshToken,
          claims,
          config: idp,
        });

        console.log(`[OIDC] User mapped successfully:`, user.username, user.email);
        done(null, user);
      } catch (error) {
        console.error(`[OIDC] Strategy error for ${idp.id}:`, error);
        done(error as Error);
      }
    };

    processAuth();
  };

  // Use type assertion to bypass strict type checking
  // The passport-openidconnect types are incomplete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new OpenIDConnectStrategy(strategyOptions as any, verifyFunction as any);
}
