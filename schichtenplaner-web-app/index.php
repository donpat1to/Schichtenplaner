<?php
/**
 * Schichtenplaner - Main Router
 *
 * All requests are routed through this file.
 */

// Load configuration
require_once __DIR__ . '/config.php';

// Load core includes
require_once INCLUDES_PATH . '/db.php';
require_once INCLUDES_PATH . '/session.php';
require_once INCLUDES_PATH . '/helpers.php';
require_once INCLUDES_PATH . '/flash.php';
require_once INCLUDES_PATH . '/csrf.php';
require_once INCLUDES_PATH . '/auth.php';

// Get the route from the request
$route = $_GET['route'] ?? '';
$route = trim($route, '/');

// Default to dashboard if logged in, login if not
if ($route === '') {
    $route = isLoggedIn() ? 'dashboard' : 'login';
}

// Route mapping
$routes = [
    // Authentication
    'login' => 'pages/auth/login.php',
    'logout' => 'pages/auth/logout.php',
    'auth/oidc/login' => 'pages/auth/oidc-login.php',
    'auth/oidc/callback' => 'pages/auth/oidc-callback.php',

    // Dashboard
    'dashboard' => 'pages/dashboard.php',

    // User Management
    'users' => 'pages/users/index.php',
    'users/create' => 'pages/users/create.php',
    'users/edit' => 'pages/users/edit.php',
    'users/delete' => 'pages/users/delete.php',

    // Shift Plans
    'shift-plans' => 'pages/shift-plans/index.php',
    'shift-plans/create' => 'pages/shift-plans/create.php',
    'shift-plans/edit' => 'pages/shift-plans/edit.php',
    'shift-plans/view' => 'pages/shift-plans/view.php',
    'shift-plans/time-slots' => 'pages/shift-plans/time-slots.php',
    'shift-plans/shifts' => 'pages/shift-plans/shifts.php',

    // Weekly Plans
    'weekly-plans' => 'pages/weekly-plans/index.php',
    'weekly-plans/create' => 'pages/weekly-plans/create.php',
    'weekly-plans/edit' => 'pages/weekly-plans/edit.php',
    'weekly-plans/view' => 'pages/weekly-plans/view.php',
    'weekly-plans/weeks' => 'pages/weekly-plans/weeks.php',

    // Preferences
    'preferences/shift' => 'pages/preferences/shift.php',
    'preferences/weekly' => 'pages/preferences/weekly.php',

    // Assignments
    'assignments/shift-manual' => 'pages/assignments/shift-manual.php',
    'assignments/shift-solver' => 'pages/assignments/shift-solver.php',
    'assignments/weekly-manual' => 'pages/assignments/weekly-manual.php',
    'assignments/weekly-solver' => 'pages/assignments/weekly-solver.php',

    // Settings
    'settings/profile' => 'pages/settings/profile.php',
    'settings/holidays' => 'pages/settings/holidays.php',

    // API endpoints
    'api/shifts' => 'api/shifts.php',
    'api/assignments' => 'api/assignments.php',
    'api/preferences' => 'api/preferences.php',
    'api/export' => 'api/export.php',
];

// Check if route exists
if (isset($routes[$route])) {
    $filePath = BASE_PATH . '/' . $routes[$route];
    if (file_exists($filePath)) {
        require $filePath;
        exit;
    }
}

// 404 Not Found
http_response_code(404);
$pageTitle = 'Page Not Found';
$contentTemplate = null;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>404 - Page Not Found | <?= APP_NAME ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/assets/css/main.css">
</head>
<body>
    <div class="app-container">
        <main class="app-main" style="display: flex; align-items: center; justify-content: center; min-height: 100vh;">
            <div class="text-center">
                <h1>404</h1>
                <p>The page you're looking for doesn't exist.</p>
                <a href="/dashboard" class="btn btn-primary">Go to Dashboard</a>
            </div>
        </main>
    </div>
</body>
</html>
