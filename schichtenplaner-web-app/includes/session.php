<?php
/**
 * Session Management
 */

// Configure session settings before starting
ini_set('session.cookie_httponly', 1);
ini_set('session.use_strict_mode', 1);
ini_set('session.cookie_samesite', 'Lax');

// Enable secure cookies in production with HTTPS
if (!APP_DEBUG && isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') {
    ini_set('session.cookie_secure', 1);
}

// Set session lifetime
ini_set('session.gc_maxlifetime', SESSION_LIFETIME);
ini_set('session.cookie_lifetime', SESSION_LIFETIME);

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Regenerate session ID (call on login)
 */
function regenerateSession(): void {
    session_regenerate_id(true);
}

/**
 * Destroy the current session
 */
function destroySession(): void {
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }

    session_destroy();
}

/**
 * Check if user is logged in
 *
 * @return bool
 */
function isLoggedIn(): bool {
    return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
}

/**
 * Get current user ID
 *
 * @return string|null
 */
function getCurrentUserId(): ?string {
    return $_SESSION['user_id'] ?? null;
}

/**
 * Get current user role
 *
 * @return string|null
 */
function getCurrentUserRole(): ?string {
    return $_SESSION['role'] ?? null;
}

/**
 * Check if current user is admin
 *
 * @return bool
 */
function isAdmin(): bool {
    return getCurrentUserRole() === 'admin';
}

/**
 * Get a session value
 *
 * @param string $key
 * @param mixed $default
 * @return mixed
 */
function session(string $key, $default = null) {
    return $_SESSION[$key] ?? $default;
}

/**
 * Set a session value
 *
 * @param string $key
 * @param mixed $value
 */
function setSession(string $key, $value): void {
    $_SESSION[$key] = $value;
}

/**
 * Remove a session value
 *
 * @param string $key
 */
function unsetSession(string $key): void {
    unset($_SESSION[$key]);
}
