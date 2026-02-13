<?php
/**
 * Manual Shift Assignment
 */

requireRole('admin');

$planId = get('plan');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/shift-plans');
}

$plan = fetchOne("SELECT * FROM shift_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Schichtplan nicht gefunden.');
    redirect('/shift-plans');
}

// Handle assignment changes
if (isPost()) {
    requireCsrf();

    $action = post('action');
    $shiftId = post('shift_id');
    $employeeId = post('employee_id');

    if ($action === 'assign' && $shiftId && $employeeId) {
        // Check if already assigned
        $existing = fetchOne(
            "SELECT id FROM shift_assignments WHERE plan_id = ? AND shift_id = ? AND employee_id = ?",
            [$planId, $shiftId, $employeeId]
        );

        if (!$existing) {
            insert('shift_assignments', [
                'id' => generateUUID(),
                'plan_id' => $planId,
                'shift_id' => $shiftId,
                'employee_id' => $employeeId,
                'assigned_by' => getCurrentUserId(),
            ]);
            flashSuccess('Zuweisung hinzugefuegt.');
        }
    } elseif ($action === 'unassign' && $shiftId && $employeeId) {
        delete('shift_assignments', 'plan_id = ? AND shift_id = ? AND employee_id = ?',
            [$planId, $shiftId, $employeeId]);
        flashSuccess('Zuweisung entfernt.');
    }

    redirect('/assignments/shift-manual?plan=' . $planId);
}

// Get time slots and shifts
$timeSlots = fetchAll("SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time", [$planId]);

$shifts = fetchAll(
    "SELECT s.*, t.name as time_slot_name, t.start_time, t.end_time
     FROM shifts s JOIN time_slots t ON s.time_slot_id = t.id
     WHERE s.plan_id = ?
     ORDER BY t.start_time, s.day_of_week",
    [$planId]
);

// Get all active employees
$employees = getActiveEmployees();

// Get current assignments
$assignments = fetchAll("SELECT * FROM shift_assignments WHERE plan_id = ?", [$planId]);

$assignmentMap = [];
foreach ($assignments as $a) {
    $assignmentMap[$a['shift_id']][$a['employee_id']] = true;
}

// Get preferences for coloring
$prefs = fetchAll("SELECT employee_id, shift_id, preference_level FROM shift_availabilities WHERE plan_id = ?", [$planId]);
$prefMap = [];
foreach ($prefs as $p) {
    $prefMap[$p['shift_id']][$p['employee_id']] = $p['preference_level'];
}

$days = [1 => 'Mo', 2 => 'Di', 3 => 'Mi', 4 => 'Do', 5 => 'Fr', 6 => 'Sa', 7 => 'So'];

$pageTitle = 'Manuelle Zuweisung';

ob_start();
?>

<div class="page-header">
    <h1>Manuelle Zuweisung: <?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <a href="/assignments/shift-solver?plan=<?= h($planId) ?>" class="btn btn-primary">Solver</a>
        <a href="/shift-plans/edit?id=<?= h($planId) ?>" class="btn">Zurueck</a>
    </div>
</div>

<div class="card mb-lg">
    <div class="flex gap-lg">
        <div><span class="pref-cell pref-preferred" style="display: inline-block; padding: 2px 8px;">1</span> Bevorzugt</div>
        <div><span class="pref-cell pref-available" style="display: inline-block; padding: 2px 8px;">2</span> Verfuegbar</div>
        <div><span class="pref-cell pref-unavailable" style="display: inline-block; padding: 2px 8px;">3</span> Nicht verfuegbar</div>
    </div>
</div>

<?php foreach ($shifts as $shift): ?>
<div class="card mb-lg">
    <div class="card-header">
        <h3 class="card-title">
            <?= h($shift['time_slot_name']) ?> - <?= $days[$shift['day_of_week']] ?>
            <span class="text-muted">(<?= formatTime($shift['start_time']) ?> - <?= formatTime($shift['end_time']) ?>)</span>
        </h3>
    </div>

    <div class="flex flex-between flex-center mb-md">
        <span>Min: <?= $shift['min_employees'] ?> | Max: <?= $shift['max_employees'] ?></span>
        <span>Zugewiesen: <?= count($assignmentMap[$shift['id']] ?? []) ?></span>
    </div>

    <div class="flex gap-sm flex-wrap">
        <?php foreach ($employees as $emp):
            $isAssigned = isset($assignmentMap[$shift['id']][$emp['id']]);
            $pref = $prefMap[$shift['id']][$emp['id']] ?? 2;
            $prefCls = prefClass($pref);
        ?>
        <form method="POST" action="/assignments/shift-manual?plan=<?= h($planId) ?>" style="display: inline;">
            <?= csrfField() ?>
            <input type="hidden" name="shift_id" value="<?= h($shift['id']) ?>">
            <input type="hidden" name="employee_id" value="<?= h($emp['id']) ?>">
            <input type="hidden" name="action" value="<?= $isAssigned ? 'unassign' : 'assign' ?>">
            <button type="submit"
                    class="btn btn-sm <?= $isAssigned ? 'btn-primary' : '' ?> <?= $prefCls ?>"
                    title="<?= h(fullName($emp)) ?> - Praeferenz: <?= prefLabel($pref) ?>">
                <?= h($emp['firstname'] . ' ' . substr($emp['lastname'], 0, 1) . '.') ?>
                <?= $isAssigned ? ' ✓' : '' ?>
            </button>
        </form>
        <?php endforeach; ?>
    </div>
</div>
<?php endforeach; ?>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
