-- Schichtenplaner Initial Data
-- Run this after schema.sql to set up initial admin user and demo data

USE schichtenplaner;

-- ============================================================================
-- Initial Admin User
-- Password: 'admin123' - CHANGE IN PRODUCTION!
-- Generated with: password_hash('admin123', PASSWORD_DEFAULT)
-- ============================================================================
INSERT INTO users (id, username, password_hash, firstname, lastname, employee_type, role, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'System',
  'Administrator',
  'manager',
  'admin',
  1
);

-- ============================================================================
-- Sample Employees (Optional - Remove in production)
-- ============================================================================
INSERT INTO users (id, username, password_hash, firstname, lastname, employee_type, contract_type, can_work_alone, is_trainee, role) VALUES
('a0000000-0000-0000-0000-000000000002', 'mmueller', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Max', 'Mueller', 'personell', 'large', 1, 0, 'user'),
('a0000000-0000-0000-0000-000000000003', 'aschmidt', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Anna', 'Schmidt', 'personell', 'large', 1, 0, 'user'),
('a0000000-0000-0000-0000-000000000004', 'tmeyer', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Thomas', 'Meyer', 'personell', 'small', 1, 0, 'user'),
('a0000000-0000-0000-0000-000000000005', 'lfischer', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Lisa', 'Fischer', 'personell', 'large', 1, 0, 'user'),
('a0000000-0000-0000-0000-000000000006', 'jweber', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Jan', 'Weber', 'apprentice', 'flexible', 0, 1, 'user'),
('a0000000-0000-0000-0000-000000000007', 'sbecker', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Sarah', 'Becker', 'manager', 'flexible', 1, 0, 'user');

-- ============================================================================
-- Example Keycloak Identity Provider (Optional - Configure in production)
-- ============================================================================
-- INSERT INTO identity_providers (
--     id, slug, name, issuer, client_id, client_secret, scope, claim_mapping, pkce_enabled, default_role
-- ) VALUES (
--     'b0000000-0000-0000-0000-000000000001',
--     'keycloak',
--     'Keycloak SSO',
--     'https://keycloak.example.com/realms/schichtenplaner',
--     'schichtenplaner-app',
--     'your-client-secret-here',
--     '["openid", "profile", "email"]',
--     '{"id": "sub", "email": "email", "username": "preferred_username", "firstName": "given_name", "lastName": "family_name"}',
--     1,
--     'user'
-- );

-- ============================================================================
-- Common German Holidays (Optional)
-- ============================================================================
INSERT INTO holidays (id, name, date, is_recurring, created_by) VALUES
('c0000000-0000-0000-0000-000000000001', 'Neujahr', '2025-01-01', 1, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000002', 'Karfreitag', '2025-04-18', 0, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000003', 'Ostermontag', '2025-04-21', 0, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000004', 'Tag der Arbeit', '2025-05-01', 1, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000005', 'Christi Himmelfahrt', '2025-05-29', 0, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000006', 'Pfingstmontag', '2025-06-09', 0, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000007', 'Tag der Deutschen Einheit', '2025-10-03', 1, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000008', '1. Weihnachtstag', '2025-12-25', 1, 'a0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000009', '2. Weihnachtstag', '2025-12-26', 1, 'a0000000-0000-0000-0000-000000000001');
