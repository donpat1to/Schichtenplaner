// backend/src/auth/index.ts
/**
 * External Authentication Module
 * Provides OIDC-based authentication with configurable Identity Providers
 */

// Configuration
export { idpConfigManager } from './config/idp.config.js';
export { type IdpConfig, IdpConfigSchema, IdpConfigArraySchema } from './config/idp.schema.js';

// Strategies
export { strategyFactory } from './strategies/strategy.factory.js';

// Services
export { tokenService, type TokenPayload, type TokenPair } from './services/token.service.js';
export { userMappingService, type InternalUser, type MappingInput } from './services/user-mapping.service.js';
export { whitelistService, type WhitelistEntry, type WhitelistCheckResult } from './services/whitelist.service.js';

// Middleware
export {
  generatePkceState,
  validateAndConsumePkceState,
  getStateStoreSize,
  clearStateStore,
} from './middleware/pkce.middleware.js';

// Routes
export { default as externalAuthRoutes } from './routes/external-auth.routes.js';
export { default as idpAdminRoutes } from './routes/idp-admin.routes.js';
export { default as whitelistAdminRoutes } from './routes/whitelist-admin.routes.js';

// Initialize function
import passport from 'passport';
import { idpConfigManager } from './config/idp.config.js';
import { strategyFactory } from './strategies/strategy.factory.js';

/**
 * Initialize the external authentication system
 * Should be called during server startup
 */
export async function initializeExternalAuth(): Promise<void> {
  console.log('[ExternalAuth] Initializing...');

  // Load IdP configurations
  await idpConfigManager.initialize();

  // Initialize Passport strategies
  await strategyFactory.initializeAll();

  // Configure Passport serialization (not used with JWT, but required)
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user as Express.User);
  });

  const providers = idpConfigManager.getAll();
  console.log(`[ExternalAuth] Initialized with ${providers.length} provider(s)`);

  if (providers.length > 0) {
    console.log('[ExternalAuth] Available providers:');
    providers.forEach((p) => {
      console.log(`  - ${p.name} (${p.id}): ${p.issuer}`);
    });
  }
}

/**
 * Reload external auth configuration (for hot-reload)
 */
export async function reloadExternalAuth(): Promise<void> {
  console.log('[ExternalAuth] Reloading configuration...');
  await strategyFactory.reloadAll();
  console.log('[ExternalAuth] Configuration reloaded');
}
