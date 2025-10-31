## Employee Management

### \[CREATE/UPDATE\] employee
* All employee operations require authentication
* Password changes require current password + new password
* Only authenticated users can create/update employees

### \[ACTION: delete employee\]
* Requires authentication
* Server validates permissions before deletion

### \[ACTION: update availability\]
* Requires employee ID and plan ID
* Availability updates must include valid preference levels
* Only authenticated users can update availabilities

### \[ACTION: update last login\]
* Requires employee ID
* Fails silently if update fails (logs error but doesn`t block user)

## Employee

### \[CREATE\] Employee
* `firstname` 1-100 characters and must not be empty
* `lastname` 1-100 characters and must not be empty
* `password` must be at least 8 characters (in create mode)
* `employeeType` must be `manager`, `personell`, `apprentice`, or `guest`
* `canWorkAlone` optional boolean
* `isTrainee` optional boolean
* `isActive` optional boolean (default true)
* Contract type validation:
  * `manager`, `apprentice` => `contractType` = flexible
  * `guest` => `contractType` = undefined/NONE
  * `personell` => `contractType` = small || large

### \[UPDATE\] Employee profile
* `firstname` 1-100 characters and must not be empty
* `lastname` 1-100 characters and must not be empty
* `employeeType` must be valid type if provided
* `contractType` must be valid type if provided
* `roles` must be valid array of roles if provided
* Only the employee themselves or admins can update

### \[UPDATE\] Employee password
* `newPassword` optional but strict validation:
  - Minimum 8 characters
  - Must contain uppercase, lowercase, number and special character
* `newPassword` must match `confirmPassword`
* For admin password reset: no `currentPassword` required
* For self-password change: `currentPassword` required

### \[UPDATE\] Employee roles
* Only users with role `admin` can modify roles
* At least one employee must maintain `admin` role
* Users cannot remove their own admin role

### \[UPDATE\] Employee availability
* Only active employees can set availability
* Contract type requirements:
  * `small` contract: minimum 2 available shifts (preference level 1 or 2)
  * `large` contract: minimum 3 available shifts (preference level 1 or 2)
  * `flexible` contract: no minimum requirement
* Availability can only be set for valid shift patterns in selected plan
* `shiftId` must be valid and exist in the current plan

### \[ACTION: delete\] Employee
* Only users with role `admin` can delete employees
* Cannot delete yourself
* Cannot delete the last admin user
* User confirmation required before deletion

### \[ACTION: edit\] Employee
* Admins can edit all employees
* Maintenance users can edit non-admin employees or themselves
* Regular users can only edit themselves
