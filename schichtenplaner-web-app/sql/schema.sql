-- Schichtenplaner Database Schema
-- MySQL 5.7+ / MariaDB 10.3+

-- Create database with proper charset
CREATE DATABASE IF NOT EXISTS schichtenplaner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE schichtenplaner;

-- Enable strict mode for data integrity
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- ============================================================================
-- Table 1: users - Employees and Authentication
-- ============================================================================
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  employee_type ENUM('manager', 'personell', 'apprentice', 'guest') NOT NULL,
  contract_type ENUM('small', 'large', 'flexible') DEFAULT NULL,
  can_work_alone TINYINT(1) DEFAULT 1,
  is_trainee TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME DEFAULT NULL,
  INDEX idx_username (username),
  INDEX idx_employee_type (employee_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 2: shift_plans - Shift Plan Metadata
-- ============================================================================
CREATE TABLE shift_plans (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_by (created_by),
  INDEX idx_dates (start_date, end_date),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 3: time_slots - Time Slot Definitions
-- ============================================================================
CREATE TABLE time_slots (
  id CHAR(36) PRIMARY KEY,
  plan_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  INDEX idx_plan_id (plan_id),
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 4: shifts - Shift Instances
-- ============================================================================
CREATE TABLE shifts (
  id CHAR(36) PRIMARY KEY,
  plan_id CHAR(36) NOT NULL,
  time_slot_id CHAR(36) NOT NULL,
  day_of_week TINYINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  min_employees TINYINT NOT NULL DEFAULT 1 CHECK (min_employees BETWEEN 1 AND 10),
  max_employees TINYINT NOT NULL DEFAULT 2 CHECK (max_employees BETWEEN 1 AND 10),
  color VARCHAR(7) DEFAULT '#3498db',
  INDEX idx_plan_day (plan_id, day_of_week),
  INDEX idx_time_slot (time_slot_id),
  UNIQUE KEY unique_shift (plan_id, time_slot_id, day_of_week),
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 5: shift_availabilities - Employee Preferences for Shifts
-- ============================================================================
CREATE TABLE shift_availabilities (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  shift_id CHAR(36) NOT NULL,
  preference_level TINYINT NOT NULL CHECK (preference_level IN (1, 2, 3)),
  notes TEXT,
  INDEX idx_employee_plan (employee_id, plan_id),
  INDEX idx_shift (shift_id),
  UNIQUE KEY unique_availability (employee_id, plan_id, shift_id),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 6: shift_assignments - Final Shift Assignments
-- ============================================================================
CREATE TABLE shift_assignments (
  id CHAR(36) PRIMARY KEY,
  plan_id CHAR(36) NOT NULL,
  shift_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by CHAR(36) NOT NULL,
  INDEX idx_plan (plan_id),
  INDEX idx_shift (shift_id),
  INDEX idx_employee (employee_id),
  UNIQUE KEY unique_assignment (plan_id, shift_id, employee_id),
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 7: weekly_plans - Weekly Plan Metadata
-- ============================================================================
CREATE TABLE weekly_plans (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  work_days VARCHAR(20) DEFAULT '1,2,3,4,5',
  status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
  created_by CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_by (created_by),
  INDEX idx_dates (start_date, end_date),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 8: plan_weeks - Individual Weeks in a Plan
-- ============================================================================
CREATE TABLE plan_weeks (
  id CHAR(36) PRIMARY KEY,
  plan_id CHAR(36) NOT NULL,
  week_number INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  min_employees TINYINT DEFAULT 2,
  max_employees TINYINT DEFAULT 4,
  INDEX idx_plan (plan_id),
  UNIQUE KEY unique_week (plan_id, week_number),
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 9: weekly_preferences - Employee Preferences per Week
-- ============================================================================
CREATE TABLE weekly_preferences (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  week_id CHAR(36) NOT NULL,
  preference_level TINYINT NOT NULL CHECK (preference_level IN (1, 2, 3)),
  notes TEXT,
  INDEX idx_employee (employee_id),
  INDEX idx_plan (plan_id),
  INDEX idx_week (week_id),
  UNIQUE KEY unique_preference (employee_id, plan_id, week_id),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (week_id) REFERENCES plan_weeks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 10: work_requirements - Required Weeks per Employee
-- ============================================================================
CREATE TABLE work_requirements (
  id CHAR(36) PRIMARY KEY,
  employee_id CHAR(36) NOT NULL,
  plan_id CHAR(36) NOT NULL,
  required_weeks TINYINT NOT NULL DEFAULT 0 CHECK (required_weeks >= 0),
  assignment_style ENUM('consecutive', 'scattered', 'flexible') DEFAULT 'flexible',
  assignment_style_consecutive TINYINT DEFAULT 1,
  INDEX idx_employee (employee_id),
  INDEX idx_plan (plan_id),
  UNIQUE KEY unique_requirement (employee_id, plan_id),
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 11: weekly_assignments - Final Weekly Assignments
-- ============================================================================
CREATE TABLE weekly_assignments (
  id CHAR(36) PRIMARY KEY,
  plan_id CHAR(36) NOT NULL,
  week_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by CHAR(36) NOT NULL,
  INDEX idx_plan (plan_id),
  INDEX idx_week (week_id),
  INDEX idx_employee (employee_id),
  UNIQUE KEY unique_assignment (plan_id, week_id, employee_id),
  FOREIGN KEY (plan_id) REFERENCES weekly_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (week_id) REFERENCES plan_weeks(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 12: holidays - Holiday Definitions
-- ============================================================================
CREATE TABLE holidays (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  end_date DATE DEFAULT NULL,
  half_day ENUM('morning', 'afternoon') DEFAULT NULL,
  is_recurring TINYINT(1) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by CHAR(36),
  INDEX idx_date (date),
  INDEX idx_end_date (end_date),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 13: identity_providers - OIDC Provider Configuration (Keycloak)
-- ============================================================================
CREATE TABLE identity_providers (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('oidc', 'saml') DEFAULT 'oidc',
  enabled TINYINT(1) DEFAULT 1,
  issuer VARCHAR(500) NOT NULL,
  authorization_url VARCHAR(500) DEFAULT NULL,
  token_url VARCHAR(500) DEFAULT NULL,
  userinfo_url VARCHAR(500) DEFAULT NULL,
  client_id VARCHAR(255) NOT NULL,
  client_secret VARCHAR(500) NOT NULL,
  scope JSON DEFAULT '["openid", "profile", "email"]',
  claim_mapping JSON DEFAULT '{"id": "sub", "email": "email", "username": "preferred_username", "firstName": "given_name", "lastName": "family_name"}',
  allowed_domains JSON DEFAULT NULL,
  default_role VARCHAR(50) DEFAULT 'user',
  pkce_enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Table 14: user_identities - Link Users to External IdPs
-- ============================================================================
CREATE TABLE user_identities (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  idp_id CHAR(36) NOT NULL,
  idp_subject VARCHAR(255) NOT NULL,
  idp_email VARCHAR(255) DEFAULT NULL,
  access_token TEXT DEFAULT NULL,
  refresh_token TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT NULL,
  INDEX idx_user (user_id),
  INDEX idx_idp_subject (idp_id, idp_subject),
  UNIQUE KEY unique_identity (idp_id, idp_subject),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (idp_id) REFERENCES identity_providers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
