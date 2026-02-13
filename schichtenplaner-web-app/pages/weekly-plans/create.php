<?php
/**
 * Weekly Plans - Create
 */

requireRole('admin');

$errors = [];
$formData = [
    'name' => '',
    'description' => '',
    'start_date' => '',
    'end_date' => '',
    'work_days' => '1,2,3,4,5',
];

if (isPost()) {
    requireCsrf();

    $formData = [
        'name' => trim(post('name', '')),
        'description' => trim(post('description', '')),
        'start_date' => post('start_date', ''),
        'end_date' => post('end_date', ''),
        'work_days' => implode(',', post('work_days', [1,2,3,4,5])),
    ];

    if (empty($formData['name'])) {
        $errors[] = 'Name ist erforderlich.';
    }
    if (empty($formData['start_date'])) {
        $errors[] = 'Startdatum ist erforderlich.';
    }
    if (empty($formData['end_date'])) {
        $errors[] = 'Enddatum ist erforderlich.';
    }
    if ($formData['start_date'] && $formData['end_date'] && $formData['start_date'] > $formData['end_date']) {
        $errors[] = 'Enddatum muss nach dem Startdatum liegen.';
    }

    if (empty($errors)) {
        try {
            $planId = generateUUID();

            insert('weekly_plans', [
                'id' => $planId,
                'name' => $formData['name'],
                'description' => $formData['description'] ?: null,
                'start_date' => $formData['start_date'],
                'end_date' => $formData['end_date'],
                'work_days' => $formData['work_days'],
                'status' => 'draft',
                'created_by' => getCurrentUserId(),
            ]);

            // Auto-generate weeks
            $startDate = new DateTime($formData['start_date']);
            $endDate = new DateTime($formData['end_date']);
            $weekNum = 1;

            // Adjust start to Monday
            $dayOfWeek = (int) $startDate->format('N');
            if ($dayOfWeek !== 1) {
                $startDate->modify('next monday');
            }

            while ($startDate <= $endDate) {
                $weekEnd = clone $startDate;
                $weekEnd->modify('+6 days');

                if ($weekEnd > $endDate) {
                    $weekEnd = clone $endDate;
                }

                insert('plan_weeks', [
                    'id' => generateUUID(),
                    'plan_id' => $planId,
                    'week_number' => $weekNum,
                    'start_date' => $startDate->format('Y-m-d'),
                    'end_date' => $weekEnd->format('Y-m-d'),
                    'min_employees' => 2,
                    'max_employees' => 4,
                ]);

                $startDate->modify('+7 days');
                $weekNum++;
            }

            flashSuccess('Wochenplan mit ' . ($weekNum - 1) . ' Wochen erstellt.');
            redirect('/weekly-plans/weeks?id=' . $planId);
        } catch (Exception $e) {
            $errors[] = 'Fehler beim Erstellen.';
            if (APP_DEBUG) {
                $errors[] = $e->getMessage();
            }
        }
    }
}

$pageTitle = 'Neuer Wochenplan';

ob_start();
?>

<div class="page-header">
    <h1>Neuer Wochenplan</h1>
    <div class="page-actions">
        <a href="/weekly-plans" class="btn">Zurueck zur Liste</a>
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

<div class="card">
    <form method="POST" action="/weekly-plans/create">
        <?= csrfField() ?>

        <div class="form-group">
            <label for="name">Name *</label>
            <input type="text" id="name" name="name" value="<?= h($formData['name']) ?>" required
                   placeholder="z.B. Wochenplan Q1 2025">
        </div>

        <div class="form-group">
            <label for="description">Beschreibung</label>
            <textarea id="description" name="description" rows="3"><?= h($formData['description']) ?></textarea>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="start_date">Startdatum *</label>
                <input type="date" id="start_date" name="start_date" value="<?= h($formData['start_date']) ?>" required>
                <div class="form-hint">Wochen werden automatisch ab dem naechsten Montag generiert</div>
            </div>

            <div class="form-group">
                <label for="end_date">Enddatum *</label>
                <input type="date" id="end_date" name="end_date" value="<?= h($formData['end_date']) ?>" required>
            </div>
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

        <div class="flex gap-md mt-lg">
            <button type="submit" class="btn btn-primary">Erstellen</button>
            <a href="/weekly-plans" class="btn">Abbrechen</a>
        </div>
    </form>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
