-- backend/src/database/migrations/003_add_shift_name.sql
ALTER TABLE assigned_shifts ADD COLUMN name TEXT;