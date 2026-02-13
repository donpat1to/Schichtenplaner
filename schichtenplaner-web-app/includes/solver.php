<?php
/**
 * CP-SAT Solver Integration
 */

/**
 * Run the shift solver
 *
 * @param array $data Solver input data
 * @return array Solver result
 */
function runShiftSolver(array $data): array {
    $input = json_encode($data);
    $escapedInput = escapeshellarg($input);

    $scriptPath = SOLVER_PATH . '/shift_solver.py';

    if (!file_exists($scriptPath)) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Solver script not found: ' . $scriptPath],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    $cmd = sprintf(
        'echo %s | %s %s 2>&1',
        $escapedInput,
        PYTHON_PATH,
        escapeshellarg($scriptPath)
    );

    $output = shell_exec($cmd);

    if ($output === null) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Solver execution failed'],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    $result = json_decode($output, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Invalid solver response: ' . json_last_error_msg(), 'Output: ' . substr($output, 0, 500)],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    return $result;
}

/**
 * Run the weekly solver
 *
 * @param array $data Solver input data
 * @return array Solver result
 */
function runWeeklySolver(array $data): array {
    $input = json_encode($data);
    $escapedInput = escapeshellarg($input);

    $scriptPath = SOLVER_PATH . '/weekly_solver.py';

    if (!file_exists($scriptPath)) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Solver script not found: ' . $scriptPath],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    $cmd = sprintf(
        'echo %s | %s %s 2>&1',
        $escapedInput,
        PYTHON_PATH,
        escapeshellarg($scriptPath)
    );

    $output = shell_exec($cmd);

    if ($output === null) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Solver execution failed'],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    $result = json_decode($output, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        return [
            'success' => false,
            'assignments' => [],
            'violations' => ['Invalid solver response: ' . json_last_error_msg()],
            'metadata' => ['status' => 'ERROR']
        ];
    }

    return $result;
}

/**
 * Prepare input data for shift solver
 *
 * @param string $planId Shift plan ID
 * @return array Solver input
 */
function prepareShiftSolverInput(string $planId): array {
    // Get plan
    $plan = fetchOne("SELECT * FROM shift_plans WHERE id = ?", [$planId]);

    if (!$plan) {
        return ['error' => 'Plan not found'];
    }

    // Get schedulable employees
    $employees = fetchAll(
        "SELECT id, firstname, lastname, employee_type, contract_type,
                can_work_alone, is_trainee, is_active
         FROM users
         WHERE is_active = 1 AND employee_type IN ('personell', 'apprentice', 'manager')"
    );

    // Get shifts with time slot info
    $shifts = fetchAll(
        "SELECT s.*, t.name as time_slot_name, t.start_time, t.end_time
         FROM shifts s
         JOIN time_slots t ON s.time_slot_id = t.id
         WHERE s.plan_id = ?",
        [$planId]
    );

    // Get availabilities
    $availabilities = fetchAll(
        "SELECT employee_id, shift_id, preference_level, notes
         FROM shift_availabilities
         WHERE plan_id = ?",
        [$planId]
    );

    return [
        'plan' => [
            'id' => $plan['id'],
            'name' => $plan['name']
        ],
        'employees' => array_map(fn($e) => [
            'id' => $e['id'],
            'firstname' => $e['firstname'],
            'lastname' => $e['lastname'],
            'employeeType' => $e['employee_type'],
            'contractType' => $e['contract_type'] ?? 'flexible',
            'canWorkAlone' => (bool) $e['can_work_alone'],
            'isTrainee' => (bool) $e['is_trainee'],
            'isActive' => (bool) $e['is_active']
        ], $employees),
        'shifts' => array_map(fn($s) => [
            'id' => $s['id'],
            'planId' => $s['plan_id'],
            'timeSlotId' => $s['time_slot_id'],
            'dayOfWeek' => (int) $s['day_of_week'],
            'minEmployees' => (int) $s['min_employees'],
            'maxEmployees' => (int) $s['max_employees'],
            'timeSlot' => [
                'name' => $s['time_slot_name'],
                'startTime' => $s['start_time'],
                'endTime' => $s['end_time']
            ]
        ], $shifts),
        'availabilities' => array_map(fn($a) => [
            'employeeId' => $a['employee_id'],
            'shiftId' => $a['shift_id'],
            'preferenceLevel' => (int) $a['preference_level']
        ], $availabilities),
        'solverOptions' => [
            'maxTimeInSeconds' => SOLVER_TIMEOUT,
            'numSearchWorkers' => 4
        ]
    ];
}

/**
 * Prepare input data for weekly solver
 *
 * @param string $planId Weekly plan ID
 * @return array Solver input
 */
