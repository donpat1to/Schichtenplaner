<?php
/**
 * General Utility Functions
 */

/**
 * Generate a UUID v4
 *
 * @return string
 */
function generateUUID(): string {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

/**
 * Escape HTML output
 *
 * @param string|null $str
 * @return string
 */
function h(?string $str): string {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Format date for display
 *
 * @param string|null $date
 * @param string $format
 * @return string
 */
function formatDate(?string $date, string $format = 'd.m.Y'): string {
    if (!$date) return '';
    return date($format, strtotime($date));
}

/**
 * Format datetime for display
 *
 * @param string|null $datetime
 * @param string $format
 * @return string
 */
function formatDateTime(?string $datetime, string $format = 'd.m.Y H:i'): string {
    if (!$datetime) return '';
    return date($format, strtotime($datetime));
}

/**
 * Format time for display
 *
 * @param string|null $time
 * @param string $format
 * @return string
 */
function formatTime(?string $time, string $format = 'H:i'): string {
    if (!$time) return '';
    return date($format, strtotime($time));
}

/**
 * Get day name from number (1-7)
 *
 * @param int $day
 * @return string
 */
function dayName(int $day): string {
    $days = [
        1 => 'Montag',
        2 => 'Dienstag',
        3 => 'Mittwoch',
        4 => 'Donnerstag',
        5 => 'Freitag',
        6 => 'Samstag',
        7 => 'Sonntag'
    ];
    return $days[$day] ?? '';
}

/**
 * Get short day name
 *
 * @param int $day
 * @return string
 */
function dayShort(int $day): string {
    $days = [1 => 'Mo', 2 => 'Di', 3 => 'Mi', 4 => 'Do', 5 => 'Fr', 6 => 'Sa', 7 => 'So'];
    return $days[$day] ?? '';
}

/**
 * Preference level to label
 *
 * @param int $level
 * @return string
 */
function prefLabel(int $level): string {
    return [1 => 'Bevorzugt', 2 => 'Verfuegbar', 3 => 'Nicht verfuegbar'][$level] ?? 'Unbekannt';
}

/**
 * Preference level to short label
 *
 * @param int $level
 * @return string
 */
function prefShortLabel(int $level): string {
    return [1 => 'Ja!', 2 => 'OK', 3 => 'Nein'][$level] ?? '?';
}

/**
 * Preference level to CSS class
 *
 * @param int $level
 * @return string
 */
function prefClass(int $level): string {
    return [1 => 'pref-preferred', 2 => 'pref-available', 3 => 'pref-unavailable'][$level] ?? '';
}

/**
 * Employee type to label
 *
 * @param string $type
 * @return string
 */
function employeeTypeLabel(string $type): string {
    $types = [
        'manager' => 'Manager',
        'personell' => 'Personal',
        'apprentice' => 'Azubi',
        'guest' => 'Gast'
    ];
    return $types[$type] ?? $type;
}

/**
 * Contract type to label
 *
 * @param string|null $type
 * @return string
 */
function contractTypeLabel(?string $type): string {
    if (!$type) return '-';
    $types = [
        'small' => 'Klein (1 Schicht)',
        'large' => 'Gross (2 Schichten)',
        'flexible' => 'Flexibel'
    ];
    return $types[$type] ?? $type;
}

/**
 * Plan status to label
 *
 * @param string $status
 * @return string
 */
function statusLabel(string $status): string {
    $statuses = [
        'draft' => 'Entwurf',
        'published' => 'Veroeffentlicht',
        'archived' => 'Archiviert'
    ];
    return $statuses[$status] ?? $status;
}

/**
 * Plan status to CSS class
 *
 * @param string $status
 * @return string
 */
function statusClass(string $status): string {
    return [
        'draft' => 'status-draft',
        'published' => 'status-published',
        'archived' => 'status-archived'
    ][$status] ?? '';
}

/**
 * Redirect to a URL
 *
 * @param string $url
 * @param int $statusCode
 */
function redirect(string $url, int $statusCode = 302): void {
    header('Location: ' . $url, true, $statusCode);
    exit;
}

/**
 * Return JSON response
 *
 * @param mixed $data
 * @param int $statusCode
 */
function jsonResponse($data, int $statusCode = 200): void {
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

/**
 * Get request method
 *
 * @return string
 */
function requestMethod(): string {
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

/**
 * Check if request is POST
 *
 * @return bool
 */
function isPost(): bool {
    return requestMethod() === 'POST';
}

/**
 * Check if request is AJAX
 *
 * @return bool
 */
function isAjax(): bool {
    return isset($_SERVER['HTTP_X_REQUESTED_WITH'])
        && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
}

/**
 * Get POST data
 *
 * @param string $key
 * @param mixed $default
 * @return mixed
 */
function post(string $key, $default = null) {
    return $_POST[$key] ?? $default;
}

/**
 * Get GET data
 *
 * @param string $key
 * @param mixed $default
 * @return mixed
 */
function get(string $key, $default = null) {
    return $_GET[$key] ?? $default;
}

/**
 * Get JSON request body
 *
 * @return array
 */
function getJsonBody(): array {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

/**
 * Truncate string to length
 *
 * @param string $str
 * @param int $length
 * @param string $suffix
 * @return string
 */
function truncate(string $str, int $length = 100, string $suffix = '...'): string {
    if (mb_strlen($str) <= $length) {
        return $str;
    }
    return mb_substr($str, 0, $length - mb_strlen($suffix)) . $suffix;
}

/**
 * Get full name from user array
 *
 * @param array $user
 * @return string
 */
function fullName(array $user): string {
    $name = trim(($user['firstname'] ?? '') . ' ' . ($user['lastname'] ?? ''));
    return $name ?: ($user['username'] ?? 'Unknown');
}

/**
 * Format week range for display
 *
 * @param string $startDate
 * @param string $endDate
 * @return string
 */
function formatWeekRange(string $startDate, string $endDate): string {
    return formatDate($startDate) . ' - ' . formatDate($endDate);
}

/**
 * Get calendar week number
 *
 * @param string $date
 * @return int
 */
function getCalendarWeek(string $date): int {
    return (int) date('W', strtotime($date));
}
