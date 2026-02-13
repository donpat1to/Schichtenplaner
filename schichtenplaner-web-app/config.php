<?php
/**
 * Schichtenplaner Configuration
 *
 * This file loads environment variables and defines application constants.
 */

// Load environment variables from .env file
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        if (strpos($line, '=') !== false) {
            putenv(trim($line));
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

// Application Configuration
define('APP_ENV', getenv('APP_ENV') ?: 'production');
define('APP_DEBUG', filter_var(getenv('APP_DEBUG') ?: false, FILTER_VALIDATE_BOOLEAN));
define('APP_URL', rtrim(getenv('APP_URL') ?: 'http://localhost', '/'));
define('APP_NAME', 'Schichtenplaner');

// Database Configuration
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'schichtenplaner');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');

// Authentication Configuration
define('LOCAL_LOGIN_ENABLED', filter_var(getenv('LOCAL_LOGIN_ENABLED') ?: true, FILTER_VALIDATE_BOOLEAN));
define('OIDC_ENABLED', filter_var(getenv('OIDC_ENABLED') ?: false, FILTER_VALIDATE_BOOLEAN));

// Session Configuration
define('SESSION_LIFETIME', (int)(getenv('SESSION_LIFETIME') ?: 7200));

// Solver Configuration
define('PYTHON_PATH', getenv('PYTHON_PATH') ?: '/usr/bin/python3');
define('SOLVER_TIMEOUT', 120); // seconds

// Path Configuration
define('BASE_PATH', __DIR__);
define('INCLUDES_PATH', __DIR__ . '/includes');
define('TEMPLATES_PATH', __DIR__ . '/templates');
define('PAGES_PATH', __DIR__ . '/pages');
define('SOLVER_PATH', __DIR__ . '/solver');

// Error Reporting
if (APP_DEBUG) {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

// Timezone
date_default_timezone_set('Europe/Berlin');
