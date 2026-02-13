# Schichtenplaner Migration Guide

## React + Express to PHP Web Application

This document provides a comprehensive blueprint for rewriting the Schichtenplaner from a React+Express application to a simple PHP web application suitable for basic web hosting.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Feature Analysis](#2-feature-analysis)
3. [Database Schema](#3-database-schema)
4. [CP-SAT Solver Constraints](#4-cp-sat-solver-constraints)
5. [File Structure](#5-file-structure)
6. [UI/UX Design Guidelines](#6-uiux-design-guidelines)
7. [PHP-Python Integration](#7-php-python-integration)
8. [Page-by-Page Implementation Guide](#8-page-by-page-implementation-guide)
9. [Security Considerations](#9-security-considerations)
10. [Migration Checklist](#10-migration-checklist)

---

## 1. Executive Summary

### Current Architecture

| Component | Technology |
|-----------|------------|
| Frontend | React 19 with dnd-kit drag-and-drop |
| State Management | AuthContext, NotificationContext |
| Backend | Express.js with JWT authentication |
| Database | SQLite (23 tables) |
| Solver | Python CP-SAT (Google OR-Tools) via worker threads |
| Auth | JWT + OIDC support |

### Target Architecture

| Component | Technology |
|-----------|------------|
| Frontend | Server-rendered PHP + Alpine.js for interactivity |
| State Management | PHP sessions + flash messages |
| Backend | PHP 7.4+ (single application) |
| Database | MySQL 5.7+ / MariaDB 10.3+ (15 essential tables) |
| Solver | Python CP-SAT via shell_exec() |
| Auth | PHP session-based + Keycloak OIDC (local login can be disabled) |

### Technology Stack

- **Server**: PHP 7.4+ with PDO MySQL extension
- **Frontend JS**: Alpine.js 3.x for reactive UI components
- **CSS**: Custom CSS with print-friendly styles
- **Database**: MySQL 5.7+ or MariaDB 10.3+
- **Solver**: Python 3.8+ with Google OR-Tools

---

## 2. Feature Analysis

### Core Features (Must Implement)

| Feature | Description |
|---------|-------------|
| User Authentication | PHP session-based login/logout |
| Employee Management | CRUD for employees with types: manager, personell, apprentice, guest |
| Shift Plans | Create/manage weekly shift schedules with time slots |
| Weekly Plans | Create/manage multi-week assignment plans |
| Preference Entry | 3-tier system: 1=Preferred, 2=Available, 3=Unavailable |
| Manual Assignments | Admin can manually assign employees to shifts/weeks |
| CP-SAT Solver | Automatic assignment generation for both plan types |
| Plan Publishing | Status workflow: draft → published → archived |
| Export | CSV export + print-friendly CSS for reports |

### Employee Types

| Type | Category | Contract Type | Schedulable |
|------|----------|---------------|-------------|
| manager | internal | flexible | No (auto-assigned if preference=1) |
| personell | internal | small/large/flexible | Yes |
| apprentice | internal | flexible | Yes (as trainee) |
| guest | external | none | No |

### Contract Types (Shift Plans)

| Type | Required Shifts | Description |
|------|-----------------|-------------|
| small | 1 | Part-time: exactly 1 shift per plan |
| large | 2 | Full-time: exactly 2 shifts per plan |
| flexible | 0 | No fixed requirement |

### Simplified/Removed Features

| Original Feature | Migration Approach |
|------------------|-------------------|
| Drag-and-drop assignment | Click/dropdown selection |
| OIDC/external auth | **Keycloak OIDC retained** (local login can be disabled via config) |
| Two-step swap chains | Direct assignment only |
| Real-time notifications | Session flash messages |
| WebSocket updates | Page refresh / AJAX polling |

---

## 3. Database Schema

### Overview

The PHP application uses **14 essential tables** supporting both shift plans, weekly plans, and OIDC authentication.

### MySQL Configuration

```sql
-- Create database with proper charset
CREATE DATABASE IF NOT EXISTS schichtenplaner
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE schichtenplaner;

-- Enable strict mode for data integrity
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';
```

### Table Definitions

#### 1. `users` - Employees and Authentication

```sql
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
```

**Notes:**
- `password_hash` stores bcrypt hash from `password_hash()`
- `is_trainee` applies to personell who need supervision
- `can_work_alone` = 0 means employee needs another person on shift
- Using CHAR(36) for UUID primary keys
- Authentication is username-based only (no email)

#### 2. `shift_plans` - Shift Plan Metadata

```sql
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
```

#### 3. `time_slots` - Time Slot Definitions

```sql
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
```

**Example:** "Morning Shift" from 08:00 to 14:00

#### 4. `shifts` - Shift Instances

```sql
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
```

**Notes:**
- `day_of_week`: 1=Monday through 7=Sunday
- Each shift is a combination of time slot + day
- CHECK constraints require MySQL 8.0.16+ (ignored in earlier versions)

#### 5. `shift_availabilities` - Employee Preferences for Shifts

```sql
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
```

**Preference Levels:**
- 1 = Preferred (employee wants this shift)
- 2 = Available (employee can work but has no preference)
- 3 = Unavailable (employee cannot work this shift)

#### 6. `shift_assignments` - Final Shift Assignments

```sql
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
```

#### 7. `weekly_plans` - Weekly Plan Metadata

```sql
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
```

**Notes:**
- `work_days` is a comma-separated list of day numbers (1=Monday)
- Used for display purposes in calendar views

#### 8. `plan_weeks` - Individual Weeks in a Plan

```sql
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
```

#### 9. `weekly_preferences` - Employee Preferences per Week

```sql
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
```

#### 10. `work_requirements` - Required Weeks per Employee

```sql
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
```

**Assignment Styles:**
- `consecutive` - Employee prefers weeks in blocks of `assignment_style_consecutive` size
- `scattered` - Employee prefers weeks spread apart (not adjacent)
- `flexible` - No preference on week distribution

#### 11. `weekly_assignments` - Final Weekly Assignments

```sql
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
```

#### 12. `holidays` - Holiday Definitions

```sql
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
```

#### 13. `identity_providers` - OIDC Provider Configuration (Keycloak)

```sql
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
```

**Notes:**
- `slug` is used in URLs: `/auth/external/{slug}/login`
- `issuer` is the OIDC discovery URL (e.g., `https://keycloak.example.com/realms/myrealm`)
- `claim_mapping` defines how IdP claims map to internal user fields
- Users are auto-created on first OIDC login

**Example Keycloak Configuration:**
```sql
INSERT INTO identity_providers (id, slug, name, issuer, client_id, client_secret) VALUES (
  UUID(),
  'keycloak',
  'Keycloak SSO',
  'https://keycloak.example.com/realms/schichtenplaner',
  'schichtenplaner-app',
  'your-client-secret-here'
);
```

#### 14. `user_identities` - Link Users to External IdPs

```sql
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
```

**Notes:**
- Links internal users to external identity provider accounts
- One user can have multiple linked IdP accounts
- `idp_subject` is the unique user ID from the IdP (usually the `sub` claim)

### Entity Relationship Diagram

```
users (employees)
  │
  ├──< shift_availabilities >── shifts ──< time_slots
  │                                │
  │                                └── shift_plans
  │
  ├──< shift_assignments >── shifts
  │
  ├──< weekly_preferences >── plan_weeks ──< weekly_plans
  │
  ├──< work_requirements >── weekly_plans
  │
  └──< weekly_assignments >── plan_weeks
```

### Initial Admin User

```sql
-- Create initial admin user (password: 'admin123' - CHANGE IN PRODUCTION!)
INSERT INTO users (id, username, password_hash, firstname, lastname, employee_type, role)
VALUES (
  UUID(),
  'admin',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',  -- 'password'
  'System',
  'Administrator',
  'manager',
  'admin'
);
```

---

## 4. CP-SAT Solver Constraints

The application uses Google OR-Tools CP-SAT solver for automatic schedule generation. Both shift and weekly scheduling have hard constraints (must be satisfied) and soft constraints (optimized).

### Shift Scheduling Constraints

#### Hard Constraints

| Constraint | Code Name | Description |
|------------|-----------|-------------|
| Max One Shift Per Day | `MAX_ONE_SHIFT_PER_DAY` | Each employee can work at most 1 shift per day of the week |
| Min/Max Staffing | `MIN_MAX_STAFFING` | Each shift requires `minEmployees ≤ assigned ≤ maxEmployees` |
| Trainee Supervision | `TRAINEE_SUPERVISION` | If a trainee (isTrainee=true) is assigned, at least 1 experienced employee must also be assigned |
| Cannot Work Alone | `CANNOT_WORK_ALONE` | Employees with canWorkAlone=false need at least 1 other employee on the same shift |
| Contract Requirements | `CONTRACT_REQUIREMENTS` | small=1 shift, large=2 shifts exactly; flexible=no constraint |
| Availability | `AVAILABILITY` | preferenceLevel=3 means employee CANNOT be assigned to that shift |

#### Soft Constraints (Objective Function)

| Constraint | Weight | Description |
|------------|--------|-------------|
| Preference Level 1 | +100 points | Maximize assignments to preferred shifts |
| Preference Level 2 | +50 points | Reward assignments to available shifts |
| Day Staffing Balance | -3 to -5 points | Minimize over/under staffing per day |

#### Solver Implementation Details

```python
# Variable creation: x[employee_id, shift_id] = 1 if assigned
for emp in schedulable_employees:
    for shift_id in shifts:
        if preference_level != 3:  # Not unavailable
            var = model.NewBoolVar(f"x_{emp.id}_{shift_id}")

# Hard: Max 1 shift per day
for emp in employees:
    for day in days:
        day_shifts = [vars for vars in shifts if shift.day == day]
        model.Add(sum(day_shifts) <= 1)

# Hard: Min/Max staffing
for shift in shifts:
    shift_vars = [var for (emp, s) in vars if s == shift]
    model.Add(sum(shift_vars) >= shift.min_employees)
    model.Add(sum(shift_vars) <= shift.max_employees)

# Hard: Trainee supervision
for shift in shifts:
    trainee_vars = [var for trainee in trainees]
    experienced_vars = [var for exp in experienced]
    # If any trainee assigned, at least one experienced required
    model.Add(sum(trainee_vars) <= M * sum(experienced_vars))

# Hard: Cannot work alone
for shift in shifts:
    for emp in employees_cannot_work_alone:
        others = [var for other_emp != emp]
        model.Add(emp_var <= sum(others))  # If emp works, someone else must too

# Hard: Contract requirements (exact)
for emp in employees:
    emp_vars = [var for all emp shifts]
    if emp.contract_type == 'small':
        model.Add(sum(emp_vars) == 1)
    elif emp.contract_type == 'large':
        model.Add(sum(emp_vars) == 2)

# Objective: Maximize preferences
objective = []
for (emp_id, shift_id), var in vars:
    if preference == 1:
        objective.append(100 * var)
    elif preference == 2:
        objective.append(50 * var)
model.Maximize(sum(objective))
```

#### Manager Handling (Post-Processing)

Managers are NOT included in the solver optimization. After solving:

1. Find managers with preference_level=1 for each shift
2. Add them as additional assignments (can exceed max_employees)

### Weekly Scheduling Constraints

#### Hard Constraints

| Constraint | Code Name | Description |
|------------|-----------|-------------|
| Unavailability | `UNAVAILABILITY` | preferenceLevel=3 blocks assignment to that week |
| Required Weeks | `REQUIRED_WEEKS` | Each employee must be assigned exactly their `requiredWeeks` count |
| Min/Max Per Week | `MIN_MAX_PER_WEEK` | Each week needs `minEmployees ≤ assigned ≤ maxEmployees` |
| Trainee Supervision | `TRAINEE_SUPERVISION` | Trainees need at least 1 experienced employee in the same week |

#### Soft Constraints (Objective Function)

| Constraint | Weight | Description |
|------------|--------|-------------|
| Preference Level 1 | +100 points | Maximize assignments to preferred weeks |
| Preference Level 2 | +10 points | Small reward for available weeks |
| Consecutive Blocks | +50 points | Bonus when consecutive style employee gets blocks of desired size |
| Scattered Penalty | -30 points | Penalty when scattered style employee gets adjacent weeks |

#### Assignment Styles

| Style | Behavior |
|-------|----------|
| `flexible` | No constraint on week distribution |
| `consecutive` | Bonus for forming blocks of `assignmentStyleConsecutive` consecutive weeks |
| `scattered` | Penalty for adjacent week assignments |

#### Solver Implementation Details

```python
# Variable: assign[employee_id, week_id] = 1 if assigned
for emp in schedulable_employees:
    for week in weeks:
        var = model.NewBoolVar(f"assign_{emp.id}_{week.id}")

# Hard: Unavailability
for emp in employees:
    for week in weeks:
        if preference_level == 3:
            model.Add(var == 0)

# Hard: Required weeks per employee
for emp in employees:
    emp_vars = [var for all emp weeks]
    model.Add(sum(emp_vars) == emp.required_weeks)

# Hard: Min/Max per week
for week in weeks:
    week_vars = [var for all employees]
    model.Add(sum(week_vars) >= week.min_employees)
    model.Add(sum(week_vars) <= week.max_employees)

# Hard: Trainee supervision
for week in weeks:
    trainee_var = vars[(trainee_id, week_id)]
    experienced_vars = [vars[(exp_id, week_id)] for exp in experienced]
    model.Add(trainee_var <= sum(experienced_vars))

# Soft: Consecutive assignment style
if assignment_style == 'consecutive':
    consecutive_size = emp.assignment_style_consecutive
    for i in range(len(weeks) - consecutive_size + 1):
        block_vars = [vars for weeks[i:i+consecutive_size]]
        block_complete = model.NewBoolVar(f"block_{emp}_{i}")
        model.Add(sum(block_vars) >= consecutive_size).OnlyEnforceIf(block_complete)
        objective.append(50 * block_complete)

# Soft: Scattered style (penalty for adjacent)
if assignment_style == 'scattered':
    for i in range(len(weeks) - 1):
        var1, var2 = vars[week[i]], vars[week[i+1]]
        both = model.NewBoolVar(f"both_{emp}_{i}")
        model.AddBoolAnd([var1, var2]).OnlyEnforceIf(both)
        objective.append(-30 * both)  # Penalty
```

### Feasibility Checks

Before solving, the system validates:

1. **Total Capacity**: `sum(required_weeks) <= sum(max_employees)`
2. **Minimum Demand**: `sum(required_weeks) >= sum(min_employees)`
3. **Per-Employee**: `employee.required_weeks <= weeks_available_to_employee`
4. **Per-Week**: `employees_available_for_week >= week.min_employees`

If infeasible, return detailed error messages explaining the issue.

---

## 5. File Structure

```
schichtenplaner-web-app/
├── index.php                    # Main router
├── config.php                   # Database and app configuration
├── .htaccess                    # Apache URL rewriting
├── .env                         # Environment variables (DB credentials)
│
├── assets/
│   ├── css/
│   │   ├── main.css             # Main styles
│   │   └── print.css            # Print-friendly styles
│   └── js/
│       ├── alpine.min.js        # Alpine.js library
│       └── app.js               # Custom JavaScript
│
├── includes/
│   ├── auth.php                 # Authentication functions
│   ├── db.php                   # Database connection and helpers
│   ├── session.php              # Session management
│   ├── flash.php                # Flash message helpers
│   ├── helpers.php              # General utility functions
│   └── oidc.php                 # Keycloak OIDC functions
│
├── templates/
│   ├── layout.php               # Main HTML layout
│   ├── header.php               # Navigation header
│   ├── footer.php               # Footer
│   └── components/
│       ├── alert.php            # Flash message display
│       ├── modal.php            # Modal dialog
│       ├── pagination.php       # Pagination component
│       └── preference-grid.php  # Preference entry grid
│
├── pages/
│   ├── auth/
│   │   ├── login.php            # Login page (local + OIDC buttons)
│   │   ├── logout.php           # Logout handler
│   │   ├── oidc-login.php       # OIDC login initiation
│   │   └── oidc-callback.php    # OIDC callback handler
│   │
│   ├── dashboard.php            # User dashboard
│   │
│   ├── shift-plans/
│   │   ├── index.php            # List shift plans
│   │   ├── create.php           # Create new shift plan
│   │   ├── edit.php             # Edit shift plan
│   │   ├── view.php             # View shift plan assignments
│   │   ├── time-slots.php       # Manage time slots
│   │   └── shifts.php           # Manage shifts (days × time slots)
│   │
│   ├── weekly-plans/
│   │   ├── index.php            # List weekly plans
│   │   ├── create.php           # Create new weekly plan
│   │   ├── edit.php             # Edit weekly plan
│   │   ├── view.php             # View weekly assignments
│   │   └── weeks.php            # Manage weeks in plan
│   │
│   ├── preferences/
│   │   ├── shift.php            # Enter shift preferences
│   │   └── weekly.php           # Enter weekly preferences
│   │
│   ├── assignments/
│   │   ├── shift-manual.php     # Manual shift assignment
│   │   ├── shift-solver.php     # Run shift solver
│   │   ├── weekly-manual.php    # Manual weekly assignment
│   │   └── weekly-solver.php    # Run weekly solver
│   │
│   ├── users/
│   │   ├── index.php            # List users (admin)
│   │   ├── create.php           # Create user (admin)
│   │   ├── edit.php             # Edit user (admin)
│   │   └── delete.php           # Delete user (admin)
│   │
│   └── settings/
│       ├── profile.php          # User profile
│       └── holidays.php         # Holiday management (admin)
│
├── api/
│   ├── shifts.php               # AJAX: Shift operations
│   ├── assignments.php          # AJAX: Assignment operations
│   └── preferences.php          # AJAX: Preference updates
│
├── sql/
│   ├── schema.sql               # Full database schema
│   └── seed.sql                 # Initial data (admin user, etc.)
│
└── solver/
    ├── shift_solver.py          # Shift scheduling CP-SAT solver
    ├── weekly_solver.py         # Weekly scheduling CP-SAT solver
    └── requirements.txt         # Python dependencies (ortools)
```

### .htaccess Configuration

```apache
RewriteEngine On
RewriteBase /

# Redirect to index.php for routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php?route=$1 [QSA,L]

# Protect sensitive files
<FilesMatch "^(config\.php|\.env)$">
    Order deny,allow
    Deny from all
</FilesMatch>
```

### Environment File (.env)

```ini
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_NAME=schichtenplaner
DB_USER=schichtenplaner_user
DB_PASS=your_secure_password

# Application Settings
APP_ENV=development
APP_DEBUG=true
APP_URL=http://localhost:8000

# Authentication Settings
LOCAL_LOGIN_ENABLED=true      # Set to false to disable local username/password login
OIDC_ENABLED=true             # Enable Keycloak OIDC authentication

# Default Keycloak Configuration (alternative to database config)
# KEYCLOAK_ISSUER=https://keycloak.example.com/realms/schichtenplaner
# KEYCLOAK_CLIENT_ID=schichtenplaner-app
# KEYCLOAK_CLIENT_SECRET=your-client-secret

# Python path (for solver)
PYTHON_PATH=/usr/bin/python3
```

---

## 6. UI/UX Design Guidelines

This section defines the visual design system for the PHP web application, ensuring a consistent, professional, and space-efficient user experience.

### Design Philosophy

- **Full-window application**: Maximize screen real estate; avoid excessive margins
- **Minimal page count**: Consolidate views using tabs, accordions, and modals
- **Space-efficient**: Compact but never cramped; every pixel has purpose
- **Simplistic typography**: Clean, readable typewriter-style fonts

### Color Palette

| Role | CSS Variable | Hex Value | Usage |
|------|--------------|-----------|-------|
| Background | `--color-bg` | `#FBFAF6` | Main page background (warm off-white) |
| Text | `--color-text` | `#161718` | Primary text color (near-black) |
| Accent | `--color-accent` | `#51258f` | Buttons, links, highlights (purple) |
| Accent Hover | `--color-accent-hover` | `#3d1c6b` | Hover state for accent elements |
| Border | `--color-border` | `#e0ddd5` | Subtle borders and dividers |
| Shadow | `--color-shadow` | `rgba(22, 23, 24, 0.08)` | Box shadows |
| Selection | `--color-selection` | `rgba(81, 37, 143, 0.15)` | Selected/highlighted items |
| Hover | `--color-hover` | `rgba(22, 23, 24, 0.04)` | Row/item hover backgrounds |
| Success | `--color-success` | `#2e7d32` | Success messages, positive indicators |
| Warning | `--color-warning` | `#f57c00` | Warning messages |
| Error | `--color-error` | `#c62828` | Error messages, destructive actions |

### CSS Variables File

Create `assets/css/variables.css`:

```css
/* assets/css/variables.css - Design System Variables */

:root {
    /* Color Palette */
    --color-bg: #FBFAF6;
    --color-text: #161718;
    --color-accent: #51258f;
    --color-accent-hover: #3d1c6b;
    --color-border: #e0ddd5;
    --color-shadow: rgba(22, 23, 24, 0.08);
    --color-selection: rgba(81, 37, 143, 0.15);
    --color-hover: rgba(22, 23, 24, 0.04);
    --color-success: #2e7d32;
    --color-warning: #f57c00;
    --color-error: #c62828;

    /* Typography */
    --font-family: 'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    --font-size-base: 13px;
    --font-size-sm: 12px;
    --font-size-lg: 14px;
    --font-size-xl: 16px;
    --font-size-h1: 24px;
    --font-size-h2: 20px;
    --font-size-h3: 16px;
    --line-height: 1.5;
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-bold: 600;

    /* Spacing */
    --spacing-xs: 4px;
    --spacing-sm: 8px;
    --spacing-md: 12px;
    --spacing-lg: 16px;
    --spacing-xl: 24px;
    --spacing-2xl: 32px;

    /* Layout */
    --header-height: 48px;
    --sidebar-width: 200px;
    --border-radius: 4px;
    --border-radius-lg: 6px;

    /* Shadows */
    --shadow-sm: 0 1px 2px var(--color-shadow);
    --shadow-md: 0 2px 4px var(--color-shadow);
    --shadow-lg: 0 4px 8px var(--color-shadow);

    /* Transitions */
    --transition-fast: 0.1s ease;
    --transition-normal: 0.2s ease;
}
```

### Typography

The application uses a **typewriter/monospace font** for a clean, technical aesthetic:

**Recommended Font Stack** (in order of preference):
1. **IBM Plex Mono** - Professional, highly readable monospace
2. **JetBrains Mono** - Developer-focused with excellent legibility
3. **Fira Code** - Popular programming font
4. **Consolas** - Windows system fallback
5. **monospace** - System fallback

**Font Loading** (add to `templates/layout.php`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**Font Size Guidelines**:
- Body text: 13px (base)
- Small labels/captions: 12px
- Important text/buttons: 14px
- Page headings (h1): 24px
- Section headings (h2): 20px
- Subsection headings (h3): 16px

### Main Stylesheet

Update `assets/css/main.css` with the design system:

```css
/* assets/css/main.css - Main Application Styles */

@import url('variables.css');

/* Reset & Base */
*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    font-size: var(--font-size-base);
}

body {
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    line-height: var(--line-height);
    color: var(--color-text);
    background-color: var(--color-bg);
    min-height: 100vh;
}

/* Full-window Layout */
.app-container {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

.app-header {
    height: var(--header-height);
    background: var(--color-bg);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    padding: 0 var(--spacing-lg);
    position: sticky;
    top: 0;
    z-index: 100;
}

.app-main {
    flex: 1;
    padding: var(--spacing-lg);
    max-width: 100%;
    overflow-x: auto;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
    font-weight: var(--font-weight-bold);
    line-height: 1.3;
    margin-bottom: var(--spacing-md);
}

h1 { font-size: var(--font-size-h1); }
h2 { font-size: var(--font-size-h2); }
h3 { font-size: var(--font-size-h3); }

p { margin-bottom: var(--spacing-md); }

a {
    color: var(--color-accent);
    text-decoration: none;
    transition: color var(--transition-fast);
}

a:hover {
    color: var(--color-accent-hover);
    text-decoration: underline;
}

/* Buttons */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-sm) var(--spacing-md);
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-medium);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    background: var(--color-bg);
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--transition-fast);
    gap: var(--spacing-xs);
}

.btn:hover {
    background: var(--color-hover);
    border-color: var(--color-text);
}

.btn-primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
}

.btn-primary:hover {
    background: var(--color-accent-hover);
    border-color: var(--color-accent-hover);
}

.btn-danger {
    color: var(--color-error);
    border-color: var(--color-error);
}

.btn-danger:hover {
    background: var(--color-error);
    color: white;
}

.btn-sm {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: var(--font-size-sm);
}

/* Form Elements */
.form-group {
    margin-bottom: var(--spacing-md);
}

label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--spacing-xs);
}

input[type="text"],
input[type="password"],
input[type="email"],
input[type="number"],
input[type="date"],
input[type="time"],
select,
textarea {
    width: 100%;
    padding: var(--spacing-sm);
    font-family: var(--font-family);
    font-size: var(--font-size-base);
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius);
    background: white;
    color: var(--color-text);
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

input:focus,
select:focus,
textarea:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-selection);
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-base);
}

th, td {
    padding: var(--spacing-sm) var(--spacing-md);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
}

th {
    font-weight: var(--font-weight-medium);
    background: var(--color-hover);
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

tr:hover td {
    background: var(--color-hover);
}

/* Alerts */
.alert {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
    font-size: var(--font-size-sm);
    border: 1px solid;
}

.alert-success {
    background: rgba(46, 125, 50, 0.1);
    border-color: var(--color-success);
    color: var(--color-success);
}

.alert-warning {
    background: rgba(245, 124, 0, 0.1);
    border-color: var(--color-warning);
    color: var(--color-warning);
}

.alert-error {
    background: rgba(198, 40, 40, 0.1);
    border-color: var(--color-error);
    color: var(--color-error);
}

/* Cards */
.card {
    background: white;
    border: 1px solid var(--color-border);
    border-radius: var(--border-radius-lg);
    padding: var(--spacing-lg);
    box-shadow: var(--shadow-sm);
}

.card-header {
    margin: calc(-1 * var(--spacing-lg));
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md) var(--spacing-lg);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-hover);
}

/* Preference Grid Colors */
.pref-preferred {
    background-color: rgba(46, 125, 50, 0.15);
    border-color: var(--color-success);
}

.pref-available {
    background-color: rgba(245, 124, 0, 0.1);
    border-color: var(--color-warning);
}

.pref-unavailable {
    background-color: rgba(198, 40, 40, 0.1);
    border-color: var(--color-error);
}

/* Selection States */
::selection {
    background: var(--color-selection);
}

.selected {
    background: var(--color-selection);
}

/* Utility Classes */
.text-sm { font-size: var(--font-size-sm); }
.text-lg { font-size: var(--font-size-lg); }
.text-muted { color: rgba(22, 23, 24, 0.6); }
.text-center { text-align: center; }
.text-right { text-align: right; }

.mt-sm { margin-top: var(--spacing-sm); }
.mt-md { margin-top: var(--spacing-md); }
.mt-lg { margin-top: var(--spacing-lg); }
.mb-sm { margin-bottom: var(--spacing-sm); }
.mb-md { margin-bottom: var(--spacing-md); }
.mb-lg { margin-bottom: var(--spacing-lg); }

.flex { display: flex; }
.flex-between { justify-content: space-between; }
.flex-center { align-items: center; }
.gap-sm { gap: var(--spacing-sm); }
.gap-md { gap: var(--spacing-md); }
```

### Updated File Structure

Add `variables.css` to the assets structure:

```
assets/
├── css/
│   ├── variables.css        # Design system variables (NEW)
│   ├── main.css             # Main styles (imports variables.css)
│   └── print.css            # Print-friendly styles
└── js/
    ├── alpine.min.js        # Alpine.js library
    └── app.js               # Custom JavaScript
```

### Strategies for Reducing UI Complexity

To minimize the number of pages/views while maintaining functionality:

#### 1. Single-Page Dashboard with Tabs

Combine multiple views into a tabbed interface:

```html
<div x-data="{ activeTab: 'shifts' }" class="dashboard-tabs">
    <div class="tab-nav">
        <button @click="activeTab = 'shifts'" :class="{ active: activeTab === 'shifts' }">
            Shift Plans
        </button>
        <button @click="activeTab = 'weekly'" :class="{ active: activeTab === 'weekly' }">
            Weekly Plans
        </button>
        <button @click="activeTab = 'users'" :class="{ active: activeTab === 'users' }" x-show="isAdmin">
            Users
        </button>
    </div>

    <div x-show="activeTab === 'shifts'">
        <!-- Shift plans content -->
    </div>
    <div x-show="activeTab === 'weekly'">
        <!-- Weekly plans content -->
    </div>
    <div x-show="activeTab === 'users'" x-cloak>
        <!-- User management content -->
    </div>
</div>
```

#### 2. Inline Editing

Edit records in place instead of navigating to separate edit pages:

```html
<tr x-data="{ editing: false }">
    <td>
        <span x-show="!editing"><?= h($user['firstname']) ?></span>
        <input x-show="editing" x-model="firstname" type="text" value="<?= h($user['firstname']) ?>">
    </td>
    <td>
        <button x-show="!editing" @click="editing = true" class="btn btn-sm">Edit</button>
        <button x-show="editing" @click="save(); editing = false" class="btn btn-sm btn-primary">Save</button>
        <button x-show="editing" @click="editing = false" class="btn btn-sm">Cancel</button>
    </td>
</tr>
```

#### 3. Modal Dialogs for Quick Actions

Use modals instead of full page navigation for create/delete operations:

```html
<!-- Trigger button -->
<button @click="$dispatch('open-modal', 'create-user')" class="btn btn-primary">
    Add User
</button>

<!-- Modal component -->
<div x-data="{ open: false, modalId: '' }"
     @open-modal.window="modalId = $event.detail; open = true"
     @close-modal.window="open = false"
     x-show="open && modalId === 'create-user'"
     class="modal-overlay">
    <div class="modal-content" @click.away="open = false">
        <h3>Create User</h3>
        <form @submit.prevent="createUser()">
            <!-- Form fields -->
            <div class="modal-actions">
                <button type="button" @click="open = false" class="btn">Cancel</button>
                <button type="submit" class="btn btn-primary">Create</button>
            </div>
        </form>
    </div>
</div>
```

#### 4. Collapsible Sections (Accordions)

Hide complexity until the user needs it:

```html
<div x-data="{ open: false }" class="accordion">
    <button @click="open = !open" class="accordion-header">
        <span>Advanced Options</span>
        <span x-text="open ? '−' : '+'"></span>
    </button>
    <div x-show="open" x-collapse class="accordion-content">
        <!-- Advanced options content -->
    </div>
</div>
```

#### 5. Master-Detail Layout

Show list and detail on the same page:

```html
<div class="master-detail">
    <div class="master-list">
        <div x-data="{ selectedId: null }">
            <?php foreach ($plans as $plan): ?>
            <div @click="selectedId = '<?= $plan['id'] ?>'; loadDetail(selectedId)"
                 :class="{ 'selected': selectedId === '<?= $plan['id'] ?>' }"
                 class="list-item">
                <?= h($plan['name']) ?>
            </div>
            <?php endforeach; ?>
        </div>
    </div>
    <div class="detail-panel" x-html="detailContent">
        <p class="text-muted">Select a plan to view details</p>
    </div>
</div>
```

#### 6. Contextual Actions

Show actions on hover or selection instead of always visible:

```css
.list-item .actions {
    opacity: 0;
    transition: opacity var(--transition-fast);
}

.list-item:hover .actions,
.list-item.selected .actions {
    opacity: 1;
}
```

### Recommended Page Consolidation

| Original Pages | Consolidated Approach |
|---------------|----------------------|
| `/shift-plans/index`, `/shift-plans/create`, `/shift-plans/edit` | Single page with modal for create, inline edit for existing |
| `/users/index`, `/users/create`, `/users/edit` | Single admin page with modals and inline editing |
| `/preferences/shift`, `/preferences/weekly` | Tabbed interface on single preferences page |
| `/shift-plans/view`, `/assignments/shift-manual` | Combined view with toggle between view-only and edit mode |
| Dashboard + Plan lists | Unified dashboard with tabbed sections |

### Layout Template Example

```php
<!-- templates/layout.php -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= h($pageTitle ?? 'Schichtenplaner') ?></title>

    <!-- Google Font: IBM Plex Mono -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">

    <!-- Stylesheets -->
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/print.css" media="print">

    <!-- Alpine.js -->
    <script defer src="/assets/js/alpine.min.js"></script>
</head>
<body>
    <div class="app-container">
        <header class="app-header">
            <div class="flex flex-between flex-center" style="width: 100%;">
                <a href="/dashboard" class="logo">Schichtenplaner</a>
                <nav class="flex gap-md flex-center">
                    <?php if (isLoggedIn()): ?>
                        <span class="text-sm text-muted"><?= h($_SESSION['username']) ?></span>
                        <a href="/logout" class="btn btn-sm">Logout</a>
                    <?php endif; ?>
                </nav>
            </div>
        </header>

        <main class="app-main">
            <?php displayFlashes(); ?>
            <?php include $contentTemplate ?? 'pages/dashboard.php'; ?>
        </main>
    </div>
</body>
</html>
```

---

## 7. PHP-Python Integration

### Overview

The CP-SAT solver runs as Python scripts called from PHP via `shell_exec()`. Data is passed as JSON through stdin, and results are returned as JSON through stdout.

### Calling the Solver

```php
<?php
// includes/solver.php

function runShiftSolver(array $data): array {
    $input = json_encode($data);
    $escapedInput = escapeshellarg($input);

    $pythonPath = getenv('PYTHON_PATH') ?: '/usr/bin/python3';
    $scriptPath = __DIR__ . '/../solver/shift_solver.py';

    $cmd = "echo $escapedInput | $pythonPath $scriptPath 2>/dev/null";
    $output = shell_exec($cmd);

    if ($output === null) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Solver execution failed'],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    $result = json_decode($output, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Invalid solver response: ' . json_last_error_msg()],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    return $result;
}

function runWeeklySolver(array $data): array {
    $input = json_encode($data);
    $escapedInput = escapeshellarg($input);

    $pythonPath = getenv('PYTHON_PATH') ?: '/usr/bin/python3';
    $scriptPath = __DIR__ . '/../solver/weekly_solver.py';

    $cmd = "echo $escapedInput | $pythonPath $scriptPath 2>/dev/null";
    $output = shell_exec($cmd);

    if ($output === null) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Solver execution failed'],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    return json_decode($output, true) ?? [
        'success' => false,
        'assignments' => [],
        'violations' => ['Invalid solver response'],
        'metadata' => ['status' => 'ERROR']
    ];
}
```

### Preparing Solver Input

```php
<?php
// Example: Preparing shift solver input

function prepareShiftSolverInput(string $planId): array {
    global $pdo;

    // Get plan
    $stmt = $pdo->prepare("SELECT * FROM shift_plans WHERE id = ?");
    $stmt->execute([$planId]);
    $plan = $stmt->fetch();

    // Get employees (schedulable)
    $stmt = $pdo->query("
        SELECT id, firstname, lastname, employee_type, contract_type,
               can_work_alone, is_trainee, is_active
        FROM users
        WHERE is_active = 1
    ");
    $employees = $stmt->fetchAll();

    // Get shifts with time slot info
    $stmt = $pdo->prepare("
        SELECT s.*, t.name as time_slot_name, t.start_time, t.end_time
        FROM shifts s
        JOIN time_slots t ON s.time_slot_id = t.id
        WHERE s.plan_id = ?
    ");
    $stmt->execute([$planId]);
    $shifts = $stmt->fetchAll();

    // Get availabilities
    $stmt = $pdo->prepare("
        SELECT employee_id, shift_id, preference_level, notes
        FROM shift_availabilities
        WHERE plan_id = ?
    ");
    $stmt->execute([$planId]);
    $availabilities = $stmt->fetchAll();

    // Format for solver
    return [
        'plan' => [
            'id' => $plan['id'],
            'name' => $plan['name']
        ],
        'employees' => array_map(fn($e) => [
            'id' => $e['id'],
            'firstname' => $e['firstname'],
            'lastname' => $e['lastname'],
            'employeeType' => $e['employee_type'],
            'contractType' => $e['contract_type'] ?? 'large',
            'canWorkAlone' => (bool)$e['can_work_alone'],
            'isTrainee' => (bool)$e['is_trainee'],
            'isActive' => (bool)$e['is_active']
        ], $employees),
        'shifts' => array_map(fn($s) => [
            'id' => $s['id'],
            'planId' => $s['plan_id'],
            'timeSlotId' => $s['time_slot_id'],
            'dayOfWeek' => (int)$s['day_of_week'],
            'minEmployees' => (int)$s['min_employees'],
            'maxEmployees' => (int)$s['max_employees'],
            'timeSlot' => [
                'name' => $s['time_slot_name'],
                'startTime' => $s['start_time'],
                'endTime' => $s['end_time']
            ]
        ], $shifts),
        'availabilities' => array_map(fn($a) => [
            'employeeId' => $a['employee_id'],
            'shiftId' => $a['shift_id'],
            'preferenceLevel' => (int)$a['preference_level']
        ], $availabilities),
        'solverOptions' => [
            'maxTimeInSeconds' => 60,
            'numSearchWorkers' => 4
        ]
    ];
}
```

### Processing Solver Results

```php
<?php
// Example: Processing shift solver results

function processSolverResults(string $planId, array $result, string $assignedBy): bool {
    global $pdo;

    if (!$result['success']) {
        return false;
    }

    try {
        $pdo->beginTransaction();

        // Clear existing assignments
        $stmt = $pdo->prepare("DELETE FROM shift_assignments WHERE plan_id = ?");
        $stmt->execute([$planId]);

        // Insert new assignments
        $stmt = $pdo->prepare("
            INSERT INTO shift_assignments (id, plan_id, shift_id, employee_id, assigned_by)
            VALUES (?, ?, ?, ?, ?)
        ");

        foreach ($result['assignments'] as $assignment) {
            $id = generateUUID();
            $stmt->execute([
                $id,
                $planId,
                $assignment['shiftId'],
                $assignment['employeeId'],
                $assignedBy
            ]);
        }

        $pdo->commit();
        return true;

    } catch (Exception $e) {
        $pdo->rollBack();
        return false;
    }
}
```

### Python Dependencies

```txt
# solver/requirements.txt
ortools>=9.7
```

Install with: `pip3 install -r solver/requirements.txt`

---

## 8. Page-by-Page Implementation Guide

### Authentication Pages

#### Login (`pages/auth/login.php`)

```php
<?php
require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/flash.php';

// Redirect if already logged in
if (isLoggedIn()) {
    header('Location: /dashboard');
    exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        // Regenerate session ID on login
        session_regenerate_id(true);

        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['employee_type'] = $user['employee_type'];

        // Update last login
        $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$user['id']]);

        flash('success', 'Welcome back, ' . htmlspecialchars($user['firstname']) . '!');
        header('Location: /dashboard');
        exit;
    } else {
        $error = 'Invalid username or password';
    }
}

require __DIR__ . '/../../templates/layout.php';
?>
```

#### Logout (`pages/auth/logout.php`)

```php
<?php
require_once __DIR__ . '/../../includes/session.php';

session_destroy();
setcookie(session_name(), '', time() - 3600, '/');

header('Location: /login');
exit;
```

### Dashboard (`pages/dashboard.php`)

Display:
- Welcome message with user name
- Quick links to preference entry
- Admin: Links to user management and plan creation
- Upcoming assignments (if any published plans)

```php
<?php
require_once __DIR__ . '/../includes/auth.php';
requireLogin();

$userId = $_SESSION['user_id'];
$isAdmin = $_SESSION['role'] === 'admin';

// Get upcoming shift assignments
$stmt = $pdo->prepare("
    SELECT sa.*, s.day_of_week, t.name as time_slot, t.start_time, t.end_time, sp.name as plan_name
    FROM shift_assignments sa
    JOIN shifts s ON sa.shift_id = s.id
    JOIN time_slots t ON s.time_slot_id = t.id
    JOIN shift_plans sp ON sa.plan_id = sp.id
    WHERE sa.employee_id = ? AND sp.status = 'published'
    ORDER BY sp.start_date, s.day_of_week
    LIMIT 10
");
$stmt->execute([$userId]);
$upcomingShifts = $stmt->fetchAll();

// Get upcoming weekly assignments
$stmt = $pdo->prepare("
    SELECT wa.*, pw.week_number, pw.start_date, pw.end_date, wp.name as plan_name
    FROM weekly_assignments wa
    JOIN plan_weeks pw ON wa.week_id = pw.id
    JOIN weekly_plans wp ON wa.plan_id = wp.id
    WHERE wa.employee_id = ? AND wp.status = 'published'
    ORDER BY pw.start_date
    LIMIT 10
");
$stmt->execute([$userId]);
$upcomingWeeks = $stmt->fetchAll();

// Get plans needing preference entry
$stmt = $pdo->prepare("
    SELECT sp.id, sp.name, 'shift' as type
    FROM shift_plans sp
    WHERE sp.status = 'draft'
    AND NOT EXISTS (
        SELECT 1 FROM shift_availabilities sa
        WHERE sa.plan_id = sp.id AND sa.employee_id = ?
    )
    UNION
    SELECT wp.id, wp.name, 'weekly' as type
    FROM weekly_plans wp
    WHERE wp.status = 'draft'
    AND NOT EXISTS (
        SELECT 1 FROM weekly_preferences wpr
        WHERE wpr.plan_id = wp.id AND wpr.employee_id = ?
    )
");
$stmt->execute([$userId, $userId]);
$plansNeedingPrefs = $stmt->fetchAll();

include __DIR__ . '/../templates/layout.php';
```

### User Management (Admin)

#### List Users (`pages/users/index.php`)

```php
<?php
require_once __DIR__ . '/../../includes/auth.php';
requireRole('admin');

$stmt = $pdo->query("
    SELECT id, username, firstname, lastname, employee_type,
           contract_type, is_trainee, is_active, role, last_login
    FROM users
    ORDER BY lastname, firstname
");
$users = $stmt->fetchAll();

include __DIR__ . '/../../templates/layout.php';
```

#### Create User (`pages/users/create.php`)

```php
<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/helpers.php';
requireRole('admin');

$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $firstname = trim($_POST['firstname'] ?? '');
    $lastname = trim($_POST['lastname'] ?? '');
    $employeeType = $_POST['employee_type'] ?? 'personell';
    $contractType = $_POST['contract_type'] ?? null;
    $canWorkAlone = isset($_POST['can_work_alone']) ? 1 : 0;
    $isTrainee = isset($_POST['is_trainee']) ? 1 : 0;
    $role = $_POST['role'] ?? 'user';

    // Validation
    if (empty($username)) $errors[] = 'Username is required';
    if (strlen($password) < 8) $errors[] = 'Password must be at least 8 characters';

    // Check uniqueness
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        $errors[] = 'Username already exists';
    }

    if (empty($errors)) {
        $id = generateUUID();
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("
            INSERT INTO users (id, username, password_hash, firstname, lastname,
                             employee_type, contract_type, can_work_alone, is_trainee, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $id, $username, $passwordHash, $firstname, $lastname,
            $employeeType, $contractType, $canWorkAlone, $isTrainee, $role
        ]);

        flash('success', 'User created successfully');
        header('Location: /users');
        exit;
    }
}

include __DIR__ . '/../../templates/layout.php';
```

### Preference Entry

#### Shift Preferences (`pages/preferences/shift.php`)

Uses Alpine.js for interactive preference grid:

```php
<?php
require_once __DIR__ . '/../../includes/auth.php';
requireLogin();

$planId = $_GET['plan'] ?? null;
$userId = $_SESSION['user_id'];

// Get plan and validate
$stmt = $pdo->prepare("SELECT * FROM shift_plans WHERE id = ? AND status = 'draft'");
$stmt->execute([$planId]);
$plan = $stmt->fetch();

if (!$plan) {
    flash('error', 'Plan not found or not open for preferences');
    header('Location: /dashboard');
    exit;
}

// Get shifts grouped by time slot and day
$stmt = $pdo->prepare("
    SELECT s.*, t.name as time_slot_name, t.start_time, t.end_time
    FROM shifts s
    JOIN time_slots t ON s.time_slot_id = t.id
    WHERE s.plan_id = ?
    ORDER BY t.start_time, s.day_of_week
");
$stmt->execute([$planId]);
$shifts = $stmt->fetchAll();

// Get existing preferences
$stmt = $pdo->prepare("
    SELECT shift_id, preference_level
    FROM shift_availabilities
    WHERE plan_id = ? AND employee_id = ?
");
$stmt->execute([$planId, $userId]);
$prefs = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

$days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Group shifts by time slot
$timeSlots = [];
foreach ($shifts as $shift) {
    $slotId = $shift['time_slot_id'];
    if (!isset($timeSlots[$slotId])) {
        $timeSlots[$slotId] = [
            'name' => $shift['time_slot_name'],
            'start' => $shift['start_time'],
            'end' => $shift['end_time'],
            'shifts' => []
        ];
    }
    $timeSlots[$slotId]['shifts'][$shift['day_of_week']] = $shift;
}

include __DIR__ . '/../../templates/layout.php';
?>

<!-- In the template: -->
<div x-data="preferenceGrid()" class="preference-grid">
    <table>
        <thead>
            <tr>
                <th>Time Slot</th>
                <?php foreach ($days as $i => $day): ?>
                    <th><?= $day ?></th>
                <?php endforeach; ?>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($timeSlots as $slot): ?>
            <tr>
                <td><?= h($slot['name']) ?><br><small><?= $slot['start'] ?> - <?= $slot['end'] ?></small></td>
                <?php for ($day = 1; $day <= 7; $day++): ?>
                    <?php if (isset($slot['shifts'][$day])):
                        $shift = $slot['shifts'][$day];
                        $pref = $prefs[$shift['id']] ?? 2;
                    ?>
                    <td>
                        <div class="pref-cell"
                             x-data="{ level: <?= $pref ?> }"
                             @click="cyclePreference($el, '<?= $shift['id'] ?>')"
                             :class="prefClass(level)">
                            <span x-text="prefLabel(level)"></span>
                        </div>
                    </td>
                    <?php else: ?>
                    <td class="no-shift">-</td>
                    <?php endif; ?>
                <?php endfor; ?>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>

    <button @click="savePreferences('<?= $planId ?>')" class="btn btn-primary">
        Save Preferences
    </button>
</div>

<script>
function preferenceGrid() {
    return {
        preferences: <?= json_encode($prefs) ?>,

        cyclePreference(el, shiftId) {
            let current = this.preferences[shiftId] || 2;
            let next = current === 1 ? 2 : (current === 2 ? 3 : 1);
            this.preferences[shiftId] = next;
            el.__x.$data.level = next;
        },

        prefClass(level) {
            return {1: 'pref-preferred', 2: 'pref-available', 3: 'pref-unavailable'}[level];
        },

        prefLabel(level) {
            return {1: 'Yes!', 2: 'OK', 3: 'No'}[level];
        },

        async savePreferences(planId) {
            const response = await fetch('/api/preferences.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: 'shift',
                    planId: planId,
                    preferences: this.preferences
                })
            });

            if (response.ok) {
                alert('Preferences saved!');
            } else {
                alert('Error saving preferences');
            }
        }
    };
}
</script>
```

### Assignment Management

#### Run Shift Solver (`pages/assignments/shift-solver.php`)

```php
<?php
require_once __DIR__ . '/../../includes/auth.php';
require_once __DIR__ . '/../../includes/solver.php';
requireRole('admin');

$planId = $_GET['plan'] ?? null;
$stmt = $pdo->prepare("SELECT * FROM shift_plans WHERE id = ?");
$stmt->execute([$planId]);
$plan = $stmt->fetch();

if (!$plan) {
    flash('error', 'Plan not found');
    header('Location: /shift-plans');
    exit;
}

$result = null;
$solverRan = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['run_solver'])) {
    $solverInput = prepareShiftSolverInput($planId);
    $result = runShiftSolver($solverInput);
    $solverRan = true;

    if ($result['success']) {
        flash('success', 'Solver found a valid schedule!');
    } else {
        flash('error', 'Solver could not find a valid schedule');
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['apply_assignments'])) {
    $assignments = json_decode($_POST['assignments'], true);

    if (processSolverResults($planId, ['success' => true, 'assignments' => $assignments], $_SESSION['user_id'])) {
        flash('success', 'Assignments applied successfully');
        header('Location: /shift-plans/view?id=' . $planId);
        exit;
    } else {
        flash('error', 'Failed to apply assignments');
    }
}

include __DIR__ . '/../../templates/layout.php';
?>
```

### Plan Views

#### View Shift Plan (`pages/shift-plans/view.php`)

Display a grid showing:
- Time slots as rows
- Days as columns
- Assigned employees in each cell
- Print button for print-friendly view

```php
<?php
require_once __DIR__ . '/../../includes/auth.php';
requireLogin();

$planId = $_GET['id'] ?? null;
$stmt = $pdo->prepare("SELECT * FROM shift_plans WHERE id = ?");
$stmt->execute([$planId]);
$plan = $stmt->fetch();

// Get assignments with employee names
$stmt = $pdo->prepare("
    SELECT sa.*, s.day_of_week, s.time_slot_id,
           u.firstname, u.lastname, u.employee_type
    FROM shift_assignments sa
    JOIN shifts s ON sa.shift_id = s.id
    JOIN users u ON sa.employee_id = u.id
    WHERE sa.plan_id = ?
    ORDER BY s.time_slot_id, s.day_of_week
");
$stmt->execute([$planId]);
$assignments = $stmt->fetchAll();

// Get time slots
$stmt = $pdo->prepare("SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time");
$stmt->execute([$planId]);
$timeSlots = $stmt->fetchAll();

include __DIR__ . '/../../templates/layout.php';
```

---

## 9. Security Considerations

### Password Handling

```php
// Hashing passwords
$hash = password_hash($password, PASSWORD_DEFAULT);

// Verifying passwords
if (password_verify($inputPassword, $storedHash)) {
    // Valid
}

// PASSWORD_DEFAULT uses bcrypt, automatically handles salt
// Cost factor adjusts automatically in future PHP versions
```

### Session Security

```php
<?php
// includes/session.php

// Start session with secure settings
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);  // Enable in production with HTTPS
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_samesite', 'Lax');

session_start();

// Regenerate session ID on login
function regenerateSession() {
    session_regenerate_id(true);
}

// Check if user is logged in
function isLoggedIn(): bool {
    return isset($_SESSION['user_id']);
}

// Require login
function requireLogin() {
    if (!isLoggedIn()) {
        header('Location: /login');
        exit;
    }
}

// Require specific role
function requireRole(string $role) {
    requireLogin();
    if ($_SESSION['role'] !== $role && $_SESSION['role'] !== 'admin') {
        http_response_code(403);
        die('Access denied');
    }
}
```

### CSRF Protection

```php
<?php
// includes/csrf.php

function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrfField(): string {
    return '<input type="hidden" name="csrf_token" value="' . generateCsrfToken() . '">';
}

function validateCsrfToken(): bool {
    $token = $_POST['csrf_token'] ?? '';
    return hash_equals($_SESSION['csrf_token'] ?? '', $token);
}

// Usage in forms:
// <?= csrfField() ?>

// Validation in POST handlers:
if (!validateCsrfToken()) {
    http_response_code(403);
    die('Invalid CSRF token');
}
```

### SQL Injection Prevention

Always use prepared statements:

```php
<?php
// CORRECT: Using prepared statements
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$userId]);

$stmt = $pdo->prepare("SELECT * FROM users WHERE username = :username");
$stmt->execute(['username' => $username]);

// WRONG: Never concatenate user input
// $pdo->query("SELECT * FROM users WHERE id = '$userId'"); // VULNERABLE!
```

### XSS Prevention

```php
<?php
// Helper function for output escaping
function h(string $str): string {
    return htmlspecialchars($str, ENT_QUOTES, 'UTF-8');
}

// Usage in templates:
// <p>Welcome, <?= h($user['firstname']) ?></p>
// <input value="<?= h($value) ?>">
```

### Database Helper

```php
<?php
// includes/db.php

// Load environment variables
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
            putenv(trim($line));
        }
    }
}

// Database configuration
$dbHost = getenv('DB_HOST') ?: 'localhost';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbName = getenv('DB_NAME') ?: 'schichtenplaner';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') ?: '';

$dsn = "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // Set MySQL strict mode
    $pdo->exec("SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");

} catch (PDOException $e) {
    die('Database connection failed: ' . $e->getMessage());
}

// Helper function for queries
function query(PDO $pdo, string $sql, array $params = []): PDOStatement {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}
```

### Keycloak OIDC Authentication

The application supports Keycloak OIDC for single sign-on. Local login can be disabled via configuration.

#### Environment Configuration

```ini
# .env - OIDC Settings
OIDC_ENABLED=true
LOCAL_LOGIN_ENABLED=true   # Set to false to disable local username/password login

# Default Keycloak configuration (can also be stored in database)
KEYCLOAK_ISSUER=https://keycloak.example.com/realms/schichtenplaner
KEYCLOAK_CLIENT_ID=schichtenplaner-app
KEYCLOAK_CLIENT_SECRET=your-client-secret
```

#### OIDC Helper (`includes/oidc.php`)

```php
<?php
// includes/oidc.php

/**
 * Get OIDC configuration from database or environment
 */
function getOidcProvider(string $slug): ?array {
    global $pdo;

    $stmt = $pdo->prepare("SELECT * FROM identity_providers WHERE slug = ? AND enabled = 1");
    $stmt->execute([$slug]);
    $idp = $stmt->fetch();

    if (!$idp) {
        return null;
    }

    return [
        'id' => $idp['id'],
        'slug' => $idp['slug'],
        'name' => $idp['name'],
        'issuer' => $idp['issuer'],
        'clientId' => $idp['client_id'],
        'clientSecret' => $idp['client_secret'],
        'scope' => json_decode($idp['scope'], true) ?: ['openid', 'profile', 'email'],
        'claimMapping' => json_decode($idp['claim_mapping'], true) ?: [],
        'pkceEnabled' => (bool)$idp['pkce_enabled'],
        'defaultRole' => $idp['default_role'] ?: 'user',
    ];
}

/**
 * Get all enabled OIDC providers for login page
 */
function getEnabledProviders(): array {
    global $pdo;

    $stmt = $pdo->query("SELECT id, slug, name FROM identity_providers WHERE enabled = 1");
    return $stmt->fetchAll();
}

/**
 * Discover OIDC endpoints from issuer
 */
function discoverOidcEndpoints(string $issuer): array {
    $discoveryUrl = rtrim($issuer, '/') . '/.well-known/openid-configuration';

    $context = stream_context_create(['http' => ['timeout' => 10]]);
    $json = @file_get_contents($discoveryUrl, false, $context);

    if ($json === false) {
        throw new Exception("Failed to fetch OIDC discovery document from $discoveryUrl");
    }

    $config = json_decode($json, true);
    if (!$config) {
        throw new Exception("Invalid OIDC discovery document");
    }

    return [
        'authorization_endpoint' => $config['authorization_endpoint'],
        'token_endpoint' => $config['token_endpoint'],
        'userinfo_endpoint' => $config['userinfo_endpoint'] ?? null,
        'end_session_endpoint' => $config['end_session_endpoint'] ?? null,
    ];
}

/**
 * Generate PKCE code verifier and challenge
 */
function generatePkce(): array {
    $verifier = bin2hex(random_bytes(32));
    $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

    return [
        'verifier' => $verifier,
        'challenge' => $challenge,
    ];
}

/**
 * Build authorization URL for OIDC login
 */
function buildAuthorizationUrl(array $idp, string $returnUrl): string {
    $endpoints = discoverOidcEndpoints($idp['issuer']);
    $pkce = generatePkce();

    // Store PKCE verifier and state in session
    $state = bin2hex(random_bytes(16));
    $_SESSION['oidc_state'] = $state;
    $_SESSION['oidc_pkce_verifier'] = $pkce['verifier'];
    $_SESSION['oidc_return_url'] = $returnUrl;
    $_SESSION['oidc_idp_slug'] = $idp['slug'];

    $params = [
        'response_type' => 'code',
        'client_id' => $idp['clientId'],
        'redirect_uri' => getAppUrl() . '/auth/oidc/callback',
        'scope' => implode(' ', $idp['scope']),
        'state' => $state,
    ];

    if ($idp['pkceEnabled']) {
        $params['code_challenge'] = $pkce['challenge'];
        $params['code_challenge_method'] = 'S256';
    }

    return $endpoints['authorization_endpoint'] . '?' . http_build_query($params);
}

/**
 * Exchange authorization code for tokens
 */
function exchangeCodeForTokens(array $idp, string $code): array {
    $endpoints = discoverOidcEndpoints($idp['issuer']);

    $params = [
        'grant_type' => 'authorization_code',
        'client_id' => $idp['clientId'],
        'client_secret' => $idp['clientSecret'],
        'code' => $code,
        'redirect_uri' => getAppUrl() . '/auth/oidc/callback',
    ];

    if ($idp['pkceEnabled'] && isset($_SESSION['oidc_pkce_verifier'])) {
        $params['code_verifier'] = $_SESSION['oidc_pkce_verifier'];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/x-www-form-urlencoded',
            'content' => http_build_query($params),
            'timeout' => 10,
        ]
    ]);

    $response = @file_get_contents($endpoints['token_endpoint'], false, $context);
    if ($response === false) {
        throw new Exception("Failed to exchange authorization code");
    }

    $tokens = json_decode($response, true);
    if (isset($tokens['error'])) {
        throw new Exception("Token error: " . ($tokens['error_description'] ?? $tokens['error']));
    }

    return $tokens;
}

/**
 * Decode JWT token payload (without verification - tokens already verified by IdP)
 */
function decodeJwtPayload(string $jwt): array {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        throw new Exception("Invalid JWT format");
    }

    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
    if (!$payload) {
        throw new Exception("Failed to decode JWT payload");
    }

    return $payload;
}

/**
 * Map OIDC claims to internal user
 */
function mapOidcClaimsToUser(array $claims, array $claimMapping, string $defaultRole): array {
    $getValue = function($key) use ($claims) {
        return $claims[$key] ?? null;
    };

    $mapping = array_merge([
        'id' => 'sub',
        'email' => 'email',
        'username' => 'preferred_username',
        'firstName' => 'given_name',
        'lastName' => 'family_name',
    ], $claimMapping);

    return [
        'idp_subject' => $getValue($mapping['id']),
        'email' => $getValue($mapping['email']),
        'username' => $getValue($mapping['username']) ?: $getValue($mapping['email']),
        'firstname' => $getValue($mapping['firstName']),
        'lastname' => $getValue($mapping['lastName']),
        'role' => $defaultRole,
    ];
}

/**
 * Find or create user from OIDC login
 */
function findOrCreateOidcUser(string $idpId, array $userData): array {
    global $pdo;

    // Check if identity link exists
    $stmt = $pdo->prepare("
        SELECT u.* FROM users u
        JOIN user_identities ui ON u.id = ui.user_id
        WHERE ui.idp_id = ? AND ui.idp_subject = ?
    ");
    $stmt->execute([$idpId, $userData['idp_subject']]);
    $user = $stmt->fetch();

    if ($user) {
        // Update last login
        $stmt = $pdo->prepare("UPDATE user_identities SET last_login = NOW() WHERE idp_id = ? AND idp_subject = ?");
        $stmt->execute([$idpId, $userData['idp_subject']]);
        return $user;
    }

    // Check if user exists by email (account linking)
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR (firstname = ? AND lastname = ?)");
    $stmt->execute([$userData['username'], $userData['firstname'], $userData['lastname']]);
    $user = $stmt->fetch();

    if ($user) {
        // Link existing user to IdP
        $linkId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO user_identities (id, user_id, idp_id, idp_subject, idp_email, last_login)
            VALUES (?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$linkId, $user['id'], $idpId, $userData['idp_subject'], $userData['email']]);
        return $user;
    }

    // Create new user
    $userId = generateUUID();
    $placeholderPassword = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);

    $stmt = $pdo->prepare("
        INSERT INTO users (id, username, password_hash, firstname, lastname, employee_type, role, is_active)
        VALUES (?, ?, ?, ?, ?, 'personell', ?, 1)
    ");
    $stmt->execute([
        $userId,
        $userData['username'],
        $placeholderPassword,
        $userData['firstname'],
        $userData['lastname'],
        $userData['role'],
    ]);

    // Create identity link
    $linkId = generateUUID();
    $stmt = $pdo->prepare("
        INSERT INTO user_identities (id, user_id, idp_id, idp_subject, idp_email, last_login)
        VALUES (?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([$linkId, $userId, $idpId, $userData['idp_subject'], $userData['email']]);

    // Fetch and return the created user
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    return $stmt->fetch();
}

/**
 * Get application URL
 */
function getAppUrl(): string {
    return rtrim(getenv('APP_URL') ?: 'http://localhost:8000', '/');
}

/**
 * Check if local login is enabled
 */
function isLocalLoginEnabled(): bool {
    return filter_var(getenv('LOCAL_LOGIN_ENABLED') ?: 'true', FILTER_VALIDATE_BOOLEAN);
}

/**
 * Check if OIDC is enabled
 */
function isOidcEnabled(): bool {
    return filter_var(getenv('OIDC_ENABLED') ?: 'false', FILTER_VALIDATE_BOOLEAN);
}
```

#### OIDC Login Flow (`pages/auth/oidc-login.php`)

```php
<?php
// pages/auth/oidc-login.php - Initiate OIDC login
require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/oidc.php';

$slug = $_GET['provider'] ?? 'keycloak';
$returnUrl = $_GET['return'] ?? '/dashboard';

$idp = getOidcProvider($slug);
if (!$idp) {
    flash('error', 'Identity provider not found');
    header('Location: /login');
    exit;
}

$authUrl = buildAuthorizationUrl($idp, $returnUrl);
header('Location: ' . $authUrl);
exit;
```

#### OIDC Callback (`pages/auth/oidc-callback.php`)

```php
<?php
// pages/auth/oidc-callback.php - Handle OIDC callback
require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/oidc.php';
require_once __DIR__ . '/../../includes/flash.php';

// Verify state
$state = $_GET['state'] ?? '';
if (!hash_equals($_SESSION['oidc_state'] ?? '', $state)) {
    flash('error', 'Invalid authentication state');
    header('Location: /login');
    exit;
}

// Check for errors from IdP
if (isset($_GET['error'])) {
    flash('error', 'Authentication failed: ' . ($_GET['error_description'] ?? $_GET['error']));
    header('Location: /login');
    exit;
}

$code = $_GET['code'] ?? '';
if (!$code) {
    flash('error', 'No authorization code received');
    header('Location: /login');
    exit;
}

$slug = $_SESSION['oidc_idp_slug'] ?? 'keycloak';
$idp = getOidcProvider($slug);

if (!$idp) {
    flash('error', 'Identity provider not found');
    header('Location: /login');
    exit;
}

try {
    // Exchange code for tokens
    $tokens = exchangeCodeForTokens($idp, $code);

    // Decode ID token to get user claims
    $claims = decodeJwtPayload($tokens['id_token']);

    // Map claims to user data
    $userData = mapOidcClaimsToUser($claims, $idp['claimMapping'], $idp['defaultRole']);

    // Find or create user
    $user = findOrCreateOidcUser($idp['id'], $userData);

    // Create session
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['employee_type'] = $user['employee_type'];
    $_SESSION['auth_method'] = 'oidc';
    $_SESSION['oidc_provider'] = $slug;

    // Clean up OIDC session data
    unset($_SESSION['oidc_state'], $_SESSION['oidc_pkce_verifier'], $_SESSION['oidc_idp_slug']);

    $returnUrl = $_SESSION['oidc_return_url'] ?? '/dashboard';
    unset($_SESSION['oidc_return_url']);

    flash('success', 'Welcome, ' . h($user['firstname'] ?: $user['username']) . '!');
    header('Location: ' . $returnUrl);
    exit;

} catch (Exception $e) {
    error_log('OIDC callback error: ' . $e->getMessage());
    flash('error', 'Authentication failed. Please try again.');
    header('Location: /login');
    exit;
}
```

#### Updated Login Page with OIDC

```php
<?php
// pages/auth/login.php - Updated with OIDC support
require_once __DIR__ . '/../../includes/session.php';
require_once __DIR__ . '/../../includes/db.php';
require_once __DIR__ . '/../../includes/flash.php';
require_once __DIR__ . '/../../includes/oidc.php';

if (isLoggedIn()) {
    header('Location: /dashboard');
    exit;
}

$error = '';
$localLoginEnabled = isLocalLoginEnabled();
$oidcEnabled = isOidcEnabled();
$oidcProviders = $oidcEnabled ? getEnabledProviders() : [];

// Handle local login
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $localLoginEnabled) {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND is_active = 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];
        $_SESSION['employee_type'] = $user['employee_type'];
        $_SESSION['auth_method'] = 'local';

        $stmt = $pdo->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
        $stmt->execute([$user['id']]);

        flash('success', 'Welcome back, ' . h($user['firstname']) . '!');
        header('Location: /dashboard');
        exit;
    } else {
        $error = 'Invalid username or password';
    }
}

include __DIR__ . '/../../templates/layout.php';
?>

<!-- Login form template -->
<div class="login-container">
    <h1>Login</h1>

    <?php displayFlashes(); ?>

    <?php if ($error): ?>
        <div class="alert alert-error"><?= h($error) ?></div>
    <?php endif; ?>

    <?php if ($oidcEnabled && count($oidcProviders) > 0): ?>
        <div class="oidc-providers">
            <h3>Sign in with</h3>
            <?php foreach ($oidcProviders as $provider): ?>
                <a href="/auth/oidc/login?provider=<?= h($provider['slug']) ?>" class="btn btn-oidc">
                    <?= h($provider['name']) ?>
                </a>
            <?php endforeach; ?>
        </div>

        <?php if ($localLoginEnabled): ?>
            <div class="divider"><span>or</span></div>
        <?php endif; ?>
    <?php endif; ?>

    <?php if ($localLoginEnabled): ?>
        <form method="POST" action="/login">
            <?= csrfField() ?>
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required autofocus>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn btn-primary">Login</button>
        </form>
    <?php elseif (!$oidcEnabled || count($oidcProviders) === 0): ?>
        <div class="alert alert-warning">
            No login methods are currently enabled. Please contact an administrator.
        </div>
    <?php endif; ?>
</div>
```

#### Keycloak Configuration in Database

```sql
-- Insert Keycloak as identity provider
INSERT INTO identity_providers (
    id, slug, name, issuer, client_id, client_secret, scope, claim_mapping, pkce_enabled, default_role
) VALUES (
    UUID(),
    'keycloak',
    'Keycloak SSO',
    'https://keycloak.example.com/realms/schichtenplaner',
    'schichtenplaner-app',
    'your-client-secret-here',
    '["openid", "profile", "email"]',
    '{"id": "sub", "email": "email", "username": "preferred_username", "firstName": "given_name", "lastName": "family_name"}',
    1,
    'user'
);
```

#### Keycloak Client Setup

1. Create a new client in Keycloak:
   - **Client ID**: `schichtenplaner-app`
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `confidential`

2. Configure the client:
   - **Valid Redirect URIs**: `https://your-app.com/auth/oidc/callback`
   - **Web Origins**: `https://your-app.com`

3. Get the client secret from the Credentials tab

4. Ensure these client scopes are assigned:
   - `openid`
   - `profile`
   - `email`

---

## 10. Migration Checklist

### Phase 1: Infrastructure & Authentication

- [ ] Create directory structure
- [ ] Set up MySQL database with 14-table schema
- [ ] Create `.env` file with database and OIDC credentials
- [ ] Implement `includes/db.php` - MySQL connection
- [ ] Implement `includes/session.php` - session management
- [ ] Implement `includes/auth.php` - authentication functions
- [ ] Implement `includes/csrf.php` - CSRF protection
- [ ] Implement `includes/oidc.php` - Keycloak OIDC functions
- [ ] Create `templates/layout.php` - main HTML layout
- [ ] Implement login page (`pages/auth/login.php`) with OIDC buttons
- [ ] Implement OIDC login initiation (`pages/auth/oidc-login.php`)
- [ ] Implement OIDC callback handler (`pages/auth/oidc-callback.php`)
- [ ] Implement logout handler (`pages/auth/logout.php`)
- [ ] Create basic dashboard (`pages/dashboard.php`)
- [ ] Set up `.htaccess` for URL rewriting
- [ ] Configure Keycloak client and add to `identity_providers` table
- [ ] Create initial admin user in database
- [ ] Test: Can login/logout via local auth
- [ ] Test: Can login/logout via Keycloak OIDC

### Phase 2: User Management

- [ ] Create user list page (`pages/users/index.php`)
- [ ] Create user creation page (`pages/users/create.php`)
- [ ] Create user edit page (`pages/users/edit.php`)
- [ ] Create user delete handler (`pages/users/delete.php`)
- [ ] Implement role-based access control
- [ ] Test: Can create/edit/delete users as admin

### Phase 3: Shift Plans

- [ ] Create shift plan list page (`pages/shift-plans/index.php`)
- [ ] Create shift plan creation page (`pages/shift-plans/create.php`)
- [ ] Create time slot management (`pages/shift-plans/time-slots.php`)
- [ ] Create shift matrix management (`pages/shift-plans/shifts.php`)
- [ ] Create shift preference entry page (`pages/preferences/shift.php`)
- [ ] Create AJAX endpoint for preferences (`api/preferences.php`)
- [ ] Create manual assignment page (`pages/assignments/shift-manual.php`)
- [ ] Create shift plan view page (`pages/shift-plans/view.php`)
- [ ] Test: Can create plan, add time slots, configure shifts
- [ ] Test: Users can enter preferences
- [ ] Test: Admin can manually assign

### Phase 4: Weekly Plans

- [ ] Create weekly plan list page (`pages/weekly-plans/index.php`)
- [ ] Create weekly plan creation page (`pages/weekly-plans/create.php`)
- [ ] Create weeks management (`pages/weekly-plans/weeks.php`)
- [ ] Create work requirements configuration
- [ ] Create weekly preference entry page (`pages/preferences/weekly.php`)
- [ ] Create manual assignment page (`pages/assignments/weekly-manual.php`)
- [ ] Create weekly plan view page (`pages/weekly-plans/view.php`)
- [ ] Test: Can create plan with weeks
- [ ] Test: Users can enter preferences and requirements
- [ ] Test: Admin can manually assign

### Phase 5: CP-SAT Solver Integration

- [ ] Copy Python solver scripts to `solver/` directory
- [ ] Verify Python 3.8+ and ortools installed on server
- [ ] Create `includes/solver.php` - solver wrapper functions
- [ ] Implement `prepareShiftSolverInput()` function
- [ ] Implement `prepareWeeklySolverInput()` function
- [ ] Create shift solver page (`pages/assignments/shift-solver.php`)
- [ ] Create weekly solver page (`pages/assignments/weekly-solver.php`)
- [ ] Display solver results with violations if any
- [ ] Allow applying solver results to database
- [ ] Test: Solver runs and returns valid assignments
- [ ] Test: Solver handles infeasible cases gracefully

### Phase 6: Polish & Export

- [ ] Create holiday management page (`pages/settings/holidays.php`)
- [ ] Create user profile page (`pages/settings/profile.php`)
- [ ] Implement print-friendly CSS (`assets/css/print.css`)
- [ ] Add CSV export functionality
- [ ] Implement plan status transitions (draft → published → archived)
- [ ] Add flash messages for all user actions
- [ ] Mobile-responsive CSS adjustments
- [ ] Final end-to-end testing

### Deployment Checklist

- [ ] Verify PHP 7.4+ with PDO MySQL extension
- [ ] Verify MySQL 5.7+ or MariaDB 10.3+ is running
- [ ] Create production database and user with limited privileges
- [ ] Import schema from `sql/schema.sql`
- [ ] Configure `.env` with production credentials
- [ ] Configure Keycloak OIDC settings in `.env` or database
- [ ] Verify Keycloak client redirect URI matches production URL
- [ ] Verify Python 3.8+ with ortools
- [ ] Set correct file permissions
- [ ] Configure `.htaccess` for production
- [ ] Enable HTTPS and update session cookie settings (required for OIDC)
- [ ] Create initial admin user
- [ ] Test local login (if enabled)
- [ ] Test Keycloak OIDC login flow
- [ ] Test solver execution in production environment
- [ ] Set up regular database backups (mysqldump)
- [ ] Configure MySQL slow query log for monitoring

---

## Appendix A: Helper Functions

```php
<?php
// includes/helpers.php

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/**
 * Escape HTML output
 */
function h(?string $str): string {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Format date for display
 */
function formatDate(?string $date, string $format = 'd.m.Y'): string {
    if (!$date) return '';
    return date($format, strtotime($date));
}

/**
 * Get day name from number
 */
function dayName(int $day): string {
    $days = [1 => 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return $days[$day] ?? '';
}

/**
 * Get short day name
 */
function dayShort(int $day): string {
    $days = [1 => 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return $days[$day] ?? '';
}

/**
 * Preference level to label
 */
function prefLabel(int $level): string {
    return [1 => 'Preferred', 2 => 'Available', 3 => 'Unavailable'][$level] ?? 'Unknown';
}

/**
 * Preference level to CSS class
 */
function prefClass(int $level): string {
    return [1 => 'pref-preferred', 2 => 'pref-available', 3 => 'pref-unavailable'][$level] ?? '';
}
```

---

## Appendix B: Flash Message System

```php
<?php
// includes/flash.php

/**
 * Set a flash message
 */
function flash(string $type, string $message): void {
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

/**
 * Get and clear flash messages
 */
function getFlashes(): array {
    $flashes = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $flashes;
}

/**
 * Display flash messages (call in template)
 */
function displayFlashes(): void {
    foreach (getFlashes() as $flash) {
        $type = h($flash['type']);
        $message = h($flash['message']);
        echo "<div class=\"alert alert-{$type}\">{$message}</div>";
    }
}
```

---

## Appendix C: Print Styles

```css
/* assets/css/print.css */

@media print {
    /* Hide non-essential elements */
    nav, .sidebar, .btn, form, .no-print {
        display: none !important;
    }

    /* Reset background colors for printing */
    body {
        background: white;
        color: black;
    }

    /* Ensure tables print well */
    table {
        border-collapse: collapse;
        width: 100%;
    }

    th, td {
        border: 1px solid #333;
        padding: 8px;
        text-align: left;
    }

    /* Page breaks */
    .page-break {
        page-break-before: always;
    }

    /* Preference colors for print */
    .pref-preferred { background-color: #c8e6c9 !important; }
    .pref-available { background-color: #fff9c4 !important; }
    .pref-unavailable { background-color: #ffcdd2 !important; }
}
```

---

## Appendix D: Alpine.js Components

### Confirmation Dialog

```html
<div x-data="{ open: false, callback: null }">
    <button @click="open = true; callback = () => deleteItem(123)">Delete</button>

    <div x-show="open" class="modal" @click.away="open = false">
        <div class="modal-content">
            <p>Are you sure?</p>
            <button @click="callback(); open = false">Yes</button>
            <button @click="open = false">Cancel</button>
        </div>
    </div>
</div>
```

### Dropdown Select

```html
<div x-data="{ selected: '', options: ['Option 1', 'Option 2', 'Option 3'] }">
    <select x-model="selected">
        <option value="">Choose...</option>
        <template x-for="opt in options" :key="opt">
            <option :value="opt" x-text="opt"></option>
        </template>
    </select>
    <p x-show="selected">Selected: <span x-text="selected"></span></p>
</div>
```

---

## Appendix E: MySQL vs SQLite Differences

If migrating from SQLite, note these key differences:

| Feature | SQLite | MySQL |
|---------|--------|-------|
| Boolean | INTEGER (0/1) | TINYINT(1) |
| Auto UUID | TEXT | CHAR(36) + PHP UUID |
| Current timestamp | `datetime('now')` | `NOW()` |
| String concat | `\|\|` | `CONCAT()` |
| Case sensitivity | Case-insensitive by default | Depends on collation |
| Foreign keys | `PRAGMA foreign_keys = ON` | Enabled by default with InnoDB |
| Date format | TEXT ('YYYY-MM-DD') | DATE native type |
| Time format | TEXT ('HH:MM:SS') | TIME native type |

---

*Document Version: 2.0 (MySQL Edition)*
*Last Updated: Generated during migration planning*
