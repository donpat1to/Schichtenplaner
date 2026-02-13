<?php
/**
 * Authentication Functions
 */

/**
 * Require user to be logged in
 */
function requireLogin(): void {
    if (!isLoggedIn()) {
        if (isAjax()) {
            jsonResponse(['error' => 'Authentication required'], 401);
        }
        flash('warning', 'Bitte melden Sie sich an.');
        redirect('/login');
    }
}

/**
 * Require user to have a specific role
 *
 * @param string $role Required role ('admin' or 'user')
 */
function requireRole(string $role): void {
    requireLogin();

    if ($role === 'admin' && !isAdmin()) {
        if (isAjax()) {
            jsonResponse(['error' => 'Admin access required'], 403);
        }
        flash('error', 'Sie haben keine Berechtigung fuer diese Aktion.');
        redirect('/dashboard');
    }
}

/**
 * Authenticate a user with username and password
 *
 * @param string $username
 * @param string $password
 * @return array|null User array on success, null on failure
 */
function authenticateUser(string $username, string $password): ?array {
    $user = fetchOne(
        "SELECT * FROM users WHERE username = ? AND is_active = 1",
        [$username]
    );

    if (!$user || !password_verify($password, $user['password_hash'])) {
        return null;
    }

    return $user;
}

/**
 * Log in a user (create session)
 *
 * @param array $user User data from database
 * @param string $authMethod Authentication method ('local' or 'oidc')
 */
function loginUser(array $user, string $authMethod = 'local'): void {
    regenerateSession();

    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['employee_type'] = $user['employee_type'];
    $_SESSION['firstname'] = $user['firstname'];
    $_SESSION['lastname'] = $user['lastname'];
    $_SESSION['auth_method'] = $authMethod;
    $_SESSION['login_time'] = time();

    // Update last login timestamp
    query("UPDATE users SET last_login = NOW() WHERE id = ?", [$user['id']]);
}

/**
 * Log out the current user
 */
function logoutUser(): void {
    destroySession();
}

/**
 * Get the current logged-in user
 *
 * @return array|null
 */
function getCurrentUser(): ?array {
    if (!isLoggedIn()) {
        return null;
    }

    return fetchOne("SELECT * FROM users WHERE id = ?", [getCurrentUserId()]);
}

/**
 * Check if a user has permission to manage a resource
 *
 * @param string|null $resourceOwnerId The ID of the resource owner
 * @return bool
 */
function canManage(?string $resourceOwnerId = null): bool {
    if (isAdmin()) {
        return true;
    }

    if ($resourceOwnerId && $resourceOwnerId === getCurrentUserId()) {
        return true;
    }

    return false;
}

/**
 * Hash a password
 *
 * @param string $password
 * @return string
 */
function hashPassword(string $password): string {
    return password_hash($password, PASSWORD_DEFAULT);
}

/**
 * Check if password needs rehashing
 *
 * @param string $hash
 * @return bool
 */
function passwordNeedsRehash(string $hash): bool {
    return password_needs_rehash($hash, PASSWORD_DEFAULT);
}

/**
 * Validate password strength
 *
 * @param string $password
 * @return array Array of error messages (empty if valid)
 */
function validatePassword(string $password): array {
    $errors = [];

    if (strlen($password) < 8) {
        $errors[] = 'Passwort muss mindestens 8 Zeichen lang sein.';
    }

    return $errors;
}

/**
 * Check if local login is enabled
 *
 * @return bool
 */
function isLocalLoginEnabled(): bool {
    return LOCAL_LOGIN_ENABLED;
}

/**
 * Check if OIDC is enabled
 *
 * @return bool
 */
function isOidcEnabled(): bool {
    return OIDC_ENABLED;
}

/**
 * Get all schedulable employees (for shift/weekly assignment)
 *
 * @return array
 */
function getSchedulableEmployees(): array {
    return fetchAll(
        "SELECT * FROM users
         WHERE is_active = 1
         AND employee_type IN ('personell', 'apprentice')
         ORDER BY lastname, firstname"
    );
}

/**
 * Get all active employees
 *
 * @return array
 */
function getActiveEmployees(): array {
    return fetchAll(
        "SELECT * FROM users
         WHERE is_active = 1
         ORDER BY lastname, firstname"
    );
}

/**
 * Get user by ID
 *
 * @param string $id
 * @return array|null
 */
function getUserById(string $id): ?array {
    return fetchOne("SELECT * FROM users WHERE id = ?", [$id]);
}

/**
 * Get user by username
 *
 * @param string $username
 * @return array|null
 */
function getUserByUsername(string $username): ?array {
    return fetchOne("SELECT * FROM users WHERE username = ?", [$username]);
}

/**
 * Create a new user
 *
 * @param array $data User data
 * @return string The new user's ID
 */
function createUser(array $data): string {
    $id = generateUUID();

    insert('users', [
        'id' => $id,
        'username' => $data['username'],
        'password_hash' => hashPassword($data['password']),
        'firstname' => $data['firstname'] ?? null,
        'lastname' => $data['lastname'] ?? null,
        'employee_type' => $data['employee_type'] ?? 'personell',
        'contract_type' => $data['contract_type'] ?? null,
        'can_work_alone' => $data['can_work_alone'] ?? 1,
        'is_trainee' => $data['is_trainee'] ?? 0,
        'role' => $data['role'] ?? 'user',
        'is_active' => $data['is_active'] ?? 1,
    ]);

    return $id;
}

/**
 * Update a user
 *
 * @param string $id User ID
 * @param array $data Data to update
 * @return bool
 */
function updateUser(string $id, array $data): bool {
    // Handle password separately
    if (isset($data['password']) && !empty($data['password'])) {
        $data['password_hash'] = hashPassword($data['password']);
    }
    unset($data['password']);

    // Remove empty values
    $data = array_filter($data, fn($v) => $v !== null && $v !== '');

    if (empty($data)) {
        return true;
    }

    return update('users', $data, 'id = ?', [$id]) >= 0;
}

/**
 * Delete a user (soft delete by deactivating)
 *
 * @param string $id User ID
 * @return bool
 */
function deleteUser(string $id): bool {
    return update('users', ['is_active' => 0], 'id = ?', [$id]) > 0;
}

/**
 * Check if username is available
 *
 * @param string $username
 * @param string|null $excludeId User ID to exclude (for updates)
 * @return bool
 */
function isUsernameAvailable(string $username, ?string $excludeId = null): bool {
    $sql = "SELECT COUNT(*) as count FROM users WHERE username = ?";
    $params = [$username];

    if ($excludeId) {
        $sql .= " AND id != ?";
        $params[] = $excludeId;
    }

    $result = fetchOne($sql, $params);
    return ($result['count'] ?? 0) === 0;
}
