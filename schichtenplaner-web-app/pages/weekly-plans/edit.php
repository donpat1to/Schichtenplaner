<?php
/**
 * Weekly Plans - Edit
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
$formData = [
    'name' => $plan['name'],
    'description' => $plan['description'],
    'work_days' => $plan['work_days'],
    'status' => $plan['status'],
];

if (isPost()) {
    requireCsrf();

    $action = post('action', 'save');

    if ($action === 'save') {
        $formData = [
            'name' => trim(post('name', '')),
            'description' => trim(post('description', '')),
            'work_days' => implode(',', post('work_days', [])),
            'status' => post('status', 'draft'),
        ];

        if (empty($formData['name'])) {
            $errors[] = 'Name ist erforderlich.';
        }

        if (empty($errors)) {
            update('weekly_plans', [
                'name' => $formData['name'],
                'description' => $formData['description'] ?: null,
                'work_days' => $formData['work_days'],
                'status' => $formData['status'],
            ], 'id = ?', [$planId]);

            flashSuccess('Wochenplan aktualisiert.');
            redirect('/weekly-plans/edit?id=' . $planId);
        }
    } elseif ($action === 'delete') {
        delete('weekly_plans', 'id = ?', [$planId]);
        flashSuccess('Wochenplan geloescht.');
        redirect('/weekly-plans');
    }
}

$weekCount = fetchOne("SELECT COUNT(*) as count FROM plan_weeks WHERE plan_id = ?", [$planId])['count'];
$assignmentCount = fetchOne("SELECT COUNT(*) as count FROM weekly_assignments WHERE plan_id = ?", [$planId])['count'];

$pageTitle = 'Wochenplan bearbeiten';

ob_start();
?>

<div class="page-header">
    <h1>Wochenplan bearbeiten</h1>
    <div class="page-actions">
        <a href="/weekly-plans/view?id=<?= h($planId) ?>" class="btn">Ansehen</a>
        <a href="/weekly-plans" class="btn">Zurueck</a>
    </div>
</div>

<?php if (!empty($errors)): ?>
<div class="alert alert-error">
    <?php foreach ($errors as $error): ?><div><?= h($error) ?></div><?php endforeach; ?>
</div>
<?php endif; ?>

<div class="grid grid-2">
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Plan-Details</h3>
        </div>

        <form method="POST" action="/weekly-plans/edit?id=<?= h($planId) ?>">
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

            <div class="form-group">
                <label>Zeitraum</label>
                <p><?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?></p>
            </div>

            <div class="form-group">
                <label>Arbeitstage</label>
                <div class="flex gap-md flex-wrap">
                    <?php
                    $selectedDays = explode(',', $formData['work_days']);
                    $dayNames = [1 => 'Mo', 2 => 'Di', 3 => 'Mi', 4 => 'Do', 5 => 'Fr', 6 => 'Sa', 7 => 'So'];
                    foreach ($dayNames as $num => $name):
                    ?>
                    <label class="checkbox-label">
                        <input type="checkbox" name="work_days[]" value="<?= $num ?>"
                               <?= in_array($num, $selectedDays) ? 'checked' : '' ?>>
                        <?= $name ?>
                    </label>
                    <?php endforeach; ?>
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

            <button type="submit" class="btn btn-primary">Speichern</button>
        </form>
    </div>

    <div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Konfiguration</h3>
            </div>
            <div class="flex flex-col gap-md">
                <a href="/weekly-plans/weeks?id=<?= h($planId) ?>" class="btn btn-lg">
                    Wochen verwalten (<?= $weekCount ?>)
                </a>
            </div>
        </div>

        <div class="card mt-lg">
            <div class="card-header">
                <h3 class="card-title">Zuweisungen</h3>
            </div>
            <p class="mb-md"><?= $assignmentCount ?> Zuweisungen vorhanden</p>
            <div class="flex flex-col gap-md">
                <a href="/assignments/weekly-manual?plan=<?= h($planId) ?>" class="btn">Manuell zuweisen</a>
                <a href="/assignments/weekly-solver?plan=<?= h($planId) ?>" class="btn btn-primary">Solver ausfuehren</a>
            </div>
        </div>

        <?php if ($plan['status'] === 'draft'): ?>
        <div class="card mt-lg">
            <div class="card-header">
                <h3 class="card-title">Gefahrenzone</h3>
            </div>
            <form method="POST" action="/weekly-plans/edit?id=<?= h($planId) ?>"
                  onsubmit="return confirm('Wochenplan wirklich loeschen?')">
                <?= csrfField() ?>
                <input type="hidden" name="action" value="delete">
                <button type="submit" class="btn btn-danger">Wochenplan loeschen</button>
            </form>
        </div>
        <?php endif; ?>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
