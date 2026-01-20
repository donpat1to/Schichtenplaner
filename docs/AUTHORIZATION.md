# Authorization & Access Permissions

This document describes the authorization and access control system used in the Schichtenplaner application.

## Role Hierarchy

The system uses three roles with different authority levels:

| Role | Authority Level | Description |
|------|-----------------|-------------|
| `admin` | 100 | Full system access - can manage all resources |
| `maintenance` | 50 | Maintenance access - can manage most resources except user creation/deletion |
| `user` | 10 | Standard user - can view resources and manage own data |

## Authentication

All protected routes require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

The JWT payload contains:
- `id` - User ID
- `email` - User email
- `role` - User role (admin, maintenance, user)

## API Endpoints & Permissions

### Authentication (`/api/auth`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/login` | POST | No | - | User login |
| `/register` | POST | No | - | User registration |
| `/validate` | GET | No | - | Validate token |
| `/logout` | POST | Yes | All | User logout |
| `/me` | GET | Yes | All | Get current user info |

### Setup (`/api/setup`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/status` | GET | No | - | Check if setup is needed |
| `/admin` | POST | No | - | Create initial admin (only when no users exist) |

### Employees (`/api/employees`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/` | GET | Yes | All | List all employees |
| `/:id` | GET | Yes | admin, maintenance | Get employee details |
| `/` | POST | Yes | **admin only** | Create new employee |
| `/:id` | PUT | Yes | admin, maintenance | Update employee |
| `/:id` | DELETE | Yes | **admin only** | Delete employee |
| `/:id/password` | PUT | Yes | All* | Change password |
| `/:id/last-login` | PUT | Yes | All | Update last login |
| `/:employeeId/availabilities` | GET | Yes | All* | Get employee availabilities |
| `/:employeeId/availabilities` | PUT | Yes | All* | Update employee availabilities |

*Note: Users can only manage their own data; admins/maintenance can manage any employee's data.

### Shift Plans (`/api/shift-plans`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/` | GET | Yes | All | List all shift plans |
| `/:id` | GET | Yes | All | Get shift plan details |
| `/` | POST | Yes | admin, maintenance | Create shift plan |
| `/from-preset` | POST | Yes | admin, maintenance | Create from preset template |
| `/:id` | PUT | Yes | admin, maintenance | Update shift plan |
| `/:id` | DELETE | Yes | admin, maintenance | Delete shift plan |
| `/:id/clear-assignments` | POST | Yes | admin, maintenance | Clear all assignments |
| `/:id/export/excel` | GET | Yes | admin, maintenance | Export to Excel |
| `/:id/export/pdf` | GET | Yes | admin, maintenance | Export to PDF |
| `/:id/time-slots` | POST | Yes | admin, maintenance | Add time slot |
| `/:id/time-slots/:slotId` | PUT | Yes | admin, maintenance | Update time slot |
| `/:id/time-slots/:slotId` | DELETE | Yes | admin, maintenance | Delete time slot |
| `/:id/shifts` | POST | Yes | admin, maintenance | Add shift |
| `/:id/shifts/:shiftId` | PATCH | Yes | admin, maintenance | Update shift |
| `/:id/shifts/:shiftId` | DELETE | Yes | admin, maintenance | Delete shift |

### Scheduled Shifts (`/api/scheduled-shifts`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/:id/generate-shifts` | POST | Yes | admin, maintenance | Generate scheduled shifts |
| `/:id/regenerate-shifts` | POST | Yes | admin, maintenance | Regenerate scheduled shifts |
| `/plan/:planId` | GET | Yes | All | Get scheduled shifts for plan |
| `/:id` | GET | Yes | All | Get single scheduled shift |
| `/:id` | PUT | Yes | All* | Update scheduled shift |

