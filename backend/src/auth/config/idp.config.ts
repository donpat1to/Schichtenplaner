// backend/src/auth/config/idp.config.ts
import { db } from '../../services/databaseService.js';
import {
  IdpConfig,
  IdpConfigArraySchema,
  IdpDatabaseRow,
  dbRowToIdpConfig,
  idpConfigToDbRow,
} from './idp.schema.js';

/**
 * Singleton manager for Identity Provider configurations
 * Supports loading from ENV or database, with hot-reload capability
 */
class IdpConfigManager {
  private configs: Map<string, IdpConfig> = new Map();
  private initialized = false;

  /**
   * Load IdP configurations from environment variable
   * ENV format: IDP_CONFIG='[{...}, {...}]' (JSON array)
   */
  async loadFromEnv(): Promise<void> {
    const envConfig = process.env.IDP_CONFIG;

    if (envConfig) {
      try {
        const parsed = JSON.parse(envConfig);
        const validated = IdpConfigArraySchema.parse(parsed);
        validated.forEach((idp) => {
          if (idp.enabled) {
            this.configs.set(idp.id, idp);
            console.log(`[IdP] Loaded from ENV: ${idp.name} (${idp.id})`);
          }
        });
      } catch (error) {
        console.error('[IdP] Failed to parse IDP_CONFIG from environment:', error);
        throw new Error('Invalid IDP_CONFIG environment variable');
      }
    }
  }

  /**
   * Load IdP configurations from database
   */
  async loadFromDatabase(): Promise<void> {
    try {
      const rows = await db.all<IdpDatabaseRow>(
        'SELECT * FROM identity_providers WHERE enabled = 1'
      );

      for (const row of rows) {
        try {
          const config = dbRowToIdpConfig(row);
          this.configs.set(config.id, config);
          console.log(`[IdP] Loaded from DB: ${config.name} (${config.id})`);
        } catch (error) {
          console.error(`[IdP] Failed to parse config for ${row.id}:`, error);
        }
      }
    } catch (error) {
      // Table might not exist yet
      console.log('[IdP] No identity_providers table found, skipping DB load');
    }
  }

  /**
   * Initialize the configuration manager
   * First loads from ENV, then supplements with DB configs
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Load from ENV first (takes precedence)
    await this.loadFromEnv();

    // Then load from DB (won't overwrite ENV configs)
    await this.loadFromDatabase();

    this.initialized = true;
    console.log(`[IdP] Initialized with ${this.configs.size} provider(s)`);
  }

  /**
   * Get all enabled IdP configurations
   */
  getAll(): IdpConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.enabled);
  }

  /**
   * Get a specific IdP configuration by ID
   */
  get(id: string): IdpConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * Check if an IdP exists and is enabled
   */
  exists(id: string): boolean {
    const config = this.configs.get(id);
    return config !== undefined && config.enabled;
  }

  /**
   * Add or update an IdP configuration (runtime only, not persisted)
   */
  set(config: IdpConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Remove an IdP configuration (runtime only)
   */
  remove(id: string): void {
    this.configs.delete(id);
  }

  /**
   * Save an IdP configuration to the database
   */
  async saveToDatabase(config: IdpConfig): Promise<void> {
    const row = idpConfigToDbRow(config);

    await db.run(
      `INSERT OR REPLACE INTO identity_providers
       (id, name, type, enabled, issuer, authorization_url, token_url, userinfo_url,
        client_id, client_secret, scope, claim_mapping, allowed_domains, default_role,
        pkce_enabled, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        row.id,
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
      ]
    );

    // Update in-memory config
    this.configs.set(config.id, config);
  }

  /**
   * Delete an IdP from the database
   */
  async deleteFromDatabase(id: string): Promise<void> {
    await db.run('DELETE FROM identity_providers WHERE id = ?', [id]);
    this.configs.delete(id);
  }

  /**
   * Reload all configurations (for hot-reload)
   */
  async reload(): Promise<void> {
    this.configs.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get provider info for public display (without secrets)
   */
  getPublicInfo(): Array<{ id: string; name: string; type: string }> {
    return this.getAll().map((idp) => ({
      id: idp.id,
      name: idp.name,
      type: idp.type,
    }));
  }
}

export const idpConfigManager = new IdpConfigManager();
