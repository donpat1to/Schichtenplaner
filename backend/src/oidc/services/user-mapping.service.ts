// backend/src/oidc/services/user-mapping.service.ts
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../services/databaseService.js';
import { IdpConfig } from '../config/idp.schema.js';
import { OidcProfile } from '../strategies/oidc-client.js';
import { whitelistService } from './whitelist.service.js';

/**
 * Input for user mapping from IdP
 */
export interface MappingInput {
  idpId: string;
  profile: OidcProfile;
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  claims: Record<string, unknown>;
  config: IdpConfig;
}

// Re-export OidcProfile for convenience
export type { OidcProfile };

/**
 * Internal user representation after mapping
 * Compatible with Express.User type for Passport
 */
export interface InternalUser {
  id: string;
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  roles: string[];
  employeeType: string;
  isActive: boolean;
  idpId: string;
  idpSubject: string;
  // Properties required by Express.User (for JWT auth compatibility)
  userId: string;
  role: string;
}

/**
 * Database row for employee
 */
interface EmployeeRow {
  id: string;
  username: string;
  email: string;
  firstname?: string | null;
  lastname?: string | null;
  employee_type: string;
  is_active: number;
}

/**
 * Database row for employee identity
 */
interface IdentityRow {
  id: string;
  employee_id: string;
  idp_id: string;
  idp_subject: string;
}

/**
 * Service for mapping external IdP users to internal employees
 */
