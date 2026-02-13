<?php
/**
 * CSV Export API
 */

require_once __DIR__ . '/../config.php';

requireLogin();

$type = get('type', '');
$planId = get('plan', '');

if (empty($type) || empty($planId)) {
    http_response_code(400);
    die('Missing parameters');
}

if ($type === 'shift') {
    exportShiftPlan($planId);
} elseif ($type === 'weekly') {
    exportWeeklyPlan($planId);
} else {
    http_response_code(400);
    die('Invalid export type');
}

/**
 * Export shift plan assignments to CSV
 */
function exportShiftPlan(string $planId): void {
    $plan = fetchOne("SELECT * FROM shift_plans WHERE id = ?", [$planId]);

    if (!$plan) {
        http_response_code(404);
        die('Plan not found');
    }

    // Get time slots
    $timeSlots = fetchAll(
        "SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time",
        [$planId]
    );

    // Get shifts with assignments
    $shifts = fetchAll("
        SELECT s.*, ts.name as time_slot_name, ts.start_time, ts.end_time
        FROM shifts s
        JOIN time_slots ts ON s.time_slot_id = ts.id
        WHERE s.plan_id = ?
        ORDER BY ts.start_time, s.day_of_week
    ", [$planId]);

    // Get assignments
    $assignments = fetchAll("
        SELECT sa.shift_id, u.firstname, u.lastname, u.employee_type
        FROM shift_assignments sa
        JOIN users u ON sa.employee_id = u.id
        WHERE sa.plan_id = ?
        ORDER BY u.lastname, u.firstname
    ", [$planId]);

    // Group assignments by shift
    $assignmentsByShift = [];
    foreach ($assignments as $a) {
        $assignmentsByShift[$a['shift_id']][] = $a['firstname'] . ' ' . $a['lastname'];
    }

    // Prepare CSV
    $filename = 'schichtplan_' . sanitizeFilename($plan['name']) . '_' . date('Y-m-d') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // BOM for Excel UTF-8 compatibility
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    // Header row
    $days = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
    fputcsv($output, $days, ';');

    // Data rows by time slot
    foreach ($timeSlots as $slot) {
        $row = [$slot['name'] . ' (' . substr($slot['start_time'], 0, 5) . '-' . substr($slot['end_time'], 0, 5) . ')'];

        for ($day = 1; $day <= 7; $day++) {
            $shiftId = null;
            foreach ($shifts as $s) {
                if ($s['time_slot_id'] === $slot['id'] && (int)$s['day_of_week'] === $day) {
                    $shiftId = $s['id'];
                    break;
                }
            }

            if ($shiftId && isset($assignmentsByShift[$shiftId])) {
                $row[] = implode(', ', $assignmentsByShift[$shiftId]);
            } else {
                $row[] = '-';
            }
        }

        fputcsv($output, $row, ';');
    }

    fclose($output);
    exit;
}

/**
 * Export weekly plan assignments to CSV
 */
function exportWeeklyPlan(string $planId): void {
    $plan = fetchOne("SELECT * FROM weekly_plans WHERE id = ?", [$planId]);

    if (!$plan) {
        http_response_code(404);
        die('Plan not found');
    }

    // Get weeks
    $weeks = fetchAll(
        "SELECT * FROM plan_weeks WHERE plan_id = ? ORDER BY week_number",
        [$planId]
    );

    // Get assignments with employee info
    $assignments = fetchAll("
        SELECT wa.week_id, u.firstname, u.lastname, u.employee_type
        FROM weekly_assignments wa
        JOIN users u ON wa.employee_id = u.id
        WHERE wa.plan_id = ?
        ORDER BY u.lastname, u.firstname
    ", [$planId]);

    // Group assignments by week
    $assignmentsByWeek = [];
    foreach ($assignments as $a) {
        $assignmentsByWeek[$a['week_id']][] = $a['firstname'] . ' ' . $a['lastname'];
    }

    // Prepare CSV
    $filename = 'wochenplan_' . sanitizeFilename($plan['name']) . '_' . date('Y-m-d') . '.csv';

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    $output = fopen('php://output', 'w');

    // BOM for Excel UTF-8 compatibility
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    // Header row
    fputcsv($output, ['Woche', 'Zeitraum', 'Zugewiesene Mitarbeiter'], ';');

    // Data rows
    foreach ($weeks as $week) {
        $employees = isset($assignmentsByWeek[$week['id']])
            ? implode(', ', $assignmentsByWeek[$week['id']])
            : '-';

        $row = [
            'KW ' . $week['week_number'],
            formatDate($week['start_date']) . ' - ' . formatDate($week['end_date']),
            $employees
        ];

        fputcsv($output, $row, ';');
    }

    fclose($output);
    exit;
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(string $name): string {
    $name = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
    return substr($name, 0, 50);
}
