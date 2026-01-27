// backend/src/auth/routes/external-auth.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { idpConfigManager } from '../config/idp.config.js';
import { strategyFactory } from '../strategies/strategy.factory.js';
import { tokenService } from '../services/token.service.js';
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
      slug: idp.slug,
      name: idp.name,
      type: idp.type,
      loginUrl: `/auth/external/${idp.slug}/login`,
    }));

    res.json({ providers });
  } catch (error) {
    console.error('[ExternalAuth] Error listing providers:', error);
    res.status(500).json({ error: 'Failed to list providers' });
  }
});

/**
 * GET /api/auth/external/:slug/login
 * Initiate OIDC login flow for a specific IdP
 */
router.get('/:slug/login', async (req: Request, res: Response, next: NextFunction) => {
  const { slug } = req.params;
  const returnUrl = (req.query.returnUrl as string) || process.env.FRONTEND_URL || 'http://localhost:3003';

  try {
    // Verify IdP exists and is enabled (lookup by slug)
    const idp = idpConfigManager.getBySlug(slug);
    if (!idp || !idp.enabled) {
      return res.status(404).json({
        error: `Identity provider '${slug}' not found or disabled`,
      });
    }

    // Ensure strategy is registered (using internal id)
    if (!strategyFactory.isRegistered(idp.id)) {
      await strategyFactory.registerStrategy(idp.id);
    }

    // Store returnUrl in session for retrieval after callback
    if (req.session) {
      (req.session as any).pkce = {
        returnUrl: returnUrl,
      };
      console.log(`[ExternalAuth] Stored returnUrl in session - sessionId: ${req.sessionID}`);
    } else {
      console.warn(`[ExternalAuth] No session available to store returnUrl!`);
    }

    console.log(`[ExternalAuth] Starting login for IdP: ${idp.name} (${slug})`);

    // Initiate Passport authentication - passport-openidconnect handles state internally
    (passport.authenticate(strategyFactory.getStrategyName(idp.id)) as ReturnType<typeof passport.authenticate>)(req, res, next);
  } catch (error) {
    console.error(`[ExternalAuth] Login error for ${slug}:`, error);
    res.status(500).json({ error: 'Failed to initiate login' });
  }
});

/**
 * GET /api/auth/external/:slug/callback
 * OIDC callback handler
 * Note: passport-openidconnect handles state validation internally
 */
router.get('/:slug/callback', (req: Request, res: Response, next: NextFunction) => {
  const { slug } = req.params;
  const { error, error_description } = req.query;

  // Handle IdP errors
  if (error) {
    console.error(`[ExternalAuth] IdP error for ${slug}: ${error} - ${error_description}`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent((error_description as string) || '')}`
    );
  }

  // Verify IdP is still valid (lookup by slug)
  const idp = idpConfigManager.getBySlug(slug);
  if (!idp || !idp.enabled) {
    console.error(`[ExternalAuth] IdP ${slug} no longer available`);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3003';
    return res.redirect(`${frontendUrl}/login?error=provider_unavailable`);
  }

  // Get returnUrl from session (stored during login initiation)
  const sessionData = (req.session as any)?.pkce;
  const returnUrl = sessionData?.returnUrl || process.env.FRONTEND_URL || 'http://localhost:3003';

  console.log(`[ExternalAuth] Processing callback for ${slug}, returnUrl: ${returnUrl}`);
  console.log(`[ExternalAuth] Query params:`, req.query);

  // Process authentication callback - passport handles state validation internally
  const strategyName = strategyFactory.getStrategyName(idp.id);
  console.log(`[ExternalAuth] Using strategy: ${strategyName}`);

  passport.authenticate(
    strategyName,
    {
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3003'}/login?error=auth_failed`,
      session: false, // We use JWT, not sessions
    } as passport.AuthenticateOptions,
    (err: Error | null, user: InternalUser | false, info: unknown) => {
      console.log(`[ExternalAuth] Passport callback - err: ${err}, user: ${!!user}, info:`, info);
      // Clear session PKCE data after use
      if (req.session && (req.session as any).pkce) {
        delete (req.session as any).pkce;
      }

      if (err) {
        console.error(`[ExternalAuth] Callback error for ${slug}:`, err);
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3003'}/login?error=auth_error&message=${encodeURIComponent(err.message)}`
        );
      }

      if (!user) {
        console.error(`[ExternalAuth] No user returned for ${slug}`);
        return res.redirect(
          `${process.env.FRONTEND_URL || 'http://localhost:3003'}/login?error=no_user`
        );
      }

      // Generate JWT tokens
      const tokens = tokenService.generateTokenPair(user);

      console.log(`[ExternalAuth] Login successful for ${user.email} via ${slug}`);

      // Redirect to frontend with tokens
      const redirectUrl = new URL(returnUrl);
      redirectUrl.searchParams.set('token', tokens.accessToken);
      redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);
      redirectUrl.searchParams.set('expires_in', tokens.expiresIn.toString());
      redirectUrl.searchParams.set('provider', slug);

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
