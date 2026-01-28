// backend/src/oidc/routes/idp-admin.routes.ts
/**
 * Admin routes for managing Identity Providers
 * Requires admin or maintenance role
 */
import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../services/databaseService.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { idpConfigManager } from '../config/idp.config.js';
import { IdpConfigSchema, idpConfigToDbRow, IdpDatabaseRow, dbRowToIdpConfig } from '../config/idp.schema.js';
import { strategyFactory } from '../strategies/strategy.factory.js';

const router = Router();

// All routes require admin role
router.use(authMiddleware);
router.use(requireRole(['admin', 'maintenance']));

/**
 * GET /api/admin/identity-providers
 * List all identity providers
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await db.all<IdpDatabaseRow>(
      'SELECT * FROM identity_providers ORDER BY name'
    );

    const providers = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      enabled: Boolean(row.enabled),
      issuer: row.issuer,
      clientId: row.client_id,
      // Don't expose client secret in list
      scope: JSON.parse(row.scope || '[]'),
      claimMapping: JSON.parse(row.claim_mapping || '{}'),
      allowedDomains: row.allowed_domains ? JSON.parse(row.allowed_domains) : null,
      defaultRole: row.default_role,
      pkce: Boolean(row.pkce_enabled),
      registrationMode: row.registration_mode || 'whitelist',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json({ providers });
  } catch (error) {
    console.error('[IdP Admin] Error listing providers:', error);
    res.status(500).json({ error: 'Failed to list identity providers' });
  }
});

/**
 * GET /api/admin/identity-providers/:id
 * Get a single identity provider (includes client secret for editing)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const row = await db.get<IdpDatabaseRow>(
      'SELECT * FROM identity_providers WHERE id = ?',
      [id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    const provider = {
      id: row.id,
      slug: row.slug,
      name: row.name,
      type: row.type,
      enabled: Boolean(row.enabled),
      issuer: row.issuer,
      authorizationURL: row.authorization_url,
      tokenURL: row.token_url,
      userInfoURL: row.userinfo_url,
      clientId: row.client_id,
      clientSecret: row.client_secret, // Include for editing
      scope: JSON.parse(row.scope || '[]'),
      claimMapping: JSON.parse(row.claim_mapping || '{}'),
      allowedDomains: row.allowed_domains ? JSON.parse(row.allowed_domains) : null,
      defaultRole: row.default_role,
      pkce: Boolean(row.pkce_enabled),
      registrationMode: row.registration_mode || 'whitelist',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    res.json({ provider });
  } catch (error) {
    console.error('[IdP Admin] Error getting provider:', error);
    res.status(500).json({ error: 'Failed to get identity provider' });
  }
});

/**
 * POST /api/admin/identity-providers
 * Create a new identity provider
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = req.body;

    // Validate with Zod
    const validationResult = IdpConfigSchema.safeParse({
      ...data,
      id: data.id || uuidv4(),
    });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const config = validationResult.data;

    // Check if ID already exists
    const existing = await db.get(
      'SELECT id FROM identity_providers WHERE id = ?',
      [config.id]
    );

    if (existing) {
      return res.status(400).json({ error: 'An identity provider with this ID already exists' });
    }

    // Insert into database
    const row = idpConfigToDbRow(config);
    await db.run(
      `INSERT INTO identity_providers
       (id, slug, name, type, enabled, issuer, authorization_url, token_url, userinfo_url,
        client_id, client_secret, scope, claim_mapping, allowed_domains, default_role,
        pkce_enabled, registration_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        row.id,
        row.slug,
        row.name,
        row.type,
        row.enabled,
        row.issuer,
        row.authorization_url,
        row.token_url,
        row.userinfo_url,
        row.client_id,
        row.client_secret,
        row.scope,
        row.claim_mapping,
        row.allowed_domains,
        row.default_role,
        row.pkce_enabled,
        row.registration_mode,
      ]
    );

    // Reload IdP config and register strategy
    await idpConfigManager.reload();
    if (config.enabled) {
      await strategyFactory.registerStrategy(config.id);
    }

    res.status(201).json({
      message: 'Identity provider created',
      provider: { id: config.id, name: config.name },
    });
  } catch (error) {
    console.error('[IdP Admin] Error creating provider:', error);
    res.status(500).json({ error: 'Failed to create identity provider' });
  }
});

/**
 * PUT /api/admin/identity-providers/:id
 * Update an existing identity provider
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    // Check if exists
    const existing = await db.get<IdpDatabaseRow>(
      'SELECT * FROM identity_providers WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    // Validate with Zod
    const validationResult = IdpConfigSchema.safeParse({
      ...data,
      id,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        validationErrors: validationResult.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    const config = validationResult.data;
    const row = idpConfigToDbRow(config);

    // Update in database
    await db.run(
      `UPDATE identity_providers SET
        slug = ?, name = ?, type = ?, enabled = ?, issuer = ?,
        authorization_url = ?, token_url = ?, userinfo_url = ?,
        client_id = ?, client_secret = ?, scope = ?, claim_mapping = ?,
        allowed_domains = ?, default_role = ?, pkce_enabled = ?,
        registration_mode = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        row.slug,
        row.name,
        row.type,
        row.enabled,
        row.issuer,
        row.authorization_url,
        row.token_url,
        row.userinfo_url,
        row.client_id,
        row.client_secret,
        row.scope,
        row.claim_mapping,
        row.allowed_domains,
        row.default_role,
        row.pkce_enabled,
        row.registration_mode,
        id,
      ]
    );

    // Reload configuration and strategies
    await idpConfigManager.reload();
    await strategyFactory.reloadAll();

    res.json({
      message: 'Identity provider updated',
      provider: { id: config.id, name: config.name },
    });
  } catch (error) {
    console.error('[IdP Admin] Error updating provider:', error);
    res.status(500).json({ error: 'Failed to update identity provider' });
  }
});

/**
 * DELETE /api/admin/identity-providers/:id
 * Delete an identity provider
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if exists
    const existing = await db.get(
      'SELECT id, name FROM identity_providers WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    // Check for linked identities
    const linkedCount = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM employee_identities WHERE idp_id = ?',
      [id]
    );

    if (linkedCount && linkedCount.count > 0) {
      return res.status(400).json({
        error: `Cannot delete: ${linkedCount.count} user(s) are linked to this provider`,
      });
    }

    // Delete from database
    await db.run('DELETE FROM identity_providers WHERE id = ?', [id]);

    // Unregister strategy and reload config
    strategyFactory.unregisterStrategy(id);
    await idpConfigManager.reload();

    res.json({ message: 'Identity provider deleted' });
  } catch (error) {
    console.error('[IdP Admin] Error deleting provider:', error);
    res.status(500).json({ error: 'Failed to delete identity provider' });
  }
});

/**
 * POST /api/admin/identity-providers/:id/test
 * Test an identity provider configuration
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const row = await db.get<IdpDatabaseRow>(
      'SELECT * FROM identity_providers WHERE id = ?',
      [id]
    );

    if (!row) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    // Try to fetch the OIDC discovery document
    const discoveryUrl = `${row.issuer}/.well-known/openid-configuration`;

    try {
      const response = await fetch(discoveryUrl);

      if (!response.ok) {
        return res.json({
          success: false,
          message: `Discovery endpoint returned ${response.status}`,
          discoveryUrl,
        });
      }

      const discovery = await response.json();

      res.json({
        success: true,
        message: 'Successfully connected to identity provider',
        discoveryUrl,
        endpoints: {
          authorization: discovery.authorization_endpoint,
          token: discovery.token_endpoint,
          userinfo: discovery.userinfo_endpoint,
        },
      });
    } catch (fetchError) {
      res.json({
        success: false,
        message: `Failed to connect: ${(fetchError as Error).message}`,
        discoveryUrl,
      });
    }
  } catch (error) {
    console.error('[IdP Admin] Error testing provider:', error);
    res.status(500).json({ error: 'Failed to test identity provider' });
  }
});

/**
 * POST /api/admin/identity-providers/:id/toggle
 * Enable or disable an identity provider
 */
router.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    const existing = await db.get(
      'SELECT id, name FROM identity_providers WHERE id = ?',
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    await db.run(
      'UPDATE identity_providers SET enabled = ?, updated_at = datetime(\'now\') WHERE id = ?',
      [enabled ? 1 : 0, id]
    );

    // Reload configuration and strategies
    await idpConfigManager.reload();
    await strategyFactory.reloadAll();

    res.json({
      message: `Identity provider ${enabled ? 'enabled' : 'disabled'}`,
      enabled,
    });
  } catch (error) {
    console.error('[IdP Admin] Error toggling provider:', error);
    res.status(500).json({ error: 'Failed to toggle identity provider' });
  }
});

export default router;
