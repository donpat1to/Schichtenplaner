<?php
/**
 * CSRF Protection
 */

/**
 * Generate or get the CSRF token
 *
 * @return string
 */
function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Get HTML hidden input field with CSRF token
 *
 * @return string
 */
function csrfField(): string {
    return '<input type="hidden" name="csrf_token" value="' . generateCsrfToken() . '">';
}

/**
 * Get CSRF token for use in AJAX requests
 *
 * @return string
 */
function csrfToken(): string {
    return generateCsrfToken();
}

/**
 * Validate the CSRF token from POST data
 *
 * @return bool
 */
function validateCsrfToken(): bool {
    $token = $_POST['csrf_token'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';

    if (empty($token) || empty($sessionToken)) {
        return false;
    }

    return hash_equals($sessionToken, $token);
}

/**
 * Validate CSRF token from JSON request body
 *
 * @param array $data
 * @return bool
 */
function validateCsrfFromJson(array $data): bool {
    $token = $data['csrf_token'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';

    if (empty($token) || empty($sessionToken)) {
        return false;
    }

    return hash_equals($sessionToken, $token);
}

/**
 * Validate CSRF token from header
 *
 * @return bool
 */
function validateCsrfFromHeader(): bool {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $sessionToken = $_SESSION['csrf_token'] ?? '';

    if (empty($token) || empty($sessionToken)) {
        return false;
    }

    return hash_equals($sessionToken, $token);
}

/**
 * Require valid CSRF token or abort
 */
function requireCsrf(): void {
    if (!validateCsrfToken()) {
        http_response_code(403);
        if (isAjax()) {
            jsonResponse(['error' => 'Invalid CSRF token'], 403);
        }
        die('Invalid CSRF token. Please refresh the page and try again.');
    }
}

/**
 * Require valid CSRF token for AJAX requests
 */
function requireCsrfAjax(): void {
    if (!validateCsrfFromHeader()) {
        jsonResponse(['error' => 'Invalid CSRF token'], 403);
    }
}

/**
 * Regenerate CSRF token (call after important actions)
 */
function regenerateCsrfToken(): void {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