### Weekly Plans (`/api/weekly-plans`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/` | GET | Yes | All | List all weekly plans |
| `/:id` | GET | Yes | All | Get weekly plan details |
| `/` | POST | Yes | admin, maintenance | Create weekly plan |
| `/:id` | PUT | Yes | admin, maintenance | Update weekly plan |
| `/:id` | DELETE | Yes | admin, maintenance | Delete weekly plan |
| `/:id/weeks/:weekId` | PUT | Yes | admin, maintenance | Update week settings |
| `/:id/my-preferences` | GET | Yes | All | Get own preferences |
| `/:id/preferences` | POST | Yes | All | Save own preferences |
| `/:id/admin-preferences` | POST | Yes | admin, maintenance | Save any employee's preferences |
| `/:id/generate` | POST | Yes | admin, maintenance | Generate optimal assignments |
| `/:id/clear-assignments` | POST | Yes | admin, maintenance | Clear all assignments |
| `/:id/publish` | POST | Yes | admin, maintenance | Publish the plan |
| `/:id/export/excel` | GET | Yes | admin, maintenance | Export to Excel |
| `/:id/export/pdf` | GET | Yes | admin, maintenance | Export to PDF |

### Scheduling (`/api/scheduling`)

| Endpoint | Method | Auth Required | Roles | Description |
|----------|--------|---------------|-------|-------------|
| `/generate-schedule` | POST | Yes | All* | Generate optimal schedule |
| `/health` | GET | No | - | Health check |

## Frontend Permission Checks

The frontend uses the `useAuth` hook to check permissions:

```typescript
const { hasRole, user } = useAuth();

// Check if user has any of the specified roles
if (hasRole(['admin', 'maintenance'])) {
  // Show admin/maintenance UI
}

// Check current user info
if (user?.userId === employeeId) {
  // User is viewing their own data
}
```

## Permission Summary by Feature

### Shift Plans
- **View**: All authenticated users
- **Create/Edit/Delete**: admin, maintenance
- **Export**: admin, maintenance
- **Manage Shifts/Time Slots**: admin, maintenance

### Weekly Plans
- **View**: All authenticated users
- **Create/Edit/Delete**: admin, maintenance
- **Set Own Preferences**: All authenticated users
- **Set Others' Preferences**: admin, maintenance
- **Generate Assignments**: admin, maintenance
- **Publish**: admin, maintenance
- **Export**: admin, maintenance

### Employees
- **View List**: All authenticated users
- **View Details**: admin, maintenance
- **Create**: admin only
- **Edit**: admin, maintenance
- **Delete**: admin only
- **Manage Own Availabilities**: All authenticated users
- **Manage Others' Availabilities**: admin, maintenance

### Availabilities (Shift Plans)
- **View Own**: All authenticated users
- **Edit Own**: All authenticated users
- **View Others**: admin, maintenance
- **Edit Others**: admin, maintenance

### Preferences (Weekly Plans)
- **View Own**: All authenticated users
- **Edit Own**: All authenticated users
- **View Others**: admin, maintenance (via plan details)
- **Edit Others**: admin, maintenance

## Database Role Configuration

Roles are stored in the `roles` table:

```sql
CREATE TABLE roles (
  role TEXT PRIMARY KEY CHECK(role IN ('admin', 'user', 'maintenance')),
  authority_level INTEGER NOT NULL UNIQUE CHECK(authority_level BETWEEN 1 AND 100),
  description TEXT
);

INSERT INTO roles (role, authority_level, description) VALUES
  ('admin', 100, 'Vollzugriff'),
  ('maintenance', 50, 'Wartungszugriff'),
  ('user', 10, 'Standardbenutzer');
```

Employee-role assignments are stored in `employee_roles`:

```sql
CREATE TABLE employee_roles (
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL REFERENCES roles(role),
  PRIMARY KEY (employee_id, role)
);
```

## Security Best Practices

1. **Always validate on backend**: Never rely solely on frontend permission checks
2. **Use requireRole middleware**: Apply role checks on all protected routes
3. **Validate resource ownership**: When users access their own data, verify the ID matches
4. **Audit sensitive actions**: Log admin actions for accountability
5. **JWT expiration**: Tokens should have reasonable expiration times
6. **HTTPS only**: In production, always use HTTPS
