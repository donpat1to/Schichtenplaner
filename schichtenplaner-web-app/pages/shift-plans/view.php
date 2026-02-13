<?php
/**
 * Shift Plans - View
 */

requireLogin();

$planId = get('id');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/shift-plans');
}

$plan = fetchOne("SELECT sp.*, u.firstname, u.lastname FROM shift_plans sp JOIN users u ON sp.created_by = u.id WHERE sp.id = ?", [$planId]);

if (!$plan) {
    flashError('Schichtplan nicht gefunden.');
    redirect('/shift-plans');
}

// Get time slots
$timeSlots = fetchAll(
    "SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time",
    [$planId]
);

// Get shifts with assignments
$shifts = fetchAll(
    "SELECT s.*, t.name as time_slot_name, t.start_time, t.end_time
     FROM shifts s
     JOIN time_slots t ON s.time_slot_id = t.id
     WHERE s.plan_id = ?
     ORDER BY t.start_time, s.day_of_week",
    [$planId]
);

// Get assignments
$assignments = fetchAll(
    "SELECT sa.*, u.firstname, u.lastname, u.employee_type
     FROM shift_assignments sa
     JOIN users u ON sa.employee_id = u.id
     WHERE sa.plan_id = ?",
    [$planId]
);

// Group assignments by shift
$assignmentsByShift = [];
foreach ($assignments as $assignment) {
    $assignmentsByShift[$assignment['shift_id']][] = $assignment;
}

// Group shifts by time slot
$shiftsByTimeSlot = [];
foreach ($shifts as $shift) {
    $shiftsByTimeSlot[$shift['time_slot_id']][$shift['day_of_week']] = $shift;
}

$days = [1 => 'Mo', 2 => 'Di', 3 => 'Mi', 4 => 'Do', 5 => 'Fr', 6 => 'Sa', 7 => 'So'];
$isAdminUser = isAdmin();

$pageTitle = $plan['name'];

ob_start();
?>

<div class="page-header">
    <h1><?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <button onclick="window.print()" class="btn no-print">Drucken</button>
        <a href="/api/export?type=shift&plan=<?= h($planId) ?>" class="btn no-print">CSV Export</a>
        <?php if ($isAdminUser): ?>
            <a href="/shift-plans/edit?id=<?= h($planId) ?>" class="btn">Bearbeiten</a>
        <?php endif; ?>
        <a href="/shift-plans" class="btn">Zurueck</a>
    </div>
</div>

<div class="card print-header" style="display: none;">
    <h2><?= h($plan['name']) ?></h2>
    <?php if ($plan['start_date'] && $plan['end_date']): ?>
        <p><?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?></p>
    <?php endif; ?>
</div>

<!-- Plan Info -->
<div class="card mb-lg no-print">
    <div class="flex flex-between flex-center">
        <div>
            <span class="badge badge-<?= $plan['status'] ?>"><?= statusLabel($plan['status']) ?></span>
            <?php if ($plan['start_date'] && $plan['end_date']): ?>
                <span class="text-muted ml-auto">
                    <?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?>
                </span>
            <?php endif; ?>
        </div>
        <div class="text-sm text-muted">
            Erstellt von <?= h($plan['firstname'] . ' ' . $plan['lastname']) ?>
        </div>
    </div>
    <?php if ($plan['description']): ?>
        <p class="mt-md text-muted"><?= h($plan['description']) ?></p>
    <?php endif; ?>
</div>

<!-- Shift Grid -->
<?php if (count($timeSlots) > 0): ?>
<div class="card">
    <div class="table-responsive">
        <table>
            <thead>
                <tr>
                    <th style="width: 150px;">Zeitfenster</th>
                    <?php foreach ($days as $num => $day): ?>
                        <th><?= $day ?></th>
                    <?php endforeach; ?>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($timeSlots as $slot): ?>
                <tr>
                    <td>
                        <strong><?= h($slot['name']) ?></strong><br>
                        <span class="text-sm text-muted">
                            <?= formatTime($slot['start_time']) ?> - <?= formatTime($slot['end_time']) ?>
                        </span>
                    </td>
                    <?php for ($day = 1; $day <= 7; $day++): ?>
                        <?php if (isset($shiftsByTimeSlot[$slot['id']][$day])):
                            $shift = $shiftsByTimeSlot[$slot['id']][$day];
                            $shiftAssignments = $assignmentsByShift[$shift['id']] ?? [];
                        ?>
                        <td style="vertical-align: top;">
                            <div class="text-sm text-muted mb-sm">
                                <?= $shift['min_employees'] ?>-<?= $shift['max_employees'] ?> Pers.
                            </div>
                            <?php if (count($shiftAssignments) > 0): ?>
                                <?php foreach ($shiftAssignments as $a): ?>
                                    <div class="text-sm" style="padding: 2px 0;">
                                        <?= h($a['firstname'] . ' ' . substr($a['lastname'], 0, 1) . '.') ?>
                                        <?php if ($a['employee_type'] === 'manager'): ?>
                                            <span class="text-muted">(M)</span>
                                        <?php endif; ?>
                                    </div>
                                <?php endforeach; ?>
                            <?php else: ?>
                                <span class="text-muted text-sm">-</span>
                            <?php endif; ?>
                        </td>
                        <?php else: ?>
                        <td class="text-muted text-center">-</td>
                        <?php endif; ?>
                    <?php endfor; ?>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>

<!-- Legend -->
<div class="card mt-lg no-print">
    <h3>Legende</h3>
    <div class="flex gap-lg mt-md">
        <div><span class="text-muted">(M)</span> = Manager</div>
        <div>X-Y Pers. = Min-Max Mitarbeiter</div>
    </div>
</div>

<?php else: ?>
<div class="card">
    <div class="empty-state">
        <h3>Keine Zeitfenster definiert</h3>
        <p>Dieser Schichtplan hat noch keine Zeitfenster.</p>
        <?php if ($isAdminUser): ?>
            <a href="/shift-plans/time-slots?id=<?= h($planId) ?>" class="btn btn-primary">Zeitfenster hinzufuegen</a>
        <?php endif; ?>
    </div>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
