<?php
/**
 * Shift Plans - Edit
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
$formData = [
    'name' => $plan['name'],
    'description' => $plan['description'],
    'start_date' => $plan['start_date'],
    'end_date' => $plan['end_date'],
    'status' => $plan['status'],
];

if (isPost()) {
    requireCsrf();

    $action = post('action', 'save');

    if ($action === 'save') {
        $formData = [
            'name' => trim(post('name', '')),
            'description' => trim(post('description', '')),
            'start_date' => post('start_date', ''),
            'end_date' => post('end_date', ''),
            'status' => post('status', 'draft'),
        ];

        if (empty($formData['name'])) {
            $errors[] = 'Name ist erforderlich.';
        }

        if (empty($errors)) {
            try {
                update('shift_plans', [
                    'name' => $formData['name'],
                    'description' => $formData['description'] ?: null,
                    'start_date' => $formData['start_date'] ?: null,
                    'end_date' => $formData['end_date'] ?: null,
                    'status' => $formData['status'],
                ], 'id = ?', [$planId]);

                flashSuccess('Schichtplan aktualisiert.');
                redirect('/shift-plans/edit?id=' . $planId);
            } catch (Exception $e) {
                $errors[] = 'Fehler beim Aktualisieren.';
            }
        }
    } elseif ($action === 'delete') {
        try {
            delete('shift_plans', 'id = ?', [$planId]);
            flashSuccess('Schichtplan geloescht.');
            redirect('/shift-plans');
        } catch (Exception $e) {
            $errors[] = 'Fehler beim Loeschen.';
        }
    }
}

// Get time slots and shifts count
$timeSlotCount = fetchOne("SELECT COUNT(*) as count FROM time_slots WHERE plan_id = ?", [$planId])['count'];
$shiftCount = fetchOne("SELECT COUNT(*) as count FROM shifts WHERE plan_id = ?", [$planId])['count'];
$assignmentCount = fetchOne("SELECT COUNT(*) as count FROM shift_assignments WHERE plan_id = ?", [$planId])['count'];

$pageTitle = 'Schichtplan bearbeiten';

ob_start();
?>

<div class="page-header">
    <h1>Schichtplan bearbeiten</h1>
    <div class="page-actions">
        <a href="/shift-plans/view?id=<?= h($planId) ?>" class="btn">Ansehen</a>
        <a href="/shift-plans" class="btn">Zurueck zur Liste</a>
    </div>
</div>

<?php if (!empty($errors)): ?>
<div class="alert alert-error">
    <ul style="margin: 0; padding-left: var(--spacing-lg);">
        <?php foreach ($errors as $error): ?>
            <li><?= h($error) ?></li>
        <?php endforeach; ?>
    </ul>
</div>
<?php endif; ?>

<div class="grid grid-2">
    <!-- Plan Details -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Plan-Details</h3>
        </div>

        <form method="POST" action="/shift-plans/edit?id=<?= h($planId) ?>">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="save">

            <div class="form-group">
                <label for="name">Name *</label>
                <input type="text" id="name" name="name" value="<?= h($formData['name']) ?>" required>
            </div>

            <div class="form-group">
                <label for="description">Beschreibung</label>
                <textarea id="description" name="description" rows="3"><?= h($formData['description']) ?></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label for="start_date">Startdatum</label>
                    <input type="date" id="start_date" name="start_date" value="<?= h($formData['start_date']) ?>">
                </div>
                <div class="form-group">
                    <label for="end_date">Enddatum</label>
                    <input type="date" id="end_date" name="end_date" value="<?= h($formData['end_date']) ?>">
                </div>
            </div>

            <div class="form-group">
                <label for="status">Status</label>
                <select id="status" name="status">
                    <option value="draft" <?= $formData['status'] === 'draft' ? 'selected' : '' ?>>Entwurf</option>
                    <option value="published" <?= $formData['status'] === 'published' ? 'selected' : '' ?>>Veroeffentlicht</option>
                    <option value="archived" <?= $formData['status'] === 'archived' ? 'selected' : '' ?>>Archiviert</option>
                </select>
            </div>

            <div class="flex gap-md">
                <button type="submit" class="btn btn-primary">Speichern</button>
            </div>
        </form>
    </div>

    <!-- Configuration Links -->
    <div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Konfiguration</h3>
            </div>

            <div class="flex flex-col gap-md">
                <a href="/shift-plans/time-slots?id=<?= h($planId) ?>" class="btn btn-lg">
                    Zeitfenster verwalten (<?= $timeSlotCount ?>)
                </a>
                <a href="/shift-plans/shifts?id=<?= h($planId) ?>" class="btn btn-lg">
                    Schichten konfigurieren (<?= $shiftCount ?>)
                </a>
            </div>
        </div>

        <div class="card mt-lg">
            <div class="card-header">
                <h3 class="card-title">Zuweisungen</h3>
            </div>

            <p class="mb-md"><?= $assignmentCount ?> Zuweisungen vorhanden</p>

            <div class="flex flex-col gap-md">
                <a href="/assignments/shift-manual?plan=<?= h($planId) ?>" class="btn">
                    Manuell zuweisen
                </a>
                <a href="/assignments/shift-solver?plan=<?= h($planId) ?>" class="btn btn-primary">
                    Solver ausfuehren
                </a>
            </div>
        </div>

        <?php if ($plan['status'] === 'draft'): ?>
        <div class="card mt-lg">
            <div class="card-header">
                <h3 class="card-title">Gefahrenzone</h3>
            </div>

            <form method="POST" action="/shift-plans/edit?id=<?= h($planId) ?>"
                  onsubmit="return confirm('Schichtplan wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.')">
                <?= csrfField() ?>
                <input type="hidden" name="action" value="delete">
                <button type="submit" class="btn btn-danger">Schichtplan loeschen</button>
            </form>
        </div>
        <?php endif; ?>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
