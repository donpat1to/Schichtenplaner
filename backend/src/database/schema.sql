-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  employee_type TEXT CHECK(employee_type IN ('manager', 'trainee', 'experienced')) NOT NULL,
  contract_type TEXT CHECK(contract_type IN ('small', 'large')) NOT NULL,
  can_work_alone BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT DEFAULT NULL
);

-- Roles lookup table
CREATE TABLE IF NOT EXISTS roles (
  role TEXT PRIMARY KEY CHECK(role IN ('admin', 'user', 'maintenance'))
);

-- Junction table: many-to-many relationship
CREATE TABLE IF NOT EXISTS employee_roles (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL REFERENCES roles(role),
  PRIMARY KEY (employee_id, role)
);

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
  color TEXT DEFAULT '#3498db',
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
  UNIQUE(plan_id, time_slot_id, day_of_week)
);

-- Actual scheduled shifts (generated from plan + date range)
CREATE TABLE IF NOT EXISTS scheduled_shifts (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  date TEXT NOT NULL,
  time_slot_id TEXT NOT NULL,
  required_employees INTEGER NOT NULL CHECK (required_employees >= 1 AND required_employees <= 10) DEFAULT 2,
  assigned_employees TEXT DEFAULT '[]', -- JSON array of employee IDs
  FOREIGN KEY (plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE,
  FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE,
  UNIQUE(plan_id, date, time_slot_id)
);

-- Employee assignments to specific shifts
CREATE TABLE IF NOT EXISTS shift_assignments (
  id TEXT PRIMARY KEY,
  scheduled_shift_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  assignment_status TEXT CHECK(assignment_status IN ('assigned', 'cancelled')) DEFAULT 'assigned',
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by TEXT NOT NULL,
  FOREIGN KEY (scheduled_shift_id) REFERENCES scheduled_shifts(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (assigned_by) REFERENCES employees(id),
  UNIQUE(scheduled_shift_id, employee_id)
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

-- Performance indexes (UPDATED - removed role index from employees)
CREATE INDEX IF NOT EXISTS idx_employees_email_active ON employees(email, is_active);
CREATE INDEX IF NOT EXISTS idx_employees_type_active ON employees(employee_type, is_active);

-- Index for employee_roles table (NEW)
CREATE INDEX IF NOT EXISTS idx_employee_roles_employee ON employee_roles(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_roles_role ON employee_roles(role);

CREATE INDEX IF NOT EXISTS idx_shift_plans_status_date ON shift_plans(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_shift_plans_created_by ON shift_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_shift_plans_template ON shift_plans(is_template, status);

CREATE INDEX IF NOT EXISTS idx_time_slots_plan ON time_slots(plan_id);

CREATE INDEX IF NOT EXISTS idx_shifts_plan_day ON shifts(plan_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_shifts_required_employees ON shifts(required_employees);
CREATE INDEX IF NOT EXISTS idx_shifts_plan_time ON shifts(plan_id, time_slot_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_plan_date ON scheduled_shifts(plan_id, date);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_date_time ON scheduled_shifts(date, time_slot_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_shifts_required_employees ON scheduled_shifts(required_employees);

CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee ON shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift ON shift_assignments(scheduled_shift_id);

CREATE INDEX IF NOT EXISTS idx_employee_availability_employee_plan ON employee_availability(employee_id, plan_id);