# Authorization & Access Permissions

This document describes the authorization and access control system used in the Schichtenplaner application.

## Role Hierarchy

The system uses three roles with different authority levels:

| Role | Authority Level | Description |
|------|-----------------|-------------|
| `admin` | 100 | Full system access - can manage all resources |
| `maintenance` | 50 | Maintenance access - can manage most resources except user creation/deletion |
| `user` | 10 | Standard user - can view resources and manage own data |

## Authentication

All protected routes require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

The JWT payload contains:
- `id` - User ID
- `email` - User email
- `role` - User role (admin, maintenance, user)

## API Endpoints & Permissions

### Authentication (`/api/auth`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/login` | POST | No | - | User login |
| `/register` | POST | No | - | User registration |
| `/validate` | GET | No | - | Validate token |
| `/logout` | POST | Yes | All | User logout |
| `/me` | GET | Yes | All | Get current user info |

### Setup (`/api/setup`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/status` | GET | No | - | Check if setup is needed |
| `/admin` | POST | No | - | Create initial admin (only when no users exist) |

### Employees (`/api/employees`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/` | GET | Yes | All | List all employees |
| `/:id` | GET | Yes | admin, maintenance | Get employee details |
| `/` | POST | Yes | **admin only** | Create new employee |
| `/:id` | PUT | Yes | admin, maintenance | Update employee |
| `/:id` | DELETE | Yes | **admin only** | Delete employee |
| `/:id/password` | PUT | Yes | All* | Change password |
| `/:id/last-login` | PUT | Yes | All | Update last login |
| `/:employeeId/availabilities` | GET | Yes | All* | Get employee availabilities |
| `/:employeeId/availabilities` | PUT | Yes | All* | Update employee availabilities |

*Note: Users can only manage their own data; admins/maintenance can manage any employee's data.

### Shift Plans (`/api/shift-plans`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/` | GET | Yes | All | List all shift plans |
| `/:id` | GET | Yes | All | Get shift plan details |
| `/` | POST | Yes | admin, maintenance | Create shift plan |
| `/from-preset` | POST | Yes | admin, maintenance | Create from preset template |
| `/:id` | PUT | Yes | admin, maintenance | Update shift plan |
| `/:id` | DELETE | Yes | admin, maintenance | Delete shift plan |
| `/:id/clear-assignments` | POST | Yes | admin, maintenance | Clear all assignments |
| `/:id/export/excel` | GET | Yes | admin, maintenance | Export to Excel |
| `/:id/export/pdf` | GET | Yes | admin, maintenance | Export to PDF |
| `/:id/time-slots` | POST | Yes | admin, maintenance | Add time slot |
| `/:id/time-slots/:slotId` | PUT | Yes | admin, maintenance | Update time slot |
| `/:id/time-slots/:slotId` | DELETE | Yes | admin, maintenance | Delete time slot |
| `/:id/shifts` | POST | Yes | admin, maintenance | Add shift |
| `/:id/shifts/:shiftId` | PATCH | Yes | admin, maintenance | Update shift |
| `/:id/shifts/:shiftId` | DELETE | Yes | admin, maintenance | Delete shift |

### Scheduled Shifts (`/api/scheduled-shifts`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/:id/generate-shifts` | POST | Yes | admin, maintenance | Generate scheduled shifts |
| `/:id/regenerate-shifts` | POST | Yes | admin, maintenance | Regenerate scheduled shifts |
| `/plan/:planId` | GET | Yes | All | Get scheduled shifts for plan |
| `/:id` | GET | Yes | All | Get single scheduled shift |
| `/:id` | PUT | Yes | All* | Update scheduled shift |

### Weekly Plans (`/api/weekly-plans`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/` | GET | Yes | All | List all weekly plans |
| `/:id` | GET | Yes | All | Get weekly plan details |
| `/` | POST | Yes | admin, maintenance | Create weekly plan |
| `/:id` | PUT | Yes | admin, maintenance | Update weekly plan |
| `/:id` | DELETE | Yes | admin, maintenance | Delete weekly plan |
| `/:id/weeks/:weekId` | PUT | Yes | admin, maintenance | Update week settings |
| `/:id/my-preferences` | GET | Yes | All | Get own preferences |
| `/:id/preferences` | POST | Yes | All | Save own preferences |
| `/:id/admin-preferences` | POST | Yes | admin, maintenance | Save any employee's preferences |
| `/:id/generate` | POST | Yes | admin, maintenance | Generate optimal assignments |
| `/:id/clear-assignments` | POST | Yes | admin, maintenance | Clear all assignments |
| `/:id/publish` | POST | Yes | admin, maintenance | Publish the plan |
| `/:id/export/excel` | GET | Yes | admin, maintenance | Export to Excel |
| `/:id/export/pdf` | GET | Yes | admin, maintenance | Export to PDF |

### Scheduling (`/api/scheduling`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/generate-schedule` | POST | Yes | All* | Generate optimal schedule |
| `/health` | GET | No | - | Health check |

