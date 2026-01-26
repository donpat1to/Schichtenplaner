// backend/src/auth/strategies/oidc.strategy.ts
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
  const callbackURL = `${process.env.BACKEND_URL || 'http://localhost:3002'}/api/auth/external/${idp.id}/callback`;

  // Build strategy options
  const strategyOptions = {
    issuer: idp.issuer,
    authorizationURL: idp.authorizationURL || `${idp.issuer}/authorize`,
    tokenURL: idp.tokenURL || `${idp.issuer}/token`,
    userInfoURL: idp.userInfoURL || `${idp.issuer}/userinfo`,
    clientID: idp.clientId,
    clientSecret: idp.clientSecret,
    callbackURL,
    scope: idp.scope.join(' '),
    passReqToCallback: true as const,
  };

  // Create verify function that handles the OIDC response
  const verifyFunction = async (
    req: Request,
    issuer: string,
    profile: OidcProfile,
    context: { _json?: Record<string, unknown> },
    idToken: string,
    accessToken: string,
    refreshToken: string | undefined,
    params: Record<string, unknown>,
    done: VerifyCallback
  ): Promise<void> => {
    try {
      // Get claims from context or profile
      const claims = context?._json || profile._json || {};

      // Map user and create/update in database
      const user = await userMappingService.mapAndUpsert({
        idpId: idp.id,
        profile,
        idToken,
        accessToken,
        refreshToken,
        claims,
        config: idp,
      });

      done(null, user);
    } catch (error) {
      console.error(`[OIDC] Strategy error for ${idp.id}:`, error);
      done(error as Error);
    }
  };

  // Use type assertion to bypass strict type checking
  // The passport-openidconnect types are incomplete
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new OpenIDConnectStrategy(strategyOptions as any, verifyFunction as any);
}
