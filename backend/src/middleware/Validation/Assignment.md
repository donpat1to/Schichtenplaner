## Shift Assignment

### \[ACTION: update scheduled shift\]
* Requires valid scheduled shift ID
* Only updates assignedEmployees array
* Requires authentication with valid token
* Handles both JSON and non-JSON responses

### \[ACTION: assign shifts automatically\]
* Requires shift plan, employees, and availabilities
* Availability preferenceLevel must be 1, 2, or 3
* Constraints must be an array (converts non-array to empty array)
* All employees must have valid availability data

### \[ACTION: get scheduled shifts\]
* Requires valid plan ID
* Automatically fixes data structure inconsistencies:
  - timeSlotId mapping (handles both naming conventions)
  - requiredEmployees fallback to 2 if missing
  - assignedEmployees fallback to empty array if missing

## Availability

### [UPDATE] availability
* planId: required valid UUID
* availabilities: required array with strict validation:
  - shiftId: valid UUID
  - preferenceLevel: 0 (unavailable), 1 (available), or 2 (preferred)
  - notes: optional, max 500 characters

## Scheduling

### [ACTION: generate schedule]
* shiftPlan: required object with id (valid UUID)
* employees: required array with at least one employee, each with valid UUID
* availabilities: required array
* constraints: optional array