## Frontend Permission Checks

The frontend uses the `useAuth` hook to check permissions:

```typescript
const { hasRole, user } = useAuth();

// Check if user has any of the specified roles
if (hasRole(['admin', 'maintenance'])) {
  // Show admin/maintenance UI
}

// Check current user info
if (user?.userId === employeeId) {
  // User is viewing their own data
}
```

## Permission Summary by Feature

### Shift Plans
- **View**: All authenticated users
- **Create/Edit/Delete**: admin, maintenance
- **Export**: admin, maintenance
- **Manage Shifts/Time Slots**: admin, maintenance

### Weekly Plans
- **View**: All authenticated users
- **Create/Edit/Delete**: admin, maintenance
- **Set Own Preferences**: All authenticated users
- **Set Others' Preferences**: admin, maintenance
- **Generate Assignments**: admin, maintenance
- **Publish**: admin, maintenance
- **Export**: admin, maintenance

### Employees
- **View List**: All authenticated users
- **View Details**: admin, maintenance
- **Create**: admin only
- **Edit**: admin, maintenance
- **Delete**: admin only
- **Manage Own Availabilities**: All authenticated users
- **Manage Others' Availabilities**: admin, maintenance

### Availabilities (Shift Plans)
- **View Own**: All authenticated users
- **Edit Own**: All authenticated users
- **View Others**: admin, maintenance
- **Edit Others**: admin, maintenance

### Preferences (Weekly Plans)
- **View Own**: All authenticated users
- **Edit Own**: All authenticated users
- **View Others**: admin, maintenance (via plan details)
- **Edit Others**: admin, maintenance

## Database Role Configuration

Roles are stored in the `roles` table:

```sql
CREATE TABLE roles (
  role TEXT PRIMARY KEY CHECK(role IN ('admin', 'user', 'maintenance')),
  authority_level INTEGER NOT NULL UNIQUE CHECK(authority_level BETWEEN 1 AND 100),
  description TEXT
);

INSERT INTO roles (role, authority_level, description) VALUES
  ('admin', 100, 'Vollzugriff'),
  ('maintenance', 50, 'Wartungszugriff'),
  ('user', 10, 'Standardbenutzer');
```

Employee-role assignments are stored in `employee_roles`:

```sql
CREATE TABLE employee_roles (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL REFERENCES roles(role),
  PRIMARY KEY (employee_id, role)
);
```

## External Identity Provider (IDP) Integration

The application supports Single Sign-On (SSO) via OpenID Connect (OIDC) identity providers such as Authentik, Azure AD, Keycloak, and others.

### Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Backend        │────▶│   Identity      │
│   (React)       │     │   (Express)      │     │   Provider      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │   SQLite DB      │
                        │   (Users, IdPs)  │
                        └──────────────────┘
```

### Authentication Flow

1. **User initiates SSO login** - Clicks IdP button on login page
2. **Backend generates PKCE state** - Creates secure state/nonce for CSRF protection
3. **Redirect to IdP** - User redirected to IdP's authorization endpoint
4. **User authenticates** - Logs in at IdP (Authentik, Azure AD, etc.)
5. **IdP callback** - IdP redirects back with authorization code
6. **Token exchange** - Backend exchanges code for ID/access tokens
7. **User mapping** - Backend maps IdP claims to internal employee
8. **JWT generation** - Backend issues application JWT tokens
9. **Frontend receives tokens** - User is logged in

### IDP Configuration

Identity providers can be configured via:
- **Database** - Managed through admin UI (Settings > Security)
- **Environment variable** - `IDP_CONFIG` JSON array

#### Database Schema

```sql
-- Identity Providers configuration
CREATE TABLE identity_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('oidc', 'saml')) DEFAULT 'oidc',
  enabled BOOLEAN DEFAULT TRUE,
  issuer TEXT NOT NULL,
  authorization_url TEXT,
  token_url TEXT,
  userinfo_url TEXT,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  scope TEXT DEFAULT '["openid", "profile", "email"]',
  claim_mapping TEXT DEFAULT '{"id": "sub", "email": "email", "firstName": "given_name", "lastName": "family_name"}',
  allowed_domains TEXT,
  default_role TEXT DEFAULT 'user',
  pkce_enabled BOOLEAN DEFAULT TRUE,
  created_at DATETIME,
  updated_at DATETIME
);

-- Employee external identities (links employees to IdP accounts)
CREATE TABLE employee_identities (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id),
  idp_id TEXT NOT NULL REFERENCES identity_providers(id),
  idp_subject TEXT NOT NULL,  -- The 'sub' claim from the IdP
  idp_email TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,
  created_at DATETIME,
  last_login DATETIME,
  UNIQUE(idp_id, idp_subject),
  UNIQUE(employee_id, idp_id)
);
```

### User Mapping Service

When a user authenticates via an external IdP, the system:

1. **Extracts claims** from the IdP response using configured claim mapping
2. **Validates email domain** if `allowedDomains` is configured
3. **Looks up existing identity** by IdP ID + subject
4. **Links or creates employee**:
   - If identity exists → Update last login
   - If email exists → Link IdP to existing employee
   - Otherwise → Create new employee with default role

### API Endpoints

#### Public External Auth (`/api/auth/external`)

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/providers` | GET | No | List available IdPs for login page |
| `/:idpId/login` | GET | No | Initiate OIDC login flow |
| `/:idpId/callback` | GET | No | OIDC callback handler |
| `/refresh` | POST | No | Refresh access token |
| `/status` | GET | No | Check external auth system status |

