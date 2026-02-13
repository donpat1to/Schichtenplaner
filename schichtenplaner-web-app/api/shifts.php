<?php
/**
 * Shifts API
 *
 * Handles shift operations via AJAX.
 */

requireLogin();

$method = requestMethod();

if ($method === 'GET') {
    // Get shifts for a plan
    $planId = get('plan_id');

    if (!$planId) {
        jsonResponse(['error' => 'Missing plan_id'], 400);
    }

    $shifts = fetchAll(
        "SELECT s.*, t.name as time_slot_name, t.start_time, t.end_time
         FROM shifts s
         JOIN time_slots t ON s.time_slot_id = t.id
         WHERE s.plan_id = ?
         ORDER BY t.start_time, s.day_of_week",
        [$planId]
    );

    jsonResponse(['success' => true, 'shifts' => $shifts]);

} elseif ($method === 'POST') {
    requireRole('admin');

    if (!validateCsrfFromHeader()) {
        jsonResponse(['error' => 'Invalid CSRF token'], 403);
    }

    $data = getJsonBody();
    $action = $data['action'] ?? '';

    if ($action === 'create') {
        $planId = $data['plan_id'] ?? '';
        $timeSlotId = $data['time_slot_id'] ?? '';
        $dayOfWeek = (int) ($data['day_of_week'] ?? 0);
        $minEmployees = (int) ($data['min_employees'] ?? 1);
        $maxEmployees = (int) ($data['max_employees'] ?? 2);

        if (!$planId || !$timeSlotId || $dayOfWeek < 1 || $dayOfWeek > 7) {
            jsonResponse(['error' => 'Invalid data'], 400);
        }

        // Check if shift already exists
        $existing = fetchOne(
            "SELECT id FROM shifts WHERE plan_id = ? AND time_slot_id = ? AND day_of_week = ?",
            [$planId, $timeSlotId, $dayOfWeek]
        );

        if ($existing) {
            jsonResponse(['error' => 'Shift already exists'], 400);
        }

        $shiftId = generateUUID();
        insert('shifts', [
            'id' => $shiftId,
            'plan_id' => $planId,
            'time_slot_id' => $timeSlotId,
            'day_of_week' => $dayOfWeek,
            'min_employees' => $minEmployees,
            'max_employees' => $maxEmployees,
        ]);

        jsonResponse(['success' => true, 'id' => $shiftId]);

    } elseif ($action === 'update') {
        $shiftId = $data['id'] ?? '';
        $minEmployees = (int) ($data['min_employees'] ?? 1);
        $maxEmployees = (int) ($data['max_employees'] ?? 2);

        if (!$shiftId) {
            jsonResponse(['error' => 'Missing shift id'], 400);
        }

        update('shifts', [
            'min_employees' => $minEmployees,
            'max_employees' => $maxEmployees,
        ], 'id = ?', [$shiftId]);

        jsonResponse(['success' => true]);

    } elseif ($action === 'delete') {
        $shiftId = $data['id'] ?? '';

        if (!$shiftId) {
            jsonResponse(['error' => 'Missing shift id'], 400);
        }

        delete('shifts', 'id = ?', [$shiftId]);
        jsonResponse(['success' => true]);

    } else {
        jsonResponse(['error' => 'Invalid action'], 400);
    }

} else {
    jsonResponse(['error' => 'Method not allowed'], 405);
}
