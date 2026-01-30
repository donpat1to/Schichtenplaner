PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA secure_delete = ON;
PRAGMA auto_vacuum = INCREMENTAL;

-- Employee Types
CREATE TABLE IF NOT EXISTS employee_types (
  type TEXT PRIMARY KEY,
  category TEXT CHECK(category IN ('internal', 'external')) NOT NULL,
  has_contract_type BOOLEAN NOT NULL DEFAULT FALSE
);

-- =====================================================
-- Roles
-- =====================================================
-- Default Employee Types
-- 'manager' and 'apprentice' contract_type_default = flexible
-- 'personell' contract_type_default = small
-- employee_types category 'external' contract_type = NONE
-- moved experienced and trainee into personell -> is_trainee boolean added in employees
INSERT OR IGNORE INTO employee_types (type, category, has_contract_type) VALUES 
  ('manager', 'internal', 1),
  ('personell', 'internal', 1),
  ('apprentice', 'internal', 1),
  ('guest', 'external', 0);

-- Roles lookup table
CREATE TABLE IF NOT EXISTS roles (
  role TEXT PRIMARY KEY CHECK(role IN ('admin', 'user', 'maintenance')),
  authority_level INTEGER NOT NULL UNIQUE CHECK(authority_level BETWEEN 1 AND 100),
  description TEXT
);

-- =====================================================
-- Employees
-- =====================================================
-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,
  employee_type TEXT NOT NULL REFERENCES employee_types(type),
  contract_type TEXT CHECK(contract_type IN ('small', 'large', 'flexible')),
  can_work_alone BOOLEAN DEFAULT FALSE,
  is_trainee BOOLEAN DEFAULT FALSE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT DEFAULT NULL
);

-- Roles Employee Junction table (NACH employees und roles)
CREATE TABLE IF NOT EXISTS employee_roles (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL REFERENCES roles(role),
  PRIMARY KEY (employee_id, role)
);

-- Insert default roles (NACH roles Tabelle)
INSERT OR IGNORE INTO roles (role, authority_level, description) VALUES 
  ('admin', 100, 'Vollzugriff'),
  ('maintenance', 50, 'Wartungszugriff'),
  ('user', 10, 'Standardbenutzer');

-- =====================================================
-- Shift Plans
-- =====================================================
-- Shift plans table
CREATE TABLE IF NOT EXISTS shift_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT,
  end_date TEXT,
  is_template BOOLEAN DEFAULT FALSE,
  status TEXT CHECK(status IN ('draft', 'published', 'archived', 'template')) DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES employees(id)
);

-- Time slots within plans
CREATE TABLE IF NOT EXISTS time_slots (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  description TEXT,
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE
);

-- Shifts table (defines shifts for each day of week in the plan)
CREATE TABLE IF NOT EXISTS shifts (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  time_slot_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  required_employees INTEGER NOT NULL CHECK (required_employees >= 1 AND required_employees <= 10) DEFAULT 2,
  min_employees INTEGER NOT NULL CHECK (required_employees >= 1 AND required_employees <= 10) DEFAULT 1,
  max_employees INTEGER NOT NULL CHECK (required_employees >= 1 AND required_employees <= 10) DEFAULT 2,
  color TEXT DEFAULT '#3498db',
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
  UNIQUE(plan_id, time_slot_id, day_of_week)
);

-- Employee assignments to specific shifts
CREATE TABLE IF NOT EXISTS shift_assignments (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (assigned_by) REFERENCES employees(id),
  UNIQUE(plan_id, shift_id, employee_id)
);

-- Employee availability preferences for specific shift plans
CREATE TABLE IF NOT EXISTS employee_availability (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  shift_id TEXT NOT NULL,
  preference_level INTEGER CHECK(preference_level IN (1, 2, 3)) NOT NULL,
  notes TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  UNIQUE(employee_id, plan_id, shift_id)
);

-- =====================================================
-- Weekly Plans
-- =====================================================

-- Weekly Plans (main plan table)
CREATE TABLE IF NOT EXISTS weekly_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT CHECK(status IN ('draft', 'published', 'archived')) DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES employees(id)
);

-- Weeks within a plan
CREATE TABLE IF NOT EXISTS plan_weeks (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  min_employees INTEGER DEFAULT 2,
  max_employees INTEGER DEFAULT 4,
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
  UNIQUE(plan_id, week_number)
);

-- Employee preferences per week (3-tier: 1=Preferred, 2=Available, 3=Unavailable)
CREATE TABLE IF NOT EXISTS weekly_preferences (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  week_id TEXT NOT NULL,
  preference_level INTEGER CHECK(preference_level IN (1, 2, 3)) NOT NULL,
  notes TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (week_id) REFERENCES plan_weeks(id) ON DELETE CASCADE,
  UNIQUE(employee_id, plan_id, week_id)
);

-- How many weeks each employee should work
CREATE TABLE IF NOT EXISTS weekly_work_requirements (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  required_weeks INTEGER NOT NULL CHECK(required_weeks >= 0),
  assignment_style TEXT CHECK(assignment_style IN ('consecutive', 'scattered', 'flexible')) DEFAULT 'flexible',
  assignment_style_consecutive INTEGER DEFAULT 1,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
  UNIQUE(employee_id, plan_id)
);

-- Assignment results
CREATE TABLE IF NOT EXISTS weekly_assignments (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  week_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (week_id) REFERENCES plan_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES employees(id),
  UNIQUE(plan_id, week_id, employee_id)
);

