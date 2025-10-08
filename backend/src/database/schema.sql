-- Zusätzliche Tabellen für shift_plans
CREATE TABLE IF NOT EXISTS shift_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  template_id TEXT,
  status TEXT CHECK(status IN ('draft', 'published')) DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (template_id) REFERENCES shift_templates(id)
);

CREATE TABLE IF NOT EXISTS assigned_shifts (
  id TEXT PRIMARY KEY,
  shift_plan_id TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  required_employees INTEGER DEFAULT 1,
  assigned_employees TEXT DEFAULT '[]', -- JSON array of user IDs
  FOREIGN KEY (shift_plan_id) REFERENCES shift_plans(id) ON DELETE CASCADE
);

-- Zusätzliche Tabelle für Mitarbeiter-Verfügbarkeiten
CREATE TABLE IF NOT EXISTS employee_availabilities (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_available BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Users Tabelle erweitern um zusätzliche Felder
ALTER TABLE users ADD COLUMN phone TEXT;
ALTER TABLE users ADD COLUMN department TEXT;
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE;