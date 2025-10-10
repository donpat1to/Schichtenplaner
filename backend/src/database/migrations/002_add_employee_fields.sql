-- Add employee fields
ALTER TABLE users ADD COLUMN employee_type TEXT CHECK(employee_type IN ('chef', 'neuling', 'erfahren'));
ALTER TABLE users ADD COLUMN is_sufficiently_independent BOOLEAN DEFAULT FALSE;