-- =====================================================
-- External Identity Providers (OIDC/OAuth)
-- =====================================================

-- Identity Providers configuration (stored in DB for hot-reload)
CREATE TABLE IF NOT EXISTS identity_providers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE, -- URL-friendly identifier (e.g., 'authentik', 'azure-ad')
  name TEXT NOT NULL,
  type TEXT CHECK(type IN ('oidc', 'saml')) DEFAULT 'oidc',
  enabled BOOLEAN DEFAULT TRUE,

  -- OIDC Configuration
  issuer TEXT NOT NULL,
  authorization_url TEXT,
  token_url TEXT,
  userinfo_url TEXT,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,

  -- Scopes (JSON array)
  scope TEXT DEFAULT '["openid", "profile", "email"]',

  -- Claim mapping (JSON object)
  claim_mapping TEXT DEFAULT '{"id": "sub", "email": "email", "firstName": "given_name", "lastName": "family_name"}',

  -- Restrictions
  allowed_domains TEXT, -- JSON array of allowed email domains
  default_role TEXT DEFAULT 'user',

  -- Security
  pkce_enabled BOOLEAN DEFAULT TRUE,

  -- Registration mode: 'open' = auto-create accounts, 'whitelist' = require pre-approval
  registration_mode TEXT DEFAULT 'whitelist' CHECK(registration_mode IN ('open', 'whitelist')),

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employee external identities (links employees to IdP accounts)
CREATE TABLE IF NOT EXISTS employee_identities (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  idp_id TEXT NOT NULL REFERENCES identity_providers(id) ON DELETE CASCADE,
  idp_subject TEXT NOT NULL, -- The 'sub' claim from the IdP
  idp_email TEXT, -- Email from IdP (for reference)

  -- Token storage (optional, for refresh tokens)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,

  UNIQUE(idp_id, idp_subject), -- Same IdP user can't be linked twice
  UNIQUE(employee_id, idp_id)  -- One employee can have one identity per IdP
);

-- IDP User Whitelist (pre-approved users for whitelist registration mode)
CREATE TABLE IF NOT EXISTS idp_user_whitelist (
  id TEXT PRIMARY KEY,
  idp_id TEXT NOT NULL REFERENCES identity_providers(id) ON DELETE CASCADE,
  identifier_type TEXT NOT NULL CHECK(identifier_type IN ('username', 'email', 'subject')),
  identifier_value TEXT NOT NULL,
  default_role TEXT DEFAULT 'user',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT REFERENCES employees(id),
  UNIQUE(idp_id, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_idp_whitelist_lookup ON idp_user_whitelist(idp_id, identifier_type, identifier_value);

-- =====================================================
-- Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_idp_whitelist_lookup ON idp_user_whitelist(idp_id, identifier_type, identifier_value);
CREATE INDEX IF NOT EXISTS idx_identity_providers_enabled ON identity_providers(enabled);
CREATE INDEX IF NOT EXISTS idx_identity_providers_slug ON identity_providers(slug);
CREATE INDEX IF NOT EXISTS idx_employee_identities_employee ON employee_identities(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_identities_idp ON employee_identities(idp_id);
CREATE INDEX IF NOT EXISTS idx_employee_identities_subject ON employee_identities(idp_id, idp_subject);

CREATE INDEX IF NOT EXISTS idx_employees_username ON employees(username);
CREATE INDEX IF NOT EXISTS idx_employees_email_active ON employees(email, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_type_active ON employees(employee_type, is_active);
CREATE INDEX IF NOT EXISTS idx_employee_roles_employee ON employee_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON employee_roles(role);

CREATE INDEX IF NOT EXISTS idx_shift_plans_status_date ON shift_plans(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_shift_plans_created_by ON shift_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_shift_plans_template ON shift_plans(is_template, status);
CREATE INDEX IF NOT EXISTS idx_time_slots_plan ON time_slots(plan_id);

CREATE INDEX IF NOT EXISTS idx_shifts_plan_day ON shifts(plan_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_shifts_required_employees ON shifts(required_employees);
CREATE INDEX IF NOT EXISTS idx_shifts_plan_time ON shifts(plan_id, time_slot_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON shift_assignments(shift_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_plan ON shift_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee ON shift_assignments(employee_id);

CREATE INDEX IF NOT EXISTS idx_employee_availability_employee_plan ON employee_availability(employee_id, plan_id);

CREATE INDEX IF NOT EXISTS idx_weekly_plans_status ON weekly_plans(status);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_created_by ON weekly_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_weekly_plans_dates ON weekly_plans(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_plan_weeks_plan ON plan_weeks(plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_preferences_employee ON weekly_preferences(employee_id);
CREATE INDEX IF NOT EXISTS idx_weekly_preferences_plan ON weekly_preferences(plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_preferences_week ON weekly_preferences(week_id);
CREATE INDEX IF NOT EXISTS idx_weekly_work_requirements_employee ON weekly_work_requirements(employee_id);
CREATE INDEX IF NOT EXISTS idx_weekly_work_requirements_plan ON weekly_work_requirements(plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_assignments_plan ON weekly_assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_weekly_assignments_week ON weekly_assignments(week_id);
CREATE INDEX IF NOT EXISTS idx_weekly_assignments_employee ON weekly_assignments(employee_id);