class UserMappingService {
  /**
   * Map an IdP user to an internal employee, creating if necessary
   */
  async mapAndUpsert(input: MappingInput): Promise<InternalUser> {
    const { claims, config, idpId, accessToken, refreshToken, profile } = input;
    const mapping = config.claimMapping;

    // Extract claims using the configured mapping, with fallbacks for passport profile format
    let idpSubject = this.extractClaim(claims, mapping.id) as string;
    let email = this.extractClaim(claims, mapping.email) as string;
    let username = mapping.username ? this.extractClaim(claims, mapping.username) as string | undefined : undefined;
    let firstName = this.extractClaim(claims, mapping.firstName) as string | null;
    let lastName = this.extractClaim(claims, mapping.lastName) as string | null;

    // Fallback to passport profile format if claims don't have the expected fields
    if (!idpSubject && profile) {
      idpSubject = profile.id || (claims.id as string) || (claims.sub as string);
    }
    if (!email && profile?.emails?.[0]?.value) {
      email = profile.emails[0].value;
    }
    if (!email && claims.emails && Array.isArray(claims.emails)) {
      email = (claims.emails[0] as { value: string })?.value;
    }
    if (!username && profile) {
      username = (profile as any).username ||
        (profile as any).preferred_username ||
        (claims.preferred_username as string);
    }
    if (!firstName && !lastName && profile) {
      firstName = (profile as any).name?.givenName ||
        (profile as any).displayName?.split(' ')[0] ||
        (claims.name as any)?.givenName ||
        (claims.given_name as string) || null;
      lastName = null;
    }

    // Username fallback: use email prefix if no username found
    if (!username) {
      throw new Error('Missing username claim from IdP');
    }

    if (!idpSubject) {
      throw new Error('Missing subject claim from IdP');
    }

    if (!email) {
      throw new Error('Missing email claim from IdP');
    }

    // Validate email domain if restrictions are configured
    if (config.allowedDomains?.length) {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      const allowed = config.allowedDomains.some(
        (d) => d.toLowerCase() === emailDomain
      );
      if (!allowed) {
        throw new Error(`Email domain '${emailDomain}' is not allowed for this provider`);
      }
    }

    // Map roles from IdP claims
    let roles: string[] = [config.defaultRole];
    if (mapping.roles) {
      const idpRoles = this.extractClaim(claims, mapping.roles);
      if (Array.isArray(idpRoles)) {
        roles = this.mapRoles(idpRoles, config);
      }
    }

    // Try to find existing identity link
    let employee = await this.findByIdentity(idpId, idpSubject);
    const whitelistCheck = await whitelistService.isAllowed(idpId, email, idpSubject, username);

    if (!whitelistCheck.allowed) {
      console.log(`[UserMapping] User ${idpSubject} not on whitelist for IdP ${idpId}`);
      throw new Error('Your account is not pre-approved for registration. Please contact an administrator.');
    }

    if (!employee) {
      // No identity link - try to find by email for account linking
      employee = await this.findByEmail(email);
      const whitelistCheck = await whitelistService.isAllowed(idpId, email, idpSubject, username);

      if (!whitelistCheck.allowed) {
        console.log(`[UserMapping] User ${email} not on whitelist for IdP ${idpId}`);
        throw new Error('Your account is not pre-approved for registration. Please contact an administrator.');
      }

      if (employee) {
        // Link existing employee to this IdP
        await this.createIdentityLink(employee.id, idpId, idpSubject, email, accessToken, refreshToken);
        console.log(`[UserMapping] Linked existing employee ${employee.id} to IdP ${idpId}`);
        const whitelistCheck = await whitelistService.isAllowed(idpId, email, idpSubject, username);

        if (!whitelistCheck.allowed) {
          console.log(`[UserMapping] User ${email} not on whitelist for IdP ${idpId}`);
          throw new Error('Your account is not pre-approved for registration. Please contact an administrator.');
        }
      } else {
        // New user - check registration mode
        if (config.registrationMode === 'whitelist') {
          // Check whitelist before allowing account creation
          const whitelistCheck = await whitelistService.isAllowed(idpId, email, idpSubject, username);

          if (!whitelistCheck.allowed) {
            console.log(`[UserMapping] User ${email} not on whitelist for IdP ${idpId}`);
            throw new Error('Your account is not pre-approved for registration. Please contact an administrator.');
          }

          console.log(`[UserMapping] User ${email} found on whitelist for IdP ${idpId}`);

          // Use role from whitelist entry if specified
          if (whitelistCheck.entry?.defaultRole) {
            roles = [whitelistCheck.entry.defaultRole];
          }
        }

        // Create new employee
        employee = await this.createEmployee({
          email,
          username: username!,
          firstName,
          lastName,
          roles,
          employeeType: 'personell', // Default type for external users
        });

        // Create identity link
        await this.createIdentityLink(employee.id, idpId, idpSubject, email, accessToken, refreshToken);
        console.log(`[UserMapping] Created new employee ${employee.id} from IdP ${idpId}`);
      }
    } else {
      // Update last login and tokens
      await this.updateIdentityLogin(idpId, idpSubject, accessToken, refreshToken);
    }

    // Fetch current roles
    const currentRoles = await this.getEmployeeRoles(employee.id);

    const finalRoles = currentRoles.length > 0 ? currentRoles : roles;
    return {
      id: employee.id,
      username: employee.username,
      email: employee.email,
      firstname: employee.firstname || undefined,
      lastname: employee.lastname || undefined,
      roles: finalRoles,
      employeeType: employee.employee_type,
      isActive: Boolean(employee.is_active),
      idpId,
      idpSubject,
      // Express.User compatible fields
      userId: employee.id,
      role: finalRoles[0] || 'user',
    };
  }

