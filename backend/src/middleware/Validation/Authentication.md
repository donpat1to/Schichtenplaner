## Authentication

### \[ACTION: login\]
* Requires valid email and password format:
  - Minimum 8 characters
  - Must contain uppercase, lowercase, number and special character
* Server validates credentials before issuing token
* Token and employee data stored in localStorage upon success

### \[ACTION: register\]
* `Password` optional but strict validation:
  - Minimum 8 characters
  - Must contain uppercase, lowercase, number and special character
* `firstname` 1-100 characters and must not be empty
* `lastname` 1-100 characters and must not be empty
* Requires valid email
* Role is optional during registration
* Automatically logs in user after successful registration

### \[ACTION: access protected resources\]
* Requires valid JWT token in Authorization header
* Token is automatically retrieved from localStorage
* Unauthorized requests (401) trigger automatic logout