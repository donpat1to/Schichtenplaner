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