// backend/src/auth/strategies/strategy.factory.ts
import passport from 'passport';
import { idpConfigManager } from '../config/idp.config.js';
import { createOidcStrategy } from './oidc.strategy.js';

/**
 * Factory for managing Passport authentication strategies
 * Dynamically registers and unregisters OIDC strategies based on IdP configuration
 */
class StrategyFactory {
  private registeredStrategies: Set<string> = new Set();
  private initialized = false;

  /**
   * Initialize all strategies from loaded IdP configurations
   */
  async initializeAll(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const idps = idpConfigManager.getAll();

    for (const idp of idps) {
      await this.registerStrategy(idp.id);
    }

    this.initialized = true;
    console.log(`[StrategyFactory] Initialized ${this.registeredStrategies.size} strategy(ies)`);
  }

  /**
   * Register a Passport strategy for a specific IdP
   */
  async registerStrategy(idpId: string): Promise<void> {
    if (this.registeredStrategies.has(idpId)) {
      console.log(`[StrategyFactory] Strategy already registered: oidc-${idpId}`);
      return;
    }

    const idp = idpConfigManager.get(idpId);
    if (!idp) {
      throw new Error(`IdP '${idpId}' not found in configuration`);
    }

    if (!idp.enabled) {
      console.log(`[StrategyFactory] IdP '${idpId}' is disabled, skipping`);
      return;
    }

    // Create and register the strategy
    const strategy = createOidcStrategy(idp);
    passport.use(`oidc-${idp.id}`, strategy);

    this.registeredStrategies.add(idpId);
    console.log(`[StrategyFactory] Registered strategy: oidc-${idp.id} (${idp.name})`);
  }

  /**
   * Unregister a Passport strategy
   */
  unregisterStrategy(idpId: string): void {
    if (!this.registeredStrategies.has(idpId)) {
      return;
    }

    passport.unuse(`oidc-${idpId}`);
    this.registeredStrategies.delete(idpId);
    console.log(`[StrategyFactory] Unregistered strategy: oidc-${idpId}`);
  }

  /**
   * Check if a strategy is registered
   */
  isRegistered(idpId: string): boolean {
    return this.registeredStrategies.has(idpId);
  }

  /**
   * Get all registered strategy IDs
   */
  getRegisteredStrategies(): string[] {
    return Array.from(this.registeredStrategies);
  }

  /**
   * Reload all strategies (useful for hot-reload)
   */
  async reloadAll(): Promise<void> {
    // Unregister all existing strategies
    for (const idpId of this.registeredStrategies) {
      this.unregisterStrategy(idpId);
    }

    // Reload IdP configurations
    await idpConfigManager.reload();

    // Re-register strategies
    this.initialized = false;
    await this.initializeAll();

    console.log('[StrategyFactory] Reloaded all strategies');
  }

  /**
   * Get the Passport strategy name for an IdP
   */
  getStrategyName(idpId: string): string {
    return `oidc-${idpId}`;
  }
}

export const strategyFactory = new StrategyFactory();