#### Admin IDP Management (`/api/admin/identity-providers`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/` | GET | Yes | admin, maintenance | List all IdPs |
| `/:id` | GET | Yes | admin, maintenance | Get IdP details (includes secret) |
| `/` | POST | Yes | admin, maintenance | Create new IdP |
| `/:id` | PUT | Yes | admin, maintenance | Update IdP |
| `/:id` | DELETE | Yes | admin, maintenance | Delete IdP |
| `/:id/test` | POST | Yes | admin, maintenance | Test IdP connection |
| `/:id/toggle` | POST | Yes | admin, maintenance | Enable/disable IdP |

### Claim Mapping

The system maps IdP claims to internal user fields:

| Internal Field | Default Claim | Example |
|----------------|---------------|---------|
| User ID | `sub` | `abc123-def456...` |
| Email | `email` | `user@example.com` |
| First Name | `given_name` | `Max` |
| Last Name | `family_name` | `Mustermann` |
| Roles (optional) | `groups` or `roles` | `["admin", "users"]` |

Custom claim paths support dot notation for nested claims (e.g., `user.profile.email`).

### Role Mapping

IdP roles/groups are mapped to internal roles:

| IdP Role | Internal Role |
|----------|---------------|
| `admin`, `administrators`, `Admin` | `admin` |
| `maintenance`, `Maintenance` | `maintenance` |
| `user`, `users`, `User` | `user` |

If no matching role is found, the IdP's configured `defaultRole` is used.

### PKCE Security

PKCE (Proof Key for Code Exchange) is enabled by default for all IdPs:

- **State**: Cryptographically random, stored server-side with 10-minute TTL
- **Code Verifier**: Random base64url string
- **Code Challenge**: SHA-256 hash of verifier (S256 method)
- **Nonce**: Random string to prevent replay attacks

### Frontend Integration

The Settings page (admin only) provides a UI for managing IdPs:

```typescript
// Settings > Security tab
// - List configured IdPs
// - Add/Edit/Delete IdPs
// - Test connection (validates OIDC discovery)
// - Toggle enable/disable
```

The login page displays available IdPs:

```typescript
// Get available providers for login buttons
const providers = await identityProviderService.getAvailableProviders();
// Returns: [{ id, name, type, loginUrl }]
```

### Environment Configuration

```bash
# Backend URL (required for callback URL generation)
APP_URL=https://schichtplaner.example.com

# Frontend URL (for redirects after login)
APP_URL=https://schichtplaner.example.com

# Session secret (for OIDC state management)
SESSION_SECRET=your-session-secret

# Optional: Configure IdP via environment instead of database
IDP_CONFIG='[{"id":"authentik","name":"Authentik","type":"oidc","enabled":true,"issuer":"https://auth.example.com/application/o/schichtplaner/","clientId":"client-id","clientSecret":"client-secret","scope":["openid","profile","email"],"claimMapping":{"id":"sub","email":"email","firstName":"given_name","lastName":"family_name"},"defaultRole":"user","pkce":true}]'
```

### Token Structure

External auth tokens include an `idp` field indicating the authentication source:

```typescript
interface TokenPayload {
  id: string;      // Employee ID
  email: string;   // Employee email
  role: string;    // Primary role (backward compatible)
  roles?: string[]; // All roles
  idp?: string;    // Identity provider ID (for external auth)
  iat?: number;    // Issued at
  exp?: number;    // Expiration
}
```

## Security Best Practices

1. **Always validate on backend**: Never rely solely on frontend permission checks
2. **Use requireRole middleware**: Apply role checks on all protected routes
3. **Validate resource ownership**: When users access their own data, verify the ID matches
4. **Audit sensitive actions**: Log admin actions for accountability
5. **JWT expiration**: Tokens should have reasonable expiration times
6. **HTTPS only**: In production, always use HTTPS

### SSO-Specific Security

7. **Keep client secrets secure**: Never expose in frontend code or version control
8. **Enable PKCE**: Always use PKCE for OIDC flows (enabled by default)
9. **Restrict allowed domains**: Configure `allowedDomains` to limit who can sign in
10. **Use least privilege**: Set `defaultRole` to `user`, not `admin`
11. **Validate state/nonce**: Prevents CSRF and replay attacks (handled automatically)
12. **Review linked identities**: Periodically audit `employee_identities` table
13. **Session security**: OIDC sessions are short-lived (10 min) and HTTP-only
