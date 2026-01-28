// backend/src/oidc/config/idp.schema.ts
import { z } from 'zod';

/**
 * Zod schema for Identity Provider configuration
 * Supports OIDC providers like Authentik, Azure AD, Keycloak
 */
export const IdpConfigSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  name: z.string().min(1),
  type: z.enum(['oidc', 'saml']).default('oidc'),
  enabled: z.boolean().default(true),

  // OIDC endpoints (issuer is required, others can be discovered)
  issuer: z.string().url(),
  authorizationURL: z.string().url().optional(),
  tokenURL: z.string().url().optional(),
  userInfoURL: z.string().url().optional(),

  // Client credentials
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),

  // Scopes to request
  scope: z.array(z.string()).default(['openid', 'profile', 'email']),

  // Claim mapping: how to map IdP claims to internal user fields
  claimMapping: z.object({
    id: z.string().default('sub'),
    email: z.string().default('email'),
    username: z.string().optional(),
    firstName: z.string().default('given_name'),
    lastName: z.string().default('family_name'),
    roles: z.string().optional(), // e.g., 'groups' or 'roles'
  }).default({
    id: 'sub',
    email: 'email',
    firstName: 'given_name',
    lastName: 'family_name',
  }),

  // Access restrictions
  allowedDomains: z.array(z.string()).optional(),
  defaultRole: z.string().default('user'),

  // Security settings
  pkce: z.boolean().default(true),

  // Registration mode: 'open' = auto-create accounts, 'whitelist' = require pre-approval
  registrationMode: z.enum(['open', 'whitelist']).default('whitelist'),
});

export type IdpConfig = z.infer<typeof IdpConfigSchema>;

export const IdpConfigArraySchema = z.array(IdpConfigSchema);

/**
 * Database row format for identity_providers table
 */
export interface IdpDatabaseRow {
  id: string;
  slug: string;
  name: string;
  type: 'oidc' | 'saml';
  enabled: number; // SQLite boolean
  issuer: string;
  authorization_url: string | null;
  token_url: string | null;
  userinfo_url: string | null;
  client_id: string;
  client_secret: string;
  scope: string; // JSON array
  claim_mapping: string; // JSON object
  allowed_domains: string | null; // JSON array
  default_role: string;
  pkce_enabled: number; // SQLite boolean
  registration_mode: 'open' | 'whitelist';
  created_at: string;
  updated_at: string;
}

/**
 * Convert database row to IdpConfig
 */
export function dbRowToIdpConfig(row: IdpDatabaseRow): IdpConfig {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    enabled: Boolean(row.enabled),
    issuer: row.issuer,
    authorizationURL: row.authorization_url || undefined,
    tokenURL: row.token_url || undefined,
    userInfoURL: row.userinfo_url || undefined,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    scope: JSON.parse(row.scope || '["openid", "profile", "email"]'),
    claimMapping: JSON.parse(row.claim_mapping || '{}'),
    allowedDomains: row.allowed_domains ? JSON.parse(row.allowed_domains) : undefined,
    defaultRole: row.default_role || 'user',
    pkce: Boolean(row.pkce_enabled),
    registrationMode: row.registration_mode || 'whitelist',
  };
}

/**
 * Convert IdpConfig to database row format
 */
export function idpConfigToDbRow(config: IdpConfig): Omit<IdpDatabaseRow, 'created_at' | 'updated_at'> {
  return {
    id: config.id,
    slug: config.slug,
    name: config.name,
    type: config.type,
    enabled: config.enabled ? 1 : 0,
    issuer: config.issuer,
    authorization_url: config.authorizationURL || null,
    token_url: config.tokenURL || null,
    userinfo_url: config.userInfoURL || null,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: JSON.stringify(config.scope),
    claim_mapping: JSON.stringify(config.claimMapping),
    allowed_domains: config.allowedDomains ? JSON.stringify(config.allowedDomains) : null,
    default_role: config.defaultRole,
    pkce_enabled: config.pkce ? 1 : 0,
    registration_mode: config.registrationMode || 'whitelist',
  };
}
