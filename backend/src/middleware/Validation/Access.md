## User Settings

### \[UPDATE\] Personal availability
* Only the employee themselves can manage their availability
* Must select a valid shift plan with defined shifts
* All changes require explicit save action

### \[VIEW\] ShiftPlan assignments
* Published plans show actual assignments
* Draft plans show preview assignments (if calculated)
* Regular users can only view, not modify assignments

## System-wide

### \[ACCESS\] Role-based restrictions
* `admin`: Full access to all features
* `maintenance`: Access to shift plans and employee management (except admin users)
* `user`: Read-only access to shift plans, can manage own availability and profile

### \[DATA\] Validation rules
* Email addresses are automatically generated from firstname/lastname
* Employee status (`isActive`) controls login and planning eligibility
* Trainee status affects independence (`canWorkAlone`) automatically
* Date ranges must be valid (start before end)
* All required fields must be filled before form submission