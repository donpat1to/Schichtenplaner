<?php
/**
 * Holiday Management
 */

requireRole('admin');

$errors = [];

if (isPost()) {
    requireCsrf();

    $action = post('action');

    if ($action === 'add') {
        $name = trim(post('name', ''));
        $date = post('date', '');
        $endDate = post('end_date', '') ?: null;
        $isRecurring = post('is_recurring') ? 1 : 0;

        if (empty($name)) {
            $errors[] = 'Name ist erforderlich.';
        }
        if (empty($date)) {
            $errors[] = 'Datum ist erforderlich.';
        }

        if (empty($errors)) {
            insert('holidays', [
                'id' => generateUUID(),
                'name' => $name,
                'date' => $date,
                'end_date' => $endDate,
                'is_recurring' => $isRecurring,
                'created_by' => getCurrentUserId(),
            ]);
            flashSuccess('Feiertag hinzugefuegt.');
            redirect('/settings/holidays');
        }

    } elseif ($action === 'delete') {
        $holidayId = post('holiday_id');
        if ($holidayId) {
            delete('holidays', 'id = ?', [$holidayId]);
            flashSuccess('Feiertag geloescht.');
            redirect('/settings/holidays');
        }
    }
}

// Get holidays grouped by year
$holidays = fetchAll(
    "SELECT * FROM holidays ORDER BY date DESC"
);

$holidaysByYear = [];
foreach ($holidays as $h) {
    $year = date('Y', strtotime($h['date']));
    $holidaysByYear[$year][] = $h;
}

$pageTitle = 'Feiertage';

ob_start();
?>

<div class="page-header">
    <h1>Feiertage verwalten</h1>
</div>

<?php if (!empty($errors)): ?>
<div class="alert alert-error">
    <?php foreach ($errors as $error): ?><div><?= h($error) ?></div><?php endforeach; ?>
</div>
<?php endif; ?>

<div class="grid grid-2">
    <!-- Add Holiday -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Neuer Feiertag</h3>
        </div>

        <form method="POST" action="/settings/holidays">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="add">

            <div class="form-group">
                <label for="name">Name *</label>
                <input type="text" id="name" name="name" required placeholder="z.B. Weihnachten">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="date">Datum *</label>
                    <input type="date" id="date" name="date" required>
                </div>
                <div class="form-group">
                    <label for="end_date">Enddatum</label>
                    <input type="date" id="end_date" name="end_date">
                    <div class="form-hint">Fuer mehrtaegige Feiertage</div>
                </div>
            </div>

            <div class="form-group">
                <label class="checkbox-label">
                    <input type="checkbox" name="is_recurring" value="1">
                    Jaehrlich wiederkehrend
                </label>
            </div>

            <button type="submit" class="btn btn-primary">Hinzufuegen</button>
        </form>
    </div>

    <!-- Holiday List -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Vorhandene Feiertage</h3>
        </div>

        <?php if (count($holidays) > 0): ?>
            <?php foreach ($holidaysByYear as $year => $yearHolidays): ?>
            <h4 class="mt-md mb-sm"><?= $year ?></h4>
            <table class="mb-lg">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Datum</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($yearHolidays as $holiday): ?>
                    <tr>
                        <td>
                            <?= h($holiday['name']) ?>
                            <?php if ($holiday['is_recurring']): ?>
                                <span class="badge badge-draft">Jaehrlich</span>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?= formatDate($holiday['date']) ?>
                            <?php if ($holiday['end_date']): ?>
                                - <?= formatDate($holiday['end_date']) ?>
                            <?php endif; ?>
                        </td>
                        <td>
                            <form method="POST" action="/settings/holidays" style="display: inline;">
                                <?= csrfField() ?>
                                <input type="hidden" name="action" value="delete">
                                <input type="hidden" name="holiday_id" value="<?= h($holiday['id']) ?>">
                                <button type="submit" class="btn btn-sm btn-danger"
                                        onclick="return confirm('Feiertag loeschen?')">Loeschen</button>
                            </form>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
            <?php endforeach; ?>
        <?php else: ?>
        <div class="empty-state">
            <p>Keine Feiertage vorhanden.</p>
        </div>
        <?php endif; ?>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
