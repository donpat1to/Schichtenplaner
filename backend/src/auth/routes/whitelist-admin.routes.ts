// backend/src/auth/routes/whitelist-admin.routes.ts
/**
 * Admin routes for managing IDP user whitelist
 * Requires admin or maintenance role
 */
import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { whitelistService } from '../services/whitelist.service.js';
import { db } from '../../services/databaseService.js';

const router = Router();

// All routes require admin role
router.use(authMiddleware);
router.use(requireRole(['admin', 'maintenance']));

/**
 * GET /api/admin/identity-providers/:idpId/whitelist
 * List all whitelist entries for an IDP
 */
router.get('/:idpId/whitelist', async (req: Request, res: Response) => {
  try {
    const { idpId } = req.params;

    // Verify IDP exists
    const idp = await db.get(
      'SELECT id, name FROM identity_providers WHERE id = ?',
      [idpId]
    );

    if (!idp) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    const entries = await whitelistService.getEntriesForIdp(idpId);

    res.json({ entries });
  } catch (error) {
    console.error('[Whitelist Admin] Error listing entries:', error);
    res.status(500).json({ error: 'Failed to list whitelist entries' });
  }
});

/**
 * POST /api/admin/identity-providers/:idpId/whitelist
 * Add a new whitelist entry
 */
router.post('/:idpId/whitelist', async (req: Request, res: Response) => {
  try {
    const { idpId } = req.params;
    const { identifierType, identifierValue, defaultRole, notes } = req.body;

    // Validate required fields
    if (!identifierType || !identifierValue) {
      return res.status(400).json({
        error: 'Missing required fields',
        validationErrors: [
          !identifierType && { field: 'identifierType', message: 'Identifier type is required' },
          !identifierValue && { field: 'identifierValue', message: 'Identifier value is required' },
        ].filter(Boolean),
      });
    }

    // Validate identifier type
    if (!['email', 'subject'].includes(identifierType)) {
      return res.status(400).json({
        error: 'Invalid identifier type',
        validationErrors: [
          { field: 'identifierType', message: 'Must be "email" or "subject"' },
        ],
      });
    }

    // Validate role if provided
    if (defaultRole && !['user', 'admin', 'maintenance'].includes(defaultRole)) {
      return res.status(400).json({
        error: 'Invalid default role',
        validationErrors: [
          { field: 'defaultRole', message: 'Must be "user", "admin", or "maintenance"' },
        ],
      });
    }

    const entry = await whitelistService.addEntry({
      idpId,
      identifierType,
      identifierValue: identifierValue.trim(),
      defaultRole: defaultRole || 'user',
      notes: notes?.trim() || undefined,
      createdBy: req.user?.userId,
    });

    res.status(201).json({
      message: 'Whitelist entry created',
      entry,
    });
  } catch (error) {
    console.error('[Whitelist Admin] Error creating entry:', error);

    if ((error as Error).message.includes('already exists')) {
      return res.status(400).json({ error: (error as Error).message });
    }

    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ error: (error as Error).message });
    }

    res.status(500).json({ error: 'Failed to create whitelist entry' });
  }
});

/**
 * PUT /api/admin/identity-providers/:idpId/whitelist/:entryId
 * Update a whitelist entry
 */
router.put('/:idpId/whitelist/:entryId', async (req: Request, res: Response) => {
  try {
    const { idpId, entryId } = req.params;
    const { identifierType, identifierValue, defaultRole, notes } = req.body;

    // Verify entry exists and belongs to the IDP
    const existing = await whitelistService.getEntry(entryId);
    if (!existing || existing.idpId !== idpId) {
      return res.status(404).json({ error: 'Whitelist entry not found' });
    }

    // Validate identifier type if provided
    if (identifierType && !['email', 'subject'].includes(identifierType)) {
      return res.status(400).json({
        error: 'Invalid identifier type',
        validationErrors: [
          { field: 'identifierType', message: 'Must be "email" or "subject"' },
        ],
      });
    }

    // Validate role if provided
    if (defaultRole && !['user', 'admin', 'maintenance'].includes(defaultRole)) {
      return res.status(400).json({
        error: 'Invalid default role',
        validationErrors: [
          { field: 'defaultRole', message: 'Must be "user", "admin", or "maintenance"' },
        ],
      });
    }

    const entry = await whitelistService.updateEntry(entryId, {
      identifierType,
      identifierValue: identifierValue?.trim(),
      defaultRole,
      notes: notes !== undefined ? (notes?.trim() || null) : undefined,
    });

    res.json({
      message: 'Whitelist entry updated',
      entry,
    });
  } catch (error) {
    console.error('[Whitelist Admin] Error updating entry:', error);

    if ((error as Error).message.includes('already exists')) {
      return res.status(400).json({ error: (error as Error).message });
    }

    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ error: (error as Error).message });
    }

    res.status(500).json({ error: 'Failed to update whitelist entry' });
  }
});

/**
 * DELETE /api/admin/identity-providers/:idpId/whitelist/:entryId
 * Delete a whitelist entry
 */
router.delete('/:idpId/whitelist/:entryId', async (req: Request, res: Response) => {
  try {
    const { idpId, entryId } = req.params;

    // Verify entry exists and belongs to the IDP
    const existing = await whitelistService.getEntry(entryId);
    if (!existing || existing.idpId !== idpId) {
      return res.status(404).json({ error: 'Whitelist entry not found' });
    }

    await whitelistService.removeEntry(entryId);

    res.json({ message: 'Whitelist entry deleted' });
  } catch (error) {
    console.error('[Whitelist Admin] Error deleting entry:', error);

    if ((error as Error).message.includes('not found')) {
      return res.status(404).json({ error: (error as Error).message });
    }

    res.status(500).json({ error: 'Failed to delete whitelist entry' });
  }
});

export default router;
