<?php
/**
 * Weekly Plans - View
 */

requireLogin();

$planId = get('id');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/weekly-plans');
}

$plan = fetchOne(
    "SELECT wp.*, u.firstname, u.lastname
     FROM weekly_plans wp
     JOIN users u ON wp.created_by = u.id
     WHERE wp.id = ?",
    [$planId]
);

if (!$plan) {
    flashError('Wochenplan nicht gefunden.');
    redirect('/weekly-plans');
}

// Get weeks with assignments
$weeks = fetchAll(
    "SELECT pw.*
     FROM plan_weeks pw
     WHERE pw.plan_id = ?
     ORDER BY pw.week_number",
    [$planId]
);

// Get assignments
$assignments = fetchAll(
    "SELECT wa.*, u.firstname, u.lastname, u.employee_type
     FROM weekly_assignments wa
     JOIN users u ON wa.employee_id = u.id
     WHERE wa.plan_id = ?",
    [$planId]
);

// Group assignments by week
$assignmentsByWeek = [];
foreach ($assignments as $a) {
    $assignmentsByWeek[$a['week_id']][] = $a;
}

$isAdminUser = isAdmin();
$pageTitle = $plan['name'];

ob_start();
?>

<div class="page-header">
    <h1><?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <button onclick="window.print()" class="btn no-print">Drucken</button>
        <a href="/api/export?type=weekly&plan=<?= h($planId) ?>" class="btn no-print">CSV Export</a>
        <?php if ($isAdminUser): ?>
            <a href="/weekly-plans/edit?id=<?= h($planId) ?>" class="btn">Bearbeiten</a>
        <?php endif; ?>
        <a href="/weekly-plans" class="btn">Zurueck</a>
    </div>
</div>

<div class="card mb-lg no-print">
    <div class="flex flex-between flex-center">
        <div>
            <span class="badge badge-<?= $plan['status'] ?>"><?= statusLabel($plan['status']) ?></span>
            <span class="text-muted ml-auto">
                <?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?>
            </span>
        </div>
        <div class="text-sm text-muted">
            Erstellt von <?= h($plan['firstname'] . ' ' . $plan['lastname']) ?>
        </div>
    </div>
</div>

<?php if (count($weeks) > 0): ?>
<div class="card">
    <div class="table-responsive">
        <table>
            <thead>
                <tr>
                    <th style="width: 80px;">KW</th>
                    <th>Zeitraum</th>
                    <th style="width: 80px;">Min-Max</th>
                    <th>Zugewiesene Mitarbeiter</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($weeks as $week):
                    $weekAssignments = $assignmentsByWeek[$week['id']] ?? [];
                    $count = count($weekAssignments);
                    $isUnderMin = $count < $week['min_employees'];
                    $isOverMax = $count > $week['max_employees'];
                ?>
                <tr>
                    <td>
                        <strong>KW <?= getCalendarWeek($week['start_date']) ?></strong>
                    </td>
                    <td><?= formatWeekRange($week['start_date'], $week['end_date']) ?></td>
                    <td>
                        <?= $week['min_employees'] ?>-<?= $week['max_employees'] ?>
                        <span class="<?= $isUnderMin ? 'text-error' : ($isOverMax ? 'text-warning' : 'text-success') ?>">
                            (<?= $count ?>)
                        </span>
                    </td>
                    <td>
                        <?php if ($count > 0): ?>
                            <?php foreach ($weekAssignments as $a): ?>
                                <span style="display: inline-block; margin-right: var(--spacing-sm);">
                                    <?= h($a['firstname'] . ' ' . substr($a['lastname'], 0, 1) . '.') ?>
                                </span>
                            <?php endforeach; ?>
                        <?php else: ?>
                            <span class="text-muted">Keine Zuweisungen</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php else: ?>
<div class="card">
    <div class="empty-state">
        <h3>Keine Wochen definiert</h3>
        <?php if ($isAdminUser): ?>
            <a href="/weekly-plans/weeks?id=<?= h($planId) ?>" class="btn btn-primary">Wochen verwalten</a>
        <?php endif; ?>
    </div>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
