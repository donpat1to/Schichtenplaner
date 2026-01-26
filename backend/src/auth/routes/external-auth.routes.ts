// backend/src/auth/routes/external-auth.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { idpConfigManager } from '../config/idp.config.js';
import { strategyFactory } from '../strategies/strategy.factory.js';
import { tokenService } from '../services/token.service.js';
import { generatePkceState, validateAndConsumePkceState } from '../middleware/pkce.middleware.js';
import { InternalUser } from '../services/user-mapping.service.js';

const router = Router();

/**
 * GET /api/auth/external/providers
 * List all available external identity providers
 */
router.get('/providers', (req: Request, res: Response) => {
  try {
    const providers = idpConfigManager.getPublicInfo().map((idp) => ({
      id: idp.id,
      name: idp.name,
      type: idp.type,
      loginUrl: `/api/auth/external/${idp.id}/login`,
    }));

    res.json({ providers });
  } catch (error) {
    console.error('[ExternalAuth] Error listing providers:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

/**
 * GET /api/auth/external/:idpId/login
 * Initiate OIDC login flow for a specific IdP
 */
router.get('/:idpId/login', async (req: Request, res: Response, next: NextFunction) => {
  const { idpId } = req.params;
  const returnUrl = (req.query.returnUrl as string) || process.env.FRONTEND_URL || 'http://localhost:3003';

  try {
    // Verify IdP exists and is enabled
    const idp = idpConfigManager.get(idpId);
    if (!idp || !idp.enabled) {
      return res.status(404).json({
        error: `Identity provider '${idpId}' not found or disabled`,
      });
    }

    // Ensure strategy is registered
    if (!strategyFactory.isRegistered(idpId)) {
      await strategyFactory.registerStrategy(idpId);
    }

    // Generate PKCE state
    const pkce = generatePkceState(idpId, returnUrl);

    // Store PKCE data in session for passport-openidconnect
    if (req.session) {
      (req.session as any).pkce = {
        codeVerifier: pkce.codeVerifier,
        state: pkce.state,
        nonce: pkce.nonce,
      };
    }

    console.log(`[ExternalAuth] Starting login for IdP: ${idpId}`);

    // Initiate Passport authentication with OIDC-specific options
    const authOptions = {
      scope: idp.scope,
      state: pkce.state,
      nonce: pkce.nonce,
    };
    (passport.authenticate(strategyFactory.getStrategyName(idpId), authOptions as Record<string, unknown>) as ReturnType<typeof passport.authenticate>)(req, res, next);
  } catch (error) {
    console.error(`[ExternalAuth] Login error for ${idpId}:`, error);
    res.status(500).json({ error: 'Failed to initiate login' });
  }
});

/**
 * GET /api/auth/external/:idpId/callback
 * OIDC callback handler
 */
router.get('/:idpId/callback', (req: Request, res: Response, next: NextFunction) => {
  const { idpId } = req.params;
  const { state, error, error_description } = req.query;

  // Handle IdP errors
  if (error) {
    console.error(`[ExternalAuth] IdP error for ${idpId}: ${error} - ${error_description}`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent((error_description as string) || '')}`
    );
  }

  // Validate state parameter
  if (!state) {
    console.error(`[ExternalAuth] Missing state parameter for ${idpId}`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    return res.redirect(`${frontendUrl}/login?error=missing_state`);
  }

  const storedState = validateAndConsumePkceState(state as string);
  if (!storedState) {
    console.error(`[ExternalAuth] Invalid or expired state for ${idpId}`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    return res.redirect(`${frontendUrl}/login?error=invalid_state`);
  }

  if (storedState.idpId !== idpId) {
    console.error(`[ExternalAuth] State IdP mismatch: expected ${storedState.idpId}, got ${idpId}`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    return res.redirect(`${frontendUrl}/login?error=idp_mismatch`);
  }

  // Verify IdP is still valid
  const idp = idpConfigManager.get(idpId);
  if (!idp || !idp.enabled) {
    console.error(`[ExternalAuth] IdP ${idpId} no longer available`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    return res.redirect(`${frontendUrl}/login?error=provider_unavailable`);
  }

  // Process authentication callback
  passport.authenticate(
    strategyFactory.getStrategyName(idpId),
    {
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3003'}/login?error=auth_failed`,
      session: false, // We use JWT, not sessions
    },
    (err: Error | null, user: InternalUser | false) => {
      if (err) {
        console.error(`[ExternalAuth] Callback error for ${idpId}:`, err);
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3003'}/login?error=auth_error&message=${encodeURIComponent(err.message)}`
        );
      }

      if (!user) {
        console.error(`[ExternalAuth] No user returned for ${idpId}`);
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3003'}/login?error=no_user`
        );
      }

      // Generate JWT tokens
      const tokens = tokenService.generateTokenPair(user);

      console.log(`[ExternalAuth] Login successful for ${user.email} via ${idpId}`);

      // Redirect to frontend with tokens
      // Option 1: URL parameters (for SPA)
      const redirectUrl = new URL(storedState.returnUrl);
      redirectUrl.searchParams.set('token', tokens.accessToken);
      redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);
      redirectUrl.searchParams.set('expires_in', tokens.expiresIn.toString());
      redirectUrl.searchParams.set('provider', idpId);

      res.redirect(redirectUrl.toString());
    }
  )(req, res, next);
});

/**
 * POST /api/auth/external/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    // Verify refresh token
    const payload = tokenService.verifyRefreshToken(refreshToken);

    // TODO: Look up user from database and generate new tokens
    // For now, return error indicating implementation needed
    return res.status(501).json({
      error: 'Token refresh not fully implemented',
      message: 'Please implement user lookup from payload.sub',
    });
  } catch (error) {
    console.error('[ExternalAuth] Refresh token error:', error);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

/**
 * GET /api/auth/external/status
 * Check external auth system status
 */
router.get('/status', (req: Request, res: Response) => {
  const providers = idpConfigManager.getAll();
  const registeredStrategies = strategyFactory.getRegisteredStrategies();

  res.json({
    enabled: providers.length > 0,
    providerCount: providers.length,
    registeredStrategies: registeredStrategies.length,
    providers: providers.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      registered: registeredStrategies.includes(p.id),
    })),
  });
});

export default router;
