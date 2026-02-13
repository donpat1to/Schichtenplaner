<?php
/**
 * Shift Plans - Configure Shifts
 */

requireRole('admin');

$planId = get('id');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/shift-plans');
}

$plan = fetchOne("SELECT * FROM shift_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Schichtplan nicht gefunden.');
    redirect('/shift-plans');
}

// Get time slots
$timeSlots = fetchAll(
    "SELECT * FROM time_slots WHERE plan_id = ? ORDER BY start_time",
    [$planId]
);

if (count($timeSlots) === 0) {
    flashWarning('Bitte definieren Sie zuerst Zeitfenster.');
    redirect('/shift-plans/time-slots?id=' . $planId);
}

$errors = [];
$days = [1 => 'Montag', 2 => 'Dienstag', 3 => 'Mittwoch', 4 => 'Donnerstag', 5 => 'Freitag', 6 => 'Samstag', 7 => 'Sonntag'];

// Handle form submissions
if (isPost()) {
    requireCsrf();

    $action = post('action');

    if ($action === 'save') {
        // Process shift configuration
        $shiftsData = post('shifts', []);

        try {
            beginTransaction();

            // Delete existing shifts for this plan
            delete('shifts', 'plan_id = ?', [$planId]);

            // Insert new shifts
            foreach ($timeSlots as $slot) {
                foreach ($days as $dayNum => $dayName) {
                    $key = $slot['id'] . '_' . $dayNum;
                    if (isset($shiftsData[$key]) && $shiftsData[$key]['enabled']) {
                        insert('shifts', [
                            'id' => generateUUID(),
                            'plan_id' => $planId,
                            'time_slot_id' => $slot['id'],
                            'day_of_week' => $dayNum,
                            'min_employees' => (int) ($shiftsData[$key]['min'] ?? 1),
                            'max_employees' => (int) ($shiftsData[$key]['max'] ?? 2),
                        ]);
                    }
                }
            }

            commit();
            flashSuccess('Schichten gespeichert.');
            redirect('/shift-plans/shifts?id=' . $planId);
        } catch (Exception $e) {
            rollback();
            $errors[] = 'Fehler beim Speichern.';
        }
    } elseif ($action === 'enable_all') {
        try {
            beginTransaction();
            delete('shifts', 'plan_id = ?', [$planId]);

            foreach ($timeSlots as $slot) {
                for ($day = 1; $day <= 7; $day++) {
                    insert('shifts', [
                        'id' => generateUUID(),
                        'plan_id' => $planId,
                        'time_slot_id' => $slot['id'],
                        'day_of_week' => $day,
                        'min_employees' => 1,
                        'max_employees' => 2,
                    ]);
                }
            }

            commit();
            flashSuccess('Alle Schichten aktiviert.');
            redirect('/shift-plans/shifts?id=' . $planId);
        } catch (Exception $e) {
            rollback();
            $errors[] = 'Fehler beim Aktivieren.';
        }
    } elseif ($action === 'enable_weekdays') {
        try {
            beginTransaction();
            delete('shifts', 'plan_id = ?', [$planId]);

            foreach ($timeSlots as $slot) {
                for ($day = 1; $day <= 5; $day++) { // Mo-Fr only
                    insert('shifts', [
                        'id' => generateUUID(),
                        'plan_id' => $planId,
                        'time_slot_id' => $slot['id'],
                        'day_of_week' => $day,
                        'min_employees' => 1,
                        'max_employees' => 2,
                    ]);
                }
            }

            commit();
            flashSuccess('Wochentag-Schichten aktiviert (Mo-Fr).');
            redirect('/shift-plans/shifts?id=' . $planId);
        } catch (Exception $e) {
            rollback();
            $errors[] = 'Fehler beim Aktivieren.';
        }
    }
}

// Get existing shifts
$existingShifts = fetchAll(
    "SELECT * FROM shifts WHERE plan_id = ?",
    [$planId]
);

$shiftMap = [];
foreach ($existingShifts as $shift) {
    $key = $shift['time_slot_id'] . '_' . $shift['day_of_week'];
    $shiftMap[$key] = $shift;
}

$pageTitle = 'Schichten konfigurieren';

ob_start();
?>

<div class="page-header">
    <h1>Schichten: <?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <a href="/shift-plans/edit?id=<?= h($planId) ?>" class="btn">Zurueck zum Plan</a>
    </div>
</div>

<?php if (!empty($errors)): ?>
<div class="alert alert-error">
    <?php foreach ($errors as $error): ?>
        <div><?= h($error) ?></div>
    <?php endforeach; ?>
</div>
<?php endif; ?>

<!-- Quick Actions -->
<div class="card mb-lg">
    <div class="flex gap-md">
        <form method="POST" action="/shift-plans/shifts?id=<?= h($planId) ?>" style="display: inline;">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="enable_weekdays">
            <button type="submit" class="btn">Alle Wochentage (Mo-Fr)</button>
        </form>
        <form method="POST" action="/shift-plans/shifts?id=<?= h($planId) ?>" style="display: inline;">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="enable_all">
            <button type="submit" class="btn">Alle Tage (Mo-So)</button>
        </form>
    </div>
</div>

<!-- Shift Configuration Grid -->
<form method="POST" action="/shift-plans/shifts?id=<?= h($planId) ?>">
    <?= csrfField() ?>
    <input type="hidden" name="action" value="save">

    <div class="card">
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th style="width: 150px;">Zeitfenster</th>
                        <?php foreach ($days as $num => $name): ?>
                            <th style="width: 100px;"><?= substr($name, 0, 2) ?></th>
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
                        <?php foreach ($days as $dayNum => $dayName):
                            $key = $slot['id'] . '_' . $dayNum;
                            $existing = $shiftMap[$key] ?? null;
                        ?>
                        <td>
                            <div x-data="{ enabled: <?= $existing ? 'true' : 'false' ?> }">
                                <label class="checkbox-label">
                                    <input type="checkbox"
                                           name="shifts[<?= $key ?>][enabled]"
                                           value="1"
                                           x-model="enabled"
                                           <?= $existing ? 'checked' : '' ?>>
                                    Aktiv
                                </label>
                                <div x-show="enabled" class="mt-sm">
                                    <div class="flex gap-xs">
                                        <input type="number"
                                               name="shifts[<?= $key ?>][min]"
                                               value="<?= $existing ? $existing['min_employees'] : 1 ?>"
                                               min="1" max="10"
                                               style="width: 45px;"
                                               title="Min">
                                        <span>-</span>
                                        <input type="number"
                                               name="shifts[<?= $key ?>][max]"
                                               value="<?= $existing ? $existing['max_employees'] : 2 ?>"
                                               min="1" max="10"
                                               style="width: 45px;"
                                               title="Max">
                                    </div>
                                    <div class="text-sm text-muted">Min-Max</div>
                                </div>
                            </div>
                        </td>
                        <?php endforeach; ?>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <div class="flex gap-md mt-lg">
            <button type="submit" class="btn btn-primary">Schichten speichern</button>
        </div>
    </div>
</form>

<div class="card mt-lg">
    <h3>Hinweise</h3>
    <ul style="margin: var(--spacing-md) 0 0 var(--spacing-lg);">
        <li><strong>Min</strong>: Mindestanzahl Mitarbeiter fuer diese Schicht</li>
        <li><strong>Max</strong>: Maximalanzahl Mitarbeiter fuer diese Schicht</li>
        <li>Deaktivierte Schichten werden nicht im Plan angezeigt</li>
        <li>Nach dem Speichern koennen Mitarbeiter ihre Praeferenzen eingeben</li>
    </ul>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
