<?php
/**
 * Shift Preferences Entry
 */

requireLogin();

$planId = get('plan');
$userId = getCurrentUserId();

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/shift-plans');
}

$plan = fetchOne("SELECT * FROM shift_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Schichtplan nicht gefunden.');
    redirect('/shift-plans');
}

// Get time slots with shifts
$timeSlots = fetchAll(
    "SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time",
    [$planId]
);

$shifts = fetchAll(
    "SELECT s.*, t.name as time_slot_name, t.start_time, t.end_time
     FROM shifts s
     JOIN time_slots t ON s.time_slot_id = t.id
     WHERE s.plan_id = ?
     ORDER BY t.start_time, s.day_of_week",
    [$planId]
);

// Group shifts by time slot
$shiftsBySlot = [];
foreach ($shifts as $shift) {
    $shiftsBySlot[$shift['time_slot_id']][$shift['day_of_week']] = $shift;
}

// Get existing preferences
$existingPrefs = fetchAll(
    "SELECT shift_id, preference_level FROM shift_availabilities WHERE plan_id = ? AND employee_id = ?",
    [$planId, $userId]
);

$preferences = [];
foreach ($existingPrefs as $p) {
    $preferences[$p['shift_id']] = (int) $p['preference_level'];
}

$days = [1 => 'Mo', 2 => 'Di', 3 => 'Mi', 4 => 'Do', 5 => 'Fr', 6 => 'Sa', 7 => 'So'];
$readonly = $plan['status'] !== 'draft';

$pageTitle = 'Praeferenzen: ' . $plan['name'];

ob_start();
?>

<div class="page-header">
    <h1>Schicht-Praeferenzen</h1>
    <div class="page-actions">
        <a href="/shift-plans" class="btn">Zurueck</a>
    </div>
</div>

<div class="card mb-lg">
    <h2><?= h($plan['name']) ?></h2>
    <?php if ($plan['start_date'] && $plan['end_date']): ?>
        <p class="text-muted"><?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?></p>
    <?php endif; ?>
    <span class="badge badge-<?= $plan['status'] ?>"><?= statusLabel($plan['status']) ?></span>
</div>

<?php if ($readonly): ?>
<div class="alert alert-warning">
    Dieser Plan ist nicht mehr im Entwurfsstatus. Praeferenzen koennen nicht mehr geaendert werden.
</div>
<?php endif; ?>

<?php if (count($timeSlots) > 0): ?>
<?php include TEMPLATES_PATH . '/components/preference-grid.php'; ?>

<div class="card">
    <?php
    // Build time slots with shifts for the grid
    $slotsWithShifts = [];
    foreach ($timeSlots as $slot) {
        $slotsWithShifts[] = [
            'id' => $slot['id'],
            'name' => $slot['name'],
            'start_time' => $slot['start_time'],
            'end_time' => $slot['end_time'],
            'shifts' => $shiftsBySlot[$slot['id']] ?? [],
        ];
    }

    renderShiftPreferenceGrid($slotsWithShifts, $preferences, $planId, $readonly);
    ?>
</div>
<?php else: ?>
<div class="card">
    <div class="empty-state">
        <h3>Keine Schichten vorhanden</h3>
        <p>Dieser Schichtplan hat noch keine Schichten definiert.</p>
    </div>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
