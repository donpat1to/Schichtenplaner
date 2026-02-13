<?php
/**
 * User Management - Create User
 */

requireRole('admin');

$errors = [];
$formData = [
    'username' => '',
    'password' => '',
    'firstname' => '',
    'lastname' => '',
    'employee_type' => 'personell',
    'contract_type' => 'large',
    'can_work_alone' => 1,
    'is_trainee' => 0,
    'role' => 'user',
];

if (isPost()) {
    requireCsrf();

    // Get form data
    $formData = [
        'username' => trim(post('username', '')),
        'password' => post('password', ''),
        'firstname' => trim(post('firstname', '')),
        'lastname' => trim(post('lastname', '')),
        'employee_type' => post('employee_type', 'personell'),
        'contract_type' => post('contract_type', null),
        'can_work_alone' => post('can_work_alone') ? 1 : 0,
        'is_trainee' => post('is_trainee') ? 1 : 0,
        'role' => post('role', 'user'),
    ];

    // Validation
    if (empty($formData['username'])) {
        $errors[] = 'Benutzername ist erforderlich.';
    } elseif (!preg_match('/^[a-zA-Z0-9_]{3,50}$/', $formData['username'])) {
        $errors[] = 'Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten (3-50 Zeichen).';
    } elseif (!isUsernameAvailable($formData['username'])) {
        $errors[] = 'Dieser Benutzername ist bereits vergeben.';
    }

    $passwordErrors = validatePassword($formData['password']);
    $errors = array_merge($errors, $passwordErrors);

    if (empty($formData['firstname'])) {
        $errors[] = 'Vorname ist erforderlich.';
    }

    if (empty($formData['lastname'])) {
        $errors[] = 'Nachname ist erforderlich.';
    }

    // Create user if no errors
    if (empty($errors)) {
        try {
            $userId = createUser($formData);
            flashSuccess('Benutzer erfolgreich angelegt.');
            redirect('/users');
        } catch (Exception $e) {
            $errors[] = 'Fehler beim Anlegen des Benutzers.';
            if (APP_DEBUG) {
                $errors[] = $e->getMessage();
            }
        }
    }
}

$pageTitle = 'Neuer Benutzer';

ob_start();
?>

<div class="page-header">
    <h1>Neuer Benutzer</h1>
    <div class="page-actions">
        <a href="/users" class="btn">Zurueck zur Liste</a>
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
    <form method="POST" action="/users/create">
        <?= csrfField() ?>

        <div class="form-row">
            <div class="form-group">
                <label for="username">Benutzername *</label>
                <input type="text"
                       id="username"
                       name="username"
                       value="<?= h($formData['username']) ?>"
                       required
                       pattern="[a-zA-Z0-9_]{3,50}"
                       autocomplete="username">
                <div class="form-hint">3-50 Zeichen, nur Buchstaben, Zahlen und Unterstriche</div>
            </div>

            <div class="form-group">
                <label for="password">Passwort *</label>
                <input type="password"
                       id="password"
                       name="password"
                       required
                       minlength="8"
                       autocomplete="new-password">
                <div class="form-hint">Mindestens 8 Zeichen</div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="firstname">Vorname *</label>
                <input type="text"
                       id="firstname"
                       name="firstname"
                       value="<?= h($formData['firstname']) ?>"
                       required>
            </div>

            <div class="form-group">
                <label for="lastname">Nachname *</label>
                <input type="text"
                       id="lastname"
                       name="lastname"
                       value="<?= h($formData['lastname']) ?>"
                       required>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="employee_type">Mitarbeitertyp</label>
                <select id="employee_type" name="employee_type">
                    <option value="personell" <?= $formData['employee_type'] === 'personell' ? 'selected' : '' ?>>Personal</option>
                    <option value="manager" <?= $formData['employee_type'] === 'manager' ? 'selected' : '' ?>>Manager</option>
                    <option value="apprentice" <?= $formData['employee_type'] === 'apprentice' ? 'selected' : '' ?>>Azubi</option>
                    <option value="guest" <?= $formData['employee_type'] === 'guest' ? 'selected' : '' ?>>Gast</option>
                </select>
            </div>

            <div class="form-group">
                <label for="contract_type">Vertragstyp</label>
                <select id="contract_type" name="contract_type">
                    <option value="">Keiner</option>
                    <option value="small" <?= $formData['contract_type'] === 'small' ? 'selected' : '' ?>>Klein (1 Schicht)</option>
                    <option value="large" <?= $formData['contract_type'] === 'large' ? 'selected' : '' ?>>Gross (2 Schichten)</option>
                    <option value="flexible" <?= $formData['contract_type'] === 'flexible' ? 'selected' : '' ?>>Flexibel</option>
                </select>
            </div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label for="role">Rolle</label>
                <select id="role" name="role">
                    <option value="user" <?= $formData['role'] === 'user' ? 'selected' : '' ?>>Benutzer</option>
                    <option value="admin" <?= $formData['role'] === 'admin' ? 'selected' : '' ?>>Administrator</option>
                </select>
            </div>

            <div class="form-group">
                <label>&nbsp;</label>
                <div class="flex flex-col gap-sm">
                    <label class="checkbox-label">
                        <input type="checkbox"
                               name="can_work_alone"
                               value="1"
                               <?= $formData['can_work_alone'] ? 'checked' : '' ?>>
                        Kann alleine arbeiten
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox"
                               name="is_trainee"
                               value="1"
                               <?= $formData['is_trainee'] ? 'checked' : '' ?>>
                        Ist in Ausbildung (benoetigt Aufsicht)
                    </label>
                </div>
            </div>
        </div>

        <div class="flex gap-md mt-lg">
            <button type="submit" class="btn btn-primary">Benutzer anlegen</button>
            <a href="/users" class="btn">Abbrechen</a>
        </div>
    </form>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
