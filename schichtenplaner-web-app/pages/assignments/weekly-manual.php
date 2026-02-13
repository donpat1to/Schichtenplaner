<?php
/**
 * Manual Weekly Assignment
 */

requireRole('admin');

$planId = get('plan');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/weekly-plans');
}

$plan = fetchOne("SELECT * FROM weekly_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Wochenplan nicht gefunden.');
    redirect('/weekly-plans');
}

if (isPost()) {
    requireCsrf();

    $action = post('action');
    $weekId = post('week_id');
    $employeeId = post('employee_id');

    if ($action === 'assign' && $weekId && $employeeId) {
        $existing = fetchOne(
            "SELECT id FROM weekly_assignments WHERE plan_id = ? AND week_id = ? AND employee_id = ?",
            [$planId, $weekId, $employeeId]
        );

        if (!$existing) {
            insert('weekly_assignments', [
                'id' => generateUUID(),
                'plan_id' => $planId,
                'week_id' => $weekId,
                'employee_id' => $employeeId,
                'assigned_by' => getCurrentUserId(),
            ]);
            flashSuccess('Zuweisung hinzugefuegt.');
        }
    } elseif ($action === 'unassign' && $weekId && $employeeId) {
        delete('weekly_assignments', 'plan_id = ? AND week_id = ? AND employee_id = ?',
            [$planId, $weekId, $employeeId]);
        flashSuccess('Zuweisung entfernt.');
    }

    redirect('/assignments/weekly-manual?plan=' . $planId);
}

$weeks = fetchAll("SELECT * FROM plan_weeks WHERE plan_id = ? ORDER BY week_number", [$planId]);
$employees = getSchedulableEmployees();

$assignments = fetchAll("SELECT * FROM weekly_assignments WHERE plan_id = ?", [$planId]);
$assignmentMap = [];
foreach ($assignments as $a) {
    $assignmentMap[$a['week_id']][$a['employee_id']] = true;
}

$prefs = fetchAll("SELECT employee_id, week_id, preference_level FROM weekly_preferences WHERE plan_id = ?", [$planId]);
$prefMap = [];
foreach ($prefs as $p) {
    $prefMap[$p['week_id']][$p['employee_id']] = $p['preference_level'];
}

$pageTitle = 'Manuelle Zuweisung';

ob_start();
?>

<div class="page-header">
    <h1>Manuelle Zuweisung: <?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <a href="/assignments/weekly-solver?plan=<?= h($planId) ?>" class="btn btn-primary">Solver</a>
        <a href="/weekly-plans/edit?id=<?= h($planId) ?>" class="btn">Zurueck</a>
    </div>
</div>

<div class="card mb-lg">
    <div class="flex gap-lg">
        <div><span class="pref-cell pref-preferred" style="display: inline-block; padding: 2px 8px;">1</span> Bevorzugt</div>
        <div><span class="pref-cell pref-available" style="display: inline-block; padding: 2px 8px;">2</span> Verfuegbar</div>
        <div><span class="pref-cell pref-unavailable" style="display: inline-block; padding: 2px 8px;">3</span> Nicht verfuegbar</div>
    </div>
</div>

<?php foreach ($weeks as $week): ?>
<div class="card mb-lg">
    <div class="card-header">
        <h3 class="card-title">
            KW <?= getCalendarWeek($week['start_date']) ?>
            <span class="text-muted">(<?= formatWeekRange($week['start_date'], $week['end_date']) ?>)</span>
        </h3>
    </div>

    <div class="flex flex-between flex-center mb-md">
        <span>Min: <?= $week['min_employees'] ?> | Max: <?= $week['max_employees'] ?></span>
        <span>Zugewiesen: <?= count($assignmentMap[$week['id']] ?? []) ?></span>
    </div>

    <div class="flex gap-sm flex-wrap">
        <?php foreach ($employees as $emp):
            $isAssigned = isset($assignmentMap[$week['id']][$emp['id']]);
            $pref = $prefMap[$week['id']][$emp['id']] ?? 2;
            $prefCls = prefClass($pref);
        ?>
        <form method="POST" action="/assignments/weekly-manual?plan=<?= h($planId) ?>" style="display: inline;">
            <?= csrfField() ?>
            <input type="hidden" name="week_id" value="<?= h($week['id']) ?>">
            <input type="hidden" name="employee_id" value="<?= h($emp['id']) ?>">
            <input type="hidden" name="action" value="<?= $isAssigned ? 'unassign' : 'assign' ?>">
            <button type="submit"
                    class="btn btn-sm <?= $isAssigned ? 'btn-primary' : '' ?> <?= $prefCls ?>">
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