  /**
   * Extract a claim value using dot notation path
   */
  private extractClaim(claims: Record<string, unknown>, path: string): unknown {
    if (!path) return undefined;
    return path.split('.').reduce<unknown>((obj, key) => {
      if (obj && typeof obj === 'object' && key in obj) {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, claims);
  }

  /**
   * Map IdP roles/groups to internal roles
   */
  private mapRoles(idpRoles: unknown[], config: IdpConfig): string[] {
    // Role mapping configuration (could be made configurable per IdP)
    const roleMapping: Record<string, string> = {
      admin: 'admin',
      administrators: 'admin',
      Admin: 'admin',
      Administrators: 'admin',
      maintenance: 'maintenance',
      Maintenance: 'maintenance',
      user: 'user',
      users: 'user',
      User: 'user',
      Users: 'user',
    };

    const mapped = idpRoles
      .filter((r): r is string => typeof r === 'string')
      .map((r) => roleMapping[r])
      .filter((r): r is string => r !== undefined);

    return mapped.length > 0 ? [...new Set(mapped)] : [config.defaultRole];
  }

  /**
   * Find employee by IdP identity
   */
  private async findByIdentity(idpId: string, idpSubject: string): Promise<EmployeeRow | null> {
    const identity = await db.get<IdentityRow>(
      'SELECT * FROM employee_identities WHERE idp_id = ? AND idp_subject = ?',
      [idpId, idpSubject]
    );

    if (!identity) {
      return null;
    }

    const employee = await db.get<EmployeeRow>(
      'SELECT * FROM employees WHERE id = ? AND is_active = 1',
      [identity.employee_id]
    );

    return employee ?? null;
  }

  /**
   * Find employee by email
   */
  private async findByEmail(email: string): Promise<EmployeeRow | null> {
    const employee = await db.get<EmployeeRow>(
      'SELECT * FROM employees WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );

    return employee ?? null;
  }

  /**
   * Create a new employee
   */
  private async createEmployee(data: {
    email: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    roles: string[];
    employeeType: string;
  }): Promise<EmployeeRow> {
    const id = uuidv4();
    const placeholderPassword = `EXTERNAL_AUTH_${uuidv4()}`; // Not used for login

    await db.run(
      `INSERT INTO employees (id, username, email, password, firstname, lastname, employee_type, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
      [id, data.username, data.email.toLowerCase(), placeholderPassword, data.firstName || null, data.lastName || null, data.employeeType]
    );

    // Assign roles
    for (const role of data.roles) {
      await db.run(
        'INSERT OR IGNORE INTO employee_roles (employee_id, role) VALUES (?, ?)',
        [id, role]
      );
    }

    return {
      id,
      username: data.username,
      email: data.email.toLowerCase(),
      firstname: data.firstName,
      lastname: data.lastName,
      employee_type: data.employeeType,
      is_active: 1,
    };
  }

  /**
   * Create identity link between employee and IdP
   */
  private async createIdentityLink(
    employeeId: string,
    idpId: string,
    idpSubject: string,
    idpEmail: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    const id = uuidv4();

    await db.run(
      `INSERT INTO employee_identities
       (id, employee_id, idp_id, idp_subject, idp_email, access_token, refresh_token, created_at, last_login)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, employeeId, idpId, idpSubject, idpEmail, accessToken || null, refreshToken || null]
    );
  }

  /**
   * Update identity link on login
   */
  private async updateIdentityLogin(
    idpId: string,
    idpSubject: string,
    accessToken?: string,
    refreshToken?: string
  ): Promise<void> {
    await db.run(
      `UPDATE employee_identities
       SET last_login = datetime('now'),
           access_token = COALESCE(?, access_token),
           refresh_token = COALESCE(?, refresh_token)
       WHERE idp_id = ? AND idp_subject = ?`,
      [accessToken || null, refreshToken || null, idpId, idpSubject]
    );
  }

  /**
   * Get employee roles
   */
  private async getEmployeeRoles(employeeId: string): Promise<string[]> {
    const rows = await db.all<{ role: string }>(
      'SELECT role FROM employee_roles WHERE employee_id = ?',
      [employeeId]
    );
    return rows.map((r) => r.role);
  }

  /**
   * Unlink an employee from an IdP
   */
  async unlinkIdentity(employeeId: string, idpId: string): Promise<void> {
    await db.run(
      'DELETE FROM employee_identities WHERE employee_id = ? AND idp_id = ?',
      [employeeId, idpId]
    );
  }

  /**
   * Get all linked identities for an employee
   */
  async getLinkedIdentities(employeeId: string): Promise<Array<{ idpId: string; idpEmail: string; lastLogin: string }>> {
    const rows = await db.all<{ idp_id: string; idp_email: string; last_login: string }>(
      'SELECT idp_id, idp_email, last_login FROM employee_identities WHERE employee_id = ?',
      [employeeId]
    );
    return rows.map((r) => ({
      idpId: r.idp_id,
      idpEmail: r.idp_email,
      lastLogin: r.last_login,
    }));
  }
}

export const userMappingService = new UserMappingService();
