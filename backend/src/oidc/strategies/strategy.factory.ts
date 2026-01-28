// backend/src/oidc/strategies/strategy.factory.ts
import { idpConfigManager } from '../config/idp.config.js';
import { discoverAndConfigure, clearConfigCache } from './oidc-client.js';

/**
 * Factory for managing OIDC client configurations
 * Discovers and caches openid-client configurations per IdP
 */
class StrategyFactory {
  private discoveredIdps: Set<string> = new Set();
  private initialized = false;

  /**
   * Initialize all IdP configurations via OIDC discovery
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const idps = idpConfigManager.getAll();

    for (const idp of idps) {
      if (!idp.enabled) {
        console.log(`[StrategyFactory] IdP '${idp.id}' is disabled, skipping`);
        continue;
      }
      try {
        await discoverAndConfigure(idp);
        this.discoveredIdps.add(idp.id);
        console.log(`[StrategyFactory] Discovered IdP: ${idp.id} (${idp.name})`);
      } catch (err) {
        console.error(`[StrategyFactory] Discovery failed for IdP '${idp.id}':`, err);
      }
    }

    this.initialized = true;
    console.log(`[StrategyFactory] Initialized ${this.discoveredIdps.size} IdP(s)`);
  }

  /**
   * Ensure an IdP is discovered and ready
   */
  async ensureReady(idpId: string): Promise<void> {
    if (this.discoveredIdps.has(idpId)) {
      return;
    }

    const idp = idpConfigManager.get(idpId);
    if (!idp) {
      throw new Error(`IdP '${idpId}' not found in configuration`);
    }
    if (!idp.enabled) {
      throw new Error(`IdP '${idpId}' is disabled`);
    }

    await discoverAndConfigure(idp);
    this.discoveredIdps.add(idpId);
  }

  /**
   * Register (discover) an IdP by ID — compatibility alias for ensureReady
   */
  async registerStrategy(idpId: string): Promise<void> {
    await this.ensureReady(idpId);
  }

  /**
   * Unregister (remove cached config) for an IdP
   */
  unregisterStrategy(idpId: string): void {
    this.discoveredIdps.delete(idpId);
    // Config cache is cleared on full reload; individual removal not needed
    console.log(`[StrategyFactory] Unregistered IdP: ${idpId}`);
  }

  /**
   * Check if an IdP has been discovered
   */
  isRegistered(idpId: string): boolean {
    return this.discoveredIdps.has(idpId);
  }

  /**
   * Get all discovered IdP IDs
   */
  getRegisteredStrategies(): string[] {
    return Array.from(this.discoveredIdps);
  }

  /**
   * Reload all IdP configurations
   */
  async reloadAll(): Promise<void> {
    this.discoveredIdps.clear();
    clearConfigCache();

    await idpConfigManager.reload();

    this.initialized = false;
    await this.initializeAll();

    console.log('[StrategyFactory] Reloaded all IdP configurations');
  }
}

export const strategyFactory = new StrategyFactory();