function prepareWeeklySolverInput(string $planId): array {
    // Get plan
    $plan = fetchOne("SELECT * FROM weekly_plans WHERE id = ?", [$planId]);

    if (!$plan) {
        return ['error' => 'Plan not found'];
    }

    // Get weeks
    $weeks = fetchAll(
        "SELECT * FROM plan_weeks WHERE plan_id = ? ORDER BY week_number",
        [$planId]
    );

    // Get schedulable employees
    $employees = fetchAll(
        "SELECT id, firstname, lastname, employee_type, contract_type,
                can_work_alone, is_trainee, is_active
         FROM users
         WHERE is_active = 1 AND employee_type IN ('personell', 'apprentice')"
    );

    // Get work requirements
    $requirements = fetchAll(
        "SELECT employee_id, required_weeks, assignment_style, assignment_style_consecutive
         FROM work_requirements
         WHERE plan_id = ?",
        [$planId]
    );

    // Get preferences
    $preferences = fetchAll(
        "SELECT employee_id, week_id, preference_level, notes
         FROM weekly_preferences
         WHERE plan_id = ?",
        [$planId]
    );

    return [
        'plan' => [
            'id' => $plan['id'],
            'name' => $plan['name'],
            'startDate' => $plan['start_date'],
            'endDate' => $plan['end_date']
        ],
        'weeks' => array_map(fn($w) => [
            'id' => $w['id'],
            'weekNumber' => (int) $w['week_number'],
            'startDate' => $w['start_date'],
            'endDate' => $w['end_date'],
            'minEmployees' => (int) $w['min_employees'],
            'maxEmployees' => (int) $w['max_employees']
        ], $weeks),
        'employees' => array_map(fn($e) => [
            'id' => $e['id'],
            'firstname' => $e['firstname'],
            'lastname' => $e['lastname'],
            'employeeType' => $e['employee_type'],
            'canWorkAlone' => (bool) $e['can_work_alone'],
            'isTrainee' => (bool) $e['is_trainee'],
            'isActive' => (bool) $e['is_active']
        ], $employees),
        'requirements' => array_map(fn($r) => [
            'employeeId' => $r['employee_id'],
            'requiredWeeks' => (int) $r['required_weeks'],
            'assignmentStyle' => $r['assignment_style'],
            'assignmentStyleConsecutive' => (int) $r['assignment_style_consecutive']
        ], $requirements),
        'preferences' => array_map(fn($p) => [
            'employeeId' => $p['employee_id'],
            'weekId' => $p['week_id'],
            'preferenceLevel' => (int) $p['preference_level']
        ], $preferences),
        'solverOptions' => [
            'maxTimeInSeconds' => SOLVER_TIMEOUT,
            'numSearchWorkers' => 4
        ]
    ];
}

/**
 * Process shift solver results and save to database
 *
 * @param string $planId Shift plan ID
 * @param array $result Solver result
 * @param string $assignedBy User ID who ran the solver
 * @return bool Success
 */
function processShiftSolverResults(string $planId, array $result, string $assignedBy): bool {
    if (!$result['success']) {
        return false;
    }

    try {
        beginTransaction();

        // Clear existing assignments
        delete('shift_assignments', 'plan_id = ?', [$planId]);

        // Insert new assignments
        foreach ($result['assignments'] as $assignment) {
            insert('shift_assignments', [
                'id' => generateUUID(),
                'plan_id' => $planId,
                'shift_id' => $assignment['shiftId'],
                'employee_id' => $assignment['employeeId'],
                'assigned_by' => $assignedBy
            ]);
        }

        commit();
        return true;

    } catch (Exception $e) {
        rollback();
        if (APP_DEBUG) {
            error_log('Solver result processing failed: ' . $e->getMessage());
        }
        return false;
    }
}

/**
 * Process weekly solver results and save to database
 *
 * @param string $planId Weekly plan ID
 * @param array $result Solver result
 * @param string $assignedBy User ID who ran the solver
 * @return bool Success
 */
function processWeeklySolverResults(string $planId, array $result, string $assignedBy): bool {
    if (!$result['success']) {
        return false;
    }

    try {
        beginTransaction();

        // Clear existing assignments
        delete('weekly_assignments', 'plan_id = ?', [$planId]);

        // Insert new assignments
        foreach ($result['assignments'] as $assignment) {
            insert('weekly_assignments', [
                'id' => generateUUID(),
                'plan_id' => $planId,
                'week_id' => $assignment['weekId'],
                'employee_id' => $assignment['employeeId'],
                'assigned_by' => $assignedBy
            ]);
        }

        commit();
        return true;

    } catch (Exception $e) {
        rollback();
        if (APP_DEBUG) {
            error_log('Solver result processing failed: ' . $e->getMessage());
        }
        return false;
    }
}
