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