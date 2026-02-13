<?php
/**
 * Flash Message System
 */

/**
 * Set a flash message
 *
 * @param string $type Type of message (success, error, warning, info)
 * @param string $message The message content
 */
function flash(string $type, string $message): void {
    if (!isset($_SESSION['flash'])) {
        $_SESSION['flash'] = [];
    }
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

/**
 * Set a success flash message
 *
 * @param string $message
 */
function flashSuccess(string $message): void {
    flash('success', $message);
}

/**
 * Set an error flash message
 *
 * @param string $message
 */
function flashError(string $message): void {
    flash('error', $message);
}

/**
 * Set a warning flash message
 *
 * @param string $message
 */
function flashWarning(string $message): void {
    flash('warning', $message);
}

/**
 * Set an info flash message
 *
 * @param string $message
 */
function flashInfo(string $message): void {
    flash('info', $message);
}

/**
 * Get and clear all flash messages
 *
 * @return array
 */
function getFlashes(): array {
    $flashes = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $flashes;
}

/**
 * Check if there are flash messages
 *
 * @return bool
 */
function hasFlashes(): bool {
    return !empty($_SESSION['flash']);
}

/**
 * Display flash messages as HTML
 */
function displayFlashes(): void {
    foreach (getFlashes() as $flash) {
        $type = h($flash['type']);
        $message = h($flash['message']);
        echo '<div class="alert alert-' . $type . '">' . $message . '</div>';
    }
}
