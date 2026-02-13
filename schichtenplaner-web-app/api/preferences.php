<?php
/**
 * Preferences API
 *
 * Handles saving shift and weekly preferences via AJAX.
 */

requireLogin();

if (!isPost()) {
    jsonResponse(['error' => 'Method not allowed'], 405);
}

// Validate CSRF
if (!validateCsrfFromHeader()) {
    jsonResponse(['error' => 'Invalid CSRF token'], 403);
}

$data = getJsonBody();
$userId = getCurrentUserId();

$type = $data['type'] ?? '';
$planId = $data['planId'] ?? '';
$preferences = $data['preferences'] ?? [];

if (!$type || !$planId) {
    jsonResponse(['error' => 'Missing required fields'], 400);
}

try {
    beginTransaction();

    if ($type === 'shift') {
        // Validate plan exists and is draft
        $plan = fetchOne("SELECT status FROM shift_plans WHERE id = ?", [$planId]);
        if (!$plan) {
            jsonResponse(['error' => 'Plan not found'], 404);
        }
        if ($plan['status'] !== 'draft') {
            jsonResponse(['error' => 'Plan is not editable'], 400);
        }

        // Delete existing preferences
        delete('shift_availabilities', 'plan_id = ? AND employee_id = ?', [$planId, $userId]);

        // Insert new preferences
        foreach ($preferences as $shiftId => $level) {
            $level = (int) $level;
            if ($level < 1 || $level > 3) {
                $level = 2;
            }

            // Verify shift belongs to plan
            $shift = fetchOne("SELECT id FROM shifts WHERE id = ? AND plan_id = ?", [$shiftId, $planId]);
            if ($shift) {
                insert('shift_availabilities', [
                    'id' => generateUUID(),
                    'employee_id' => $userId,
                    'plan_id' => $planId,
                    'shift_id' => $shiftId,
                    'preference_level' => $level,
                ]);
            }
        }

    } elseif ($type === 'weekly') {
        // Validate plan exists and is draft
        $plan = fetchOne("SELECT status FROM weekly_plans WHERE id = ?", [$planId]);
        if (!$plan) {
            jsonResponse(['error' => 'Plan not found'], 404);
        }
        if ($plan['status'] !== 'draft') {
            jsonResponse(['error' => 'Plan is not editable'], 400);
        }

        // Delete existing preferences
        delete('weekly_preferences', 'plan_id = ? AND employee_id = ?', [$planId, $userId]);

        // Insert new preferences
        foreach ($preferences as $weekId => $level) {
            $level = (int) $level;
            if ($level < 1 || $level > 3) {
                $level = 2;
            }

            // Verify week belongs to plan
            $week = fetchOne("SELECT id FROM plan_weeks WHERE id = ? AND plan_id = ?", [$weekId, $planId]);
            if ($week) {
                insert('weekly_preferences', [
                    'id' => generateUUID(),
                    'employee_id' => $userId,
                    'plan_id' => $planId,
                    'week_id' => $weekId,
                    'preference_level' => $level,
                ]);
            }
        }

    } else {
        jsonResponse(['error' => 'Invalid type'], 400);
    }

    commit();
    jsonResponse(['success' => true, 'message' => 'Preferences saved']);

} catch (Exception $e) {
    rollback();
    if (APP_DEBUG) {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
    jsonResponse(['error' => 'Failed to save preferences'], 500);
}
