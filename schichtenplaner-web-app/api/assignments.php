<?php
/**
 * Assignments API
 *
 * Handles shift and weekly assignments via AJAX.
 */

requireLogin();

$method = requestMethod();

if ($method === 'GET') {
    $type = get('type', 'shift');
    $planId = get('plan_id');

    if (!$planId) {
        jsonResponse(['error' => 'Missing plan_id'], 400);
    }

    if ($type === 'shift') {
        $assignments = fetchAll(
            "SELECT sa.*, u.firstname, u.lastname, u.employee_type,
                    s.day_of_week, t.name as time_slot_name
             FROM shift_assignments sa
             JOIN users u ON sa.employee_id = u.id
             JOIN shifts s ON sa.shift_id = s.id
             JOIN time_slots t ON s.time_slot_id = t.id
             WHERE sa.plan_id = ?
             ORDER BY t.start_time, s.day_of_week",
            [$planId]
        );
    } else {
        $assignments = fetchAll(
            "SELECT wa.*, u.firstname, u.lastname, u.employee_type,
                    pw.week_number, pw.start_date, pw.end_date
             FROM weekly_assignments wa
             JOIN users u ON wa.employee_id = u.id
             JOIN plan_weeks pw ON wa.week_id = pw.id
             WHERE wa.plan_id = ?
             ORDER BY pw.week_number",
            [$planId]
        );
    }

    jsonResponse(['success' => true, 'assignments' => $assignments]);

} elseif ($method === 'POST') {
    requireRole('admin');

    if (!validateCsrfFromHeader()) {
        jsonResponse(['error' => 'Invalid CSRF token'], 403);
    }

    $data = getJsonBody();
    $action = $data['action'] ?? '';
    $type = $data['type'] ?? 'shift';

    if ($action === 'assign') {
        $planId = $data['plan_id'] ?? '';
        $employeeId = $data['employee_id'] ?? '';

        if ($type === 'shift') {
            $shiftId = $data['shift_id'] ?? '';

            if (!$planId || !$shiftId || !$employeeId) {
                jsonResponse(['error' => 'Missing required fields'], 400);
            }

            // Check if already assigned
            $existing = fetchOne(
                "SELECT id FROM shift_assignments WHERE plan_id = ? AND shift_id = ? AND employee_id = ?",
                [$planId, $shiftId, $employeeId]
            );

            if ($existing) {
                jsonResponse(['error' => 'Already assigned'], 400);
            }

            insert('shift_assignments', [
                'id' => generateUUID(),
                'plan_id' => $planId,
                'shift_id' => $shiftId,
                'employee_id' => $employeeId,
                'assigned_by' => getCurrentUserId(),
            ]);

        } else {
            $weekId = $data['week_id'] ?? '';

            if (!$planId || !$weekId || !$employeeId) {
                jsonResponse(['error' => 'Missing required fields'], 400);
            }

            $existing = fetchOne(
                "SELECT id FROM weekly_assignments WHERE plan_id = ? AND week_id = ? AND employee_id = ?",
                [$planId, $weekId, $employeeId]
            );

            if ($existing) {
                jsonResponse(['error' => 'Already assigned'], 400);
            }

            insert('weekly_assignments', [
                'id' => generateUUID(),
                'plan_id' => $planId,
                'week_id' => $weekId,
                'employee_id' => $employeeId,
                'assigned_by' => getCurrentUserId(),
            ]);
        }

        jsonResponse(['success' => true]);

    } elseif ($action === 'unassign') {
        $planId = $data['plan_id'] ?? '';
        $employeeId = $data['employee_id'] ?? '';

        if ($type === 'shift') {
            $shiftId = $data['shift_id'] ?? '';

            if (!$planId || !$shiftId || !$employeeId) {
                jsonResponse(['error' => 'Missing required fields'], 400);
            }

            delete('shift_assignments', 'plan_id = ? AND shift_id = ? AND employee_id = ?',
                [$planId, $shiftId, $employeeId]);

        } else {
            $weekId = $data['week_id'] ?? '';

            if (!$planId || !$weekId || !$employeeId) {
                jsonResponse(['error' => 'Missing required fields'], 400);
            }

            delete('weekly_assignments', 'plan_id = ? AND week_id = ? AND employee_id = ?',
                [$planId, $weekId, $employeeId]);
        }

        jsonResponse(['success' => true]);

    } elseif ($action === 'clear') {
        $planId = $data['plan_id'] ?? '';

        if (!$planId) {
            jsonResponse(['error' => 'Missing plan_id'], 400);
        }

        if ($type === 'shift') {
            delete('shift_assignments', 'plan_id = ?', [$planId]);
        } else {
            delete('weekly_assignments', 'plan_id = ?', [$planId]);
        }

        jsonResponse(['success' => true]);

    } else {
        jsonResponse(['error' => 'Invalid action'], 400);
    }

} else {
    jsonResponse(['error' => 'Method not allowed'], 405);
}
