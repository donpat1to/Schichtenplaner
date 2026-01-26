// frontend/src/services/identityProviderService.ts
import { apiClient } from './apiClient';

/**
 * Identity Provider configuration
 */
export interface IdentityProvider {
  id: string;
  name: string;
  type: 'oidc' | 'saml';
  enabled: boolean;
  issuer: string;
  authorizationURL?: string;
  tokenURL?: string;
  userInfoURL?: string;
  clientId: string;
  clientSecret?: string; // Only returned when editing
  scope: string[];
  claimMapping: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles?: string;
  };
  allowedDomains?: string[];
  defaultRole: string;
  pkce: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Create/Update identity provider request
 */
export interface IdentityProviderRequest {
  id?: string;
  name: string;
  type?: 'oidc' | 'saml';
  enabled?: boolean;
  issuer: string;
  authorizationURL?: string;
  tokenURL?: string;
  userInfoURL?: string;
  clientId: string;
  clientSecret: string;
  scope?: string[];
  claimMapping?: {
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    roles?: string;
  };
  allowedDomains?: string[];
  defaultRole?: string;
  pkce?: boolean;
}

/**
 * Test connection result
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  discoveryUrl?: string;
  endpoints?: {
    authorization?: string;
    token?: string;
    userinfo?: string;
  };
}

/**
 * Service for managing Identity Providers
 */
export const identityProviderService = {
  /**
   * Get all identity providers
   */
  async getAll(): Promise<IdentityProvider[]> {
    const response = await apiClient.get<{ providers: IdentityProvider[] }>(
      '/admin/identity-providers'
    );
    return response.providers;
  },

  /**
   * Get a single identity provider by ID
   */
  async getById(id: string): Promise<IdentityProvider> {
    const response = await apiClient.get<{ provider: IdentityProvider }>(
      `/admin/identity-providers/${id}`
    );
    return response.provider;
  },

  /**
   * Create a new identity provider
   */
  async create(data: IdentityProviderRequest): Promise<{ id: string; name: string }> {
    const response = await apiClient.post<{ message: string; provider: { id: string; name: string } }>(
      '/admin/identity-providers',
      data
    );
    return response.provider;
  },

  /**
   * Update an existing identity provider
   */
  async update(id: string, data: IdentityProviderRequest): Promise<void> {
    await apiClient.put(`/admin/identity-providers/${id}`, data);
  },

  /**
   * Delete an identity provider
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/admin/identity-providers/${id}`);
  },

  /**
   * Test identity provider connection
   */
  async testConnection(id: string): Promise<TestConnectionResult> {
    return apiClient.post<TestConnectionResult>(
      `/admin/identity-providers/${id}/test`
    );
  },

  /**
   * Toggle identity provider enabled/disabled
   */
  async toggle(id: string, enabled: boolean): Promise<void> {
    await apiClient.post(`/admin/identity-providers/${id}/toggle`, { enabled });
  },

  /**
   * Get available external auth providers (public endpoint)
   */
  async getAvailableProviders(): Promise<Array<{ id: string; name: string; type: string; loginUrl: string }>> {
    const response = await apiClient.get<{ providers: Array<{ id: string; name: string; type: string; loginUrl: string }> }>(
      '/auth/external/providers'
    );
    return response.providers;
  },
};
