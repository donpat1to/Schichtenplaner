<?php
/**
 * Shift Plans - Create
 */

requireRole('admin');

$errors = [];
$formData = [
    'name' => '',
    'description' => '',
    'start_date' => '',
    'end_date' => '',
];

if (isPost()) {
    requireCsrf();

    $formData = [
        'name' => trim(post('name', '')),
        'description' => trim(post('description', '')),
        'start_date' => post('start_date', ''),
        'end_date' => post('end_date', ''),
    ];

    // Validation
    if (empty($formData['name'])) {
        $errors[] = 'Name ist erforderlich.';
    }

    // Create plan if no errors
    if (empty($errors)) {
        try {
            $planId = generateUUID();

            insert('shift_plans', [
                'id' => $planId,
                'name' => $formData['name'],
                'description' => $formData['description'] ?: null,
                'start_date' => $formData['start_date'] ?: null,
                'end_date' => $formData['end_date'] ?: null,
                'status' => 'draft',
                'created_by' => getCurrentUserId(),
            ]);

            flashSuccess('Schichtplan erstellt. Definieren Sie nun die Zeitfenster.');
            redirect('/shift-plans/time-slots?id=' . $planId);
        } catch (Exception $e) {
            $errors[] = 'Fehler beim Erstellen des Schichtplans.';
            if (APP_DEBUG) {
                $errors[] = $e->getMessage();
            }
        }
    }
}

$pageTitle = 'Neuer Schichtplan';

ob_start();
?>

<div class="page-header">
    <h1>Neuer Schichtplan</h1>
    <div class="page-actions">
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

<div class="card">
    <form method="POST" action="/shift-plans/create">
        <?= csrfField() ?>

        <div class="form-group">
            <label for="name">Name *</label>
            <input type="text"
                   id="name"
                   name="name"
                   value="<?= h($formData['name']) ?>"
                   required
                   placeholder="z.B. Schichtplan Januar 2025">
        </div>

        <div class="form-group">
            <label for="description">Beschreibung</label>
            <textarea id="description"
                      name="description"
                      rows="3"
                      placeholder="Optionale Beschreibung..."><?= h($formData['description']) ?></textarea>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="start_date">Startdatum</label>
                <input type="date"
                       id="start_date"
                       name="start_date"
                       value="<?= h($formData['start_date']) ?>">
            </div>

            <div class="form-group">
                <label for="end_date">Enddatum</label>
                <input type="date"
                       id="end_date"
                       name="end_date"
                       value="<?= h($formData['end_date']) ?>">
            </div>
        </div>

        <div class="flex gap-md mt-lg">
            <button type="submit" class="btn btn-primary">Erstellen und Zeitfenster definieren</button>
            <a href="/shift-plans" class="btn">Abbrechen</a>
        </div>
    </form>
</div>

<div class="card mt-lg">
    <h3>Naechste Schritte</h3>
    <ol style="margin: var(--spacing-md) 0 0 var(--spacing-lg);">
        <li><strong>Schichtplan erstellen</strong> (dieser Schritt)</li>
        <li>Zeitfenster definieren (z.B. "Fruehschicht", "Spaetschicht")</li>
        <li>Schichten fuer jeden Wochentag konfigurieren</li>
        <li>Mitarbeiter geben Praeferenzen ein</li>
        <li>Solver ausfuehren oder manuell zuweisen</li>
        <li>Plan veroeffentlichen</li>
    </ol>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
