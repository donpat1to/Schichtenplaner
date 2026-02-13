<?php
/**
 * Shift Plans - Manage Time Slots
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

$errors = [];

// Handle form submissions
if (isPost()) {
    requireCsrf();

    $action = post('action');

    if ($action === 'add') {
        $name = trim(post('name', ''));
        $startTime = post('start_time', '');
        $endTime = post('end_time', '');

        if (empty($name)) {
            $errors[] = 'Name ist erforderlich.';
        }
        if (empty($startTime) || empty($endTime)) {
            $errors[] = 'Start- und Endzeit sind erforderlich.';
        }

        if (empty($errors)) {
            insert('time_slots', [
                'id' => generateUUID(),
                'plan_id' => $planId,
                'name' => $name,
                'start_time' => $startTime,
                'end_time' => $endTime,
            ]);
            flashSuccess('Zeitfenster hinzugefuegt.');
            redirect('/shift-plans/time-slots?id=' . $planId);
        }
    } elseif ($action === 'delete') {
        $slotId = post('slot_id');
        if ($slotId) {
            delete('time_slots', 'id = ? AND plan_id = ?', [$slotId, $planId]);
            flashSuccess('Zeitfenster geloescht.');
            redirect('/shift-plans/time-slots?id=' . $planId);
        }
    }
}

// Get existing time slots
$timeSlots = fetchAll(
    "SELECT ts.*,
            (SELECT COUNT(*) FROM shifts WHERE time_slot_id = ts.id) as shift_count
     FROM time_slots ts
     WHERE ts.plan_id = ?
     ORDER BY ts.start_time",
    [$planId]
);

$pageTitle = 'Zeitfenster verwalten';

ob_start();
?>

<div class="page-header">
    <h1>Zeitfenster: <?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <a href="/shift-plans/shifts?id=<?= h($planId) ?>" class="btn">Schichten konfigurieren</a>
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

<div class="grid grid-2">
    <!-- Add Time Slot -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Neues Zeitfenster</h3>
        </div>

        <form method="POST" action="/shift-plans/time-slots?id=<?= h($planId) ?>">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="add">

            <div class="form-group">
                <label for="name">Name *</label>
                <input type="text"
                       id="name"
                       name="name"
                       required
                       placeholder="z.B. Fruehschicht">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="start_time">Startzeit *</label>
                    <input type="time" id="start_time" name="start_time" required>
                </div>
                <div class="form-group">
                    <label for="end_time">Endzeit *</label>
                    <input type="time" id="end_time" name="end_time" required>
                </div>
            </div>

            <button type="submit" class="btn btn-primary">Hinzufuegen</button>
        </form>
    </div>

    <!-- Existing Time Slots -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Vorhandene Zeitfenster</h3>
        </div>

        <?php if (count($timeSlots) > 0): ?>
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Zeit</th>
                    <th>Schichten</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($timeSlots as $slot): ?>
                <tr>
                    <td><?= h($slot['name']) ?></td>
                    <td><?= formatTime($slot['start_time']) ?> - <?= formatTime($slot['end_time']) ?></td>
                    <td><?= $slot['shift_count'] ?></td>
                    <td>
                        <?php if ($slot['shift_count'] == 0): ?>
                        <form method="POST" action="/shift-plans/time-slots?id=<?= h($planId) ?>" style="display: inline;">
                            <?= csrfField() ?>
                            <input type="hidden" name="action" value="delete">
                            <input type="hidden" name="slot_id" value="<?= h($slot['id']) ?>">
                            <button type="submit" class="btn btn-sm btn-danger"
                                    onclick="return confirm('Zeitfenster loeschen?')">Loeschen</button>
                        </form>
                        <?php else: ?>
                        <span class="text-muted text-sm">In Verwendung</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <div class="empty-state">
            <p>Noch keine Zeitfenster definiert.</p>
        </div>
        <?php endif; ?>
    </div>
</div>

<div class="card mt-lg">
    <h3>Typische Zeitfenster</h3>
    <p class="text-muted">Beispiele fuer haeufig verwendete Zeitfenster:</p>
    <ul style="margin: var(--spacing-md) 0 0 var(--spacing-lg);">
        <li>Fruehschicht: 06:00 - 14:00</li>
        <li>Spaetschicht: 14:00 - 22:00</li>
        <li>Nachtschicht: 22:00 - 06:00</li>
        <li>Tagschicht: 08:00 - 17:00</li>
    </ul>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
