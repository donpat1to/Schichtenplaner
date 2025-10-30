## Authentication

### \[ACTION: login\]
* Requires valid email and password format
* Server validates credentials before issuing token
* Token and employee data stored in localStorage upon success

### \[ACTION: register\]
* Requires email, password, and name
* Role is optional during registration
* Automatically logs in user after successful registration

### \[ACTION: access protected resources\]
* Requires valid JWT token in Authorization header
* Token is automatically retrieved from localStorage
* Unauthorized requests (401) trigger automatic logout