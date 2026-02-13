<?php
/**
 * Weekly Plans - Manage Weeks
 */

requireRole('admin');

$planId = get('id');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/weekly-plans');
}

$plan = fetchOne("SELECT * FROM weekly_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Wochenplan nicht gefunden.');
    redirect('/weekly-plans');
}

$errors = [];

if (isPost()) {
    requireCsrf();

    $action = post('action');

    if ($action === 'update_weeks') {
        $weeksData = post('weeks', []);

        try {
            foreach ($weeksData as $weekId => $data) {
                update('plan_weeks', [
                    'min_employees' => max(1, (int) $data['min']),
                    'max_employees' => max(1, (int) $data['max']),
                ], 'id = ? AND plan_id = ?', [$weekId, $planId]);
            }
            flashSuccess('Wochen aktualisiert.');
            redirect('/weekly-plans/weeks?id=' . $planId);
        } catch (Exception $e) {
            $errors[] = 'Fehler beim Aktualisieren.';
        }
    } elseif ($action === 'set_all') {
        $minAll = max(1, (int) post('min_all', 2));
        $maxAll = max(1, (int) post('max_all', 4));

        update('plan_weeks', [
            'min_employees' => $minAll,
            'max_employees' => $maxAll,
        ], 'plan_id = ?', [$planId]);

        flashSuccess('Alle Wochen aktualisiert.');
        redirect('/weekly-plans/weeks?id=' . $planId);
    }
}

// Get weeks
$weeks = fetchAll(
    "SELECT pw.*,
            (SELECT COUNT(*) FROM weekly_assignments WHERE week_id = pw.id) as assignment_count
     FROM plan_weeks pw
     WHERE pw.plan_id = ?
     ORDER BY pw.week_number",
    [$planId]
);

$pageTitle = 'Wochen verwalten';

ob_start();
?>

<div class="page-header">
    <h1>Wochen: <?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <a href="/weekly-plans/edit?id=<?= h($planId) ?>" class="btn">Zurueck zum Plan</a>
    </div>
</div>

<?php if (!empty($errors)): ?>
<div class="alert alert-error">
    <?php foreach ($errors as $error): ?><div><?= h($error) ?></div><?php endforeach; ?>
</div>
<?php endif; ?>

<!-- Set All -->
<div class="card mb-lg">
    <form method="POST" action="/weekly-plans/weeks?id=<?= h($planId) ?>" class="flex gap-md flex-center">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="set_all">
        <span>Alle Wochen setzen auf:</span>
        <input type="number" name="min_all" value="2" min="1" max="10" style="width: 60px;"> Min
        <input type="number" name="max_all" value="4" min="1" max="10" style="width: 60px;"> Max
        <button type="submit" class="btn">Anwenden</button>
    </form>
</div>

<!-- Weeks Table -->
<div class="card">
    <form method="POST" action="/weekly-plans/weeks?id=<?= h($planId) ?>">
        <?= csrfField() ?>
        <input type="hidden" name="action" value="update_weeks">

        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Woche</th>
                        <th>KW</th>
                        <th>Zeitraum</th>
                        <th style="width: 100px;">Min</th>
                        <th style="width: 100px;">Max</th>
                        <th>Zuweisungen</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($weeks as $week): ?>
                    <tr>
                        <td><?= $week['week_number'] ?></td>
                        <td>KW <?= getCalendarWeek($week['start_date']) ?></td>
                        <td><?= formatWeekRange($week['start_date'], $week['end_date']) ?></td>
                        <td>
                            <input type="number"
                                   name="weeks[<?= $week['id'] ?>][min]"
                                   value="<?= $week['min_employees'] ?>"
                                   min="1" max="10"
                                   style="width: 70px;">
                        </td>
                        <td>
                            <input type="number"
                                   name="weeks[<?= $week['id'] ?>][max]"
                                   value="<?= $week['max_employees'] ?>"
                                   min="1" max="10"
                                   style="width: 70px;">
                        </td>
                        <td><?= $week['assignment_count'] ?></td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="mt-lg">
            <button type="submit" class="btn btn-primary">Speichern</button>
        </div>
    </form>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
