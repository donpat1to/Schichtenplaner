// backend/src/oidc/services/whitelist.service.ts
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../services/databaseService.js';

/**
 * Whitelist entry for IDP user pre-approval
 */
export interface WhitelistEntry {
  id: string;
  idpId: string;
  identifierType: 'email' | 'subject';
  identifierValue: string;
  defaultRole: string;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
}

/**
 * Database row for whitelist entry
 */
interface WhitelistDbRow {
  id: string;
  idp_id: string;
  identifier_type: 'email' | 'subject';
  identifier_value: string;
  default_role: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
}

/**
 * Input for creating a whitelist entry
 */
export interface CreateWhitelistEntry {
  idpId: string;
  identifierType: 'email' | 'subject';
  identifierValue: string;
  defaultRole?: string;
  notes?: string;
  createdBy?: string;
}

/**
 * Input for updating a whitelist entry
 */
export interface UpdateWhitelistEntry {
  identifierType?: 'email' | 'subject';
  identifierValue?: string;
  defaultRole?: string;
  notes?: string;
}

/**
 * Result of whitelist check
 */
export interface WhitelistCheckResult {
  allowed: boolean;
  entry?: WhitelistEntry;
  reason?: string;
}

/**
 * Convert database row to WhitelistEntry
 */
function dbRowToEntry(row: WhitelistDbRow): WhitelistEntry {
  return {
    id: row.id,
    idpId: row.idp_id,
    identifierType: row.identifier_type,
    identifierValue: row.identifier_value,
    defaultRole: row.default_role,
    notes: row.notes,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/**
 * Service for managing IDP user whitelist
 */
class WhitelistService {
  /**
   * Check if a user is allowed to register via IDP
   * Checks both email and subject against the whitelist
   */
  async isAllowed(
    idpId: string,
    email: string | null,
    subject: string | null
  ): Promise<WhitelistCheckResult> {
    // Build query to check both email and subject
    const conditions: string[] = [];
    const params: string[] = [idpId];

    if (email) {
      conditions.push("(identifier_type = 'email' AND LOWER(identifier_value) = LOWER(?))");
      params.push(email);
    }

    if (subject) {
      conditions.push("(identifier_type = 'subject' AND identifier_value = ?)");
      params.push(subject);
    }

    if (conditions.length === 0) {
      return {
        allowed: false,
        reason: 'No email or subject provided for whitelist check',
      };
    }

    const query = `
      SELECT * FROM idp_user_whitelist
      WHERE idp_id = ? AND (${conditions.join(' OR ')})
      LIMIT 1
    `;

    const row = await db.get<WhitelistDbRow>(query, params);

    if (row) {
      return {
        allowed: true,
        entry: dbRowToEntry(row),
      };
    }

    return {
      allowed: false,
      reason: 'User is not on the whitelist for this identity provider',
    };
  }

  /**
   * Get all whitelist entries for an IDP
   */
  async getEntriesForIdp(idpId: string): Promise<WhitelistEntry[]> {
    const rows = await db.all<WhitelistDbRow>(
      `SELECT * FROM idp_user_whitelist
       WHERE idp_id = ?
       ORDER BY identifier_type, identifier_value`,
      [idpId]
    );

    return rows.map(dbRowToEntry);
  }

  /**
   * Get a single whitelist entry by ID
   */
  async getEntry(id: string): Promise<WhitelistEntry | null> {
    const row = await db.get<WhitelistDbRow>(
      'SELECT * FROM idp_user_whitelist WHERE id = ?',
      [id]
    );

    return row ? dbRowToEntry(row) : null;
  }

  /**
   * Add a new whitelist entry
   */
  async addEntry(data: CreateWhitelistEntry): Promise<WhitelistEntry> {
    const id = uuidv4();

    // Validate the IDP exists
    const idp = await db.get(
      'SELECT id FROM identity_providers WHERE id = ?',
      [data.idpId]
    );

    if (!idp) {
      throw new Error('Identity provider not found');
    }

    // Check for duplicate
    const existing = await db.get<WhitelistDbRow>(
      `SELECT * FROM idp_user_whitelist
       WHERE idp_id = ? AND identifier_type = ? AND LOWER(identifier_value) = LOWER(?)`,
      [data.idpId, data.identifierType, data.identifierValue]
    );

    if (existing) {
      throw new Error('A whitelist entry with this identifier already exists');
    }

    await db.run(
      `INSERT INTO idp_user_whitelist
       (id, idp_id, identifier_type, identifier_value, default_role, notes, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
      [
        id,
        data.idpId,
        data.identifierType,
        data.identifierValue,
        data.defaultRole || 'user',
        data.notes || null,
        data.createdBy || null,
      ]
    );

    const entry = await this.getEntry(id);
    if (!entry) {
      throw new Error('Failed to create whitelist entry');
    }

    return entry;
  }

  /**
   * Update a whitelist entry
   */
  async updateEntry(id: string, updates: UpdateWhitelistEntry): Promise<WhitelistEntry> {
    const existing = await this.getEntry(id);
    if (!existing) {
      throw new Error('Whitelist entry not found');
    }

    // Check for duplicate if changing identifier
    if (updates.identifierType || updates.identifierValue) {
      const newType = updates.identifierType || existing.identifierType;
      const newValue = updates.identifierValue || existing.identifierValue;

      const duplicate = await db.get<WhitelistDbRow>(
        `SELECT * FROM idp_user_whitelist
         WHERE idp_id = ? AND identifier_type = ? AND LOWER(identifier_value) = LOWER(?) AND id != ?`,
        [existing.idpId, newType, newValue, id]
      );

      if (duplicate) {
        throw new Error('A whitelist entry with this identifier already exists');
      }
    }

    const setClauses: string[] = [];
    const params: (string | null)[] = [];

    if (updates.identifierType !== undefined) {
      setClauses.push('identifier_type = ?');
      params.push(updates.identifierType);
    }

    if (updates.identifierValue !== undefined) {
      setClauses.push('identifier_value = ?');
      params.push(updates.identifierValue);
    }

    if (updates.defaultRole !== undefined) {
      setClauses.push('default_role = ?');
      params.push(updates.defaultRole);
    }

    if (updates.notes !== undefined) {
      setClauses.push('notes = ?');
      params.push(updates.notes || null);
    }

    if (setClauses.length === 0) {
      return existing;
    }

    params.push(id);

    await db.run(
      `UPDATE idp_user_whitelist SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await this.getEntry(id);
    if (!updated) {
      throw new Error('Failed to update whitelist entry');
    }

    return updated;
  }

  /**
   * Remove a whitelist entry
   */
  async removeEntry(id: string): Promise<void> {
    const existing = await this.getEntry(id);
    if (!existing) {
      throw new Error('Whitelist entry not found');
    }

    await db.run('DELETE FROM idp_user_whitelist WHERE id = ?', [id]);
  }

  /**
   * Remove all whitelist entries for an IDP
   */
  async removeAllForIdp(idpId: string): Promise<void> {
    await db.run(
      'DELETE FROM idp_user_whitelist WHERE idp_id = ?',
      [idpId]
    );
  }

  /**
   * Get count of whitelist entries for an IDP
   */
  async getCountForIdp(idpId: string): Promise<number> {
    const result = await db.get<{ count: number }>(
      'SELECT COUNT(*) as count FROM idp_user_whitelist WHERE idp_id = ?',
      [idpId]
    );

    return result?.count || 0;
  }
}

export const whitelistService = new WhitelistService();
