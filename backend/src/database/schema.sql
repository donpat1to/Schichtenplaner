-- Tabelle für Benutzer
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'user', 'instandhalter')) NOT NULL,
  employee_type TEXT CHECK(employee_type IN ('chef', 'neuling', 'erfahren')),
  is_sufficiently_independent BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT || NULL
);

-- Tabelle für Schichtvorlagen
CREATE TABLE IF NOT EXISTS shift_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabelle für die Schichten in den Vorlagen
CREATE TABLE IF NOT EXISTS template_shifts (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  time_range_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  required_employees INTEGER DEFAULT 1,
  color TEXT DEFAULT '#3498db',
  FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (time_range_id) REFERENCES template_time_slots(id) ON DELETE CASCADE
);

-- Tabelle für Zeitbereiche in den Vorlagen
CREATE TABLE IF NOT EXISTS template_time_slots (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES shift_templates(id) ON DELETE CASCADE
);

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
  name TEXT NOT NULL,
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
