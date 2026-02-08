// backend/src/oidc/routes/external-auth.routes.ts
import { Router, Request, Response } from 'express';
import { idpConfigManager } from '../config/idp.config.js';
import { strategyFactory } from '../strategies/strategy.factory.js';
import { tokenService } from '../services/token.service.js';
import { buildAuthorizationUrl, handleCallback } from '../strategies/oidc-client.js';

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
router.get('/:slug/login', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const returnUrl = (req.query.returnUrl as string) || process.env.APP_URL || 'http://localhost:3003';

  try {
    const idp = idpConfigManager.getBySlug(slug);
    if (!idp || !idp.enabled) {
      return res.status(404).json({
        error: `Identity provider '${slug}' not found or disabled`,
      });
    }

    // Ensure IdP is discovered
    await strategyFactory.ensureReady(idp.id);

    console.log(`[ExternalAuth] Starting login for IdP: ${idp.name} (${slug}), returnUrl: ${returnUrl}`);

    // Build authorization URL with PKCE
    const { url } = await buildAuthorizationUrl(idp, returnUrl);

    console.log(`[ExternalAuth] Redirecting to IdP authorization endpoint`);
    res.redirect(url);
  } catch (error) {
    console.error(`[ExternalAuth] Login error for ${slug}:`, error);
    res.status(500).json({ error: 'Failed to initiate login' });
  }
});

/**
 * GET /api/auth/external/:slug/callback
 * OIDC callback handler
 */
router.get('/:slug/callback', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { error, error_description } = req.query;
  const frontendUrl = process.env.APP_URL || 'http://localhost:3003';

  // Handle IdP errors
  if (error) {
    console.error(`[ExternalAuth] IdP error for ${slug}: ${error} - ${error_description}`);
    return res.redirect(
      `${frontendUrl}/login?error=${encodeURIComponent(error as string)}&error_description=${encodeURIComponent((error_description as string) || '')}`
    );
  }

  // Verify IdP is still valid
  const idp = idpConfigManager.getBySlug(slug);
  if (!idp || !idp.enabled) {
    console.error(`[ExternalAuth] IdP ${slug} no longer available`);
    return res.redirect(`${frontendUrl}/login?error=provider_unavailable`);
  }

  console.log(`[ExternalAuth] Processing callback for ${slug}`);
  console.log(`[ExternalAuth] Query params:`, Object.keys(req.query));

  try {
    // Build the full current URL from the request
    const backendUrl = process.env.APP_URL || 'http://localhost:3002';
    const currentUrl = new URL(`${backendUrl}${req.originalUrl}`);

    const user = await handleCallback(idp, backendUrl, currentUrl);

    // Generate JWT tokens
    const tokens = tokenService.generateTokenPair(user);

    console.log(`[ExternalAuth] Login successful for ${user.email} via ${slug}`);

    // Redirect to frontend with tokens
    const redirectUrl = new URL(frontendUrl);
    redirectUrl.searchParams.set('token', tokens.accessToken);
    redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);
    redirectUrl.searchParams.set('expires_in', tokens.expiresIn.toString());
    redirectUrl.searchParams.set('provider', slug);

    res.redirect(redirectUrl.toString());
  } catch (err) {
    console.error(`[ExternalAuth] Callback error for ${slug}:`, err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.redirect(
      `${frontendUrl}/login?error=auth_error&message=${encodeURIComponent(message)}`
    );
  }
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
    const payload = tokenService.verifyRefreshToken(refreshToken);

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
