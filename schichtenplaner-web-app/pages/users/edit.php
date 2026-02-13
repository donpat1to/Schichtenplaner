<?php
/**
 * User Management - Edit User
 */

requireRole('admin');

$userId = get('id');

if (!$userId) {
    flashError('Benutzer-ID fehlt.');
    redirect('/users');
}

$user = getUserById($userId);

if (!$user) {
    flashError('Benutzer nicht gefunden.');
    redirect('/users');
}

$errors = [];
$formData = [
    'username' => $user['username'],
    'password' => '',
    'firstname' => $user['firstname'],
    'lastname' => $user['lastname'],
    'employee_type' => $user['employee_type'],
    'contract_type' => $user['contract_type'],
    'can_work_alone' => $user['can_work_alone'],
    'is_trainee' => $user['is_trainee'],
    'is_active' => $user['is_active'],
    'role' => $user['role'],
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
        'contract_type' => post('contract_type', null) ?: null,
        'can_work_alone' => post('can_work_alone') ? 1 : 0,
        'is_trainee' => post('is_trainee') ? 1 : 0,
        'is_active' => post('is_active') ? 1 : 0,
        'role' => post('role', 'user'),
    ];

    // Validation
    if (empty($formData['username'])) {
        $errors[] = 'Benutzername ist erforderlich.';
    } elseif (!preg_match('/^[a-zA-Z0-9_]{3,50}$/', $formData['username'])) {
        $errors[] = 'Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten (3-50 Zeichen).';
    } elseif (!isUsernameAvailable($formData['username'], $userId)) {
        $errors[] = 'Dieser Benutzername ist bereits vergeben.';
    }

    // Only validate password if provided
    if (!empty($formData['password'])) {
        $passwordErrors = validatePassword($formData['password']);
        $errors = array_merge($errors, $passwordErrors);
    }

    if (empty($formData['firstname'])) {
        $errors[] = 'Vorname ist erforderlich.';
    }

    if (empty($formData['lastname'])) {
        $errors[] = 'Nachname ist erforderlich.';
    }

    // Prevent self-demotion from admin
    if ($userId === getCurrentUserId() && $formData['role'] !== 'admin') {
        $errors[] = 'Sie koennen sich nicht selbst die Admin-Rechte entziehen.';
    }

    // Prevent self-deactivation
    if ($userId === getCurrentUserId() && !$formData['is_active']) {
        $errors[] = 'Sie koennen sich nicht selbst deaktivieren.';
    }

    // Update user if no errors
    if (empty($errors)) {
        try {
            // Build update data
            $updateData = [
                'username' => $formData['username'],
                'firstname' => $formData['firstname'],
                'lastname' => $formData['lastname'],
                'employee_type' => $formData['employee_type'],
                'contract_type' => $formData['contract_type'],
                'can_work_alone' => $formData['can_work_alone'],
                'is_trainee' => $formData['is_trainee'],
                'is_active' => $formData['is_active'],
                'role' => $formData['role'],
            ];

            // Only include password if provided
            if (!empty($formData['password'])) {
                $updateData['password'] = $formData['password'];
            }

            updateUser($userId, $updateData);
            flashSuccess('Benutzer erfolgreich aktualisiert.');
            redirect('/users');
        } catch (Exception $e) {
            $errors[] = 'Fehler beim Aktualisieren des Benutzers.';
            if (APP_DEBUG) {
                $errors[] = $e->getMessage();
            }
        }
    }
}

$pageTitle = 'Benutzer bearbeiten';

ob_start();
?>

<div class="page-header">
    <h1>Benutzer bearbeiten</h1>
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
    <form method="POST" action="/users/edit?id=<?= h($userId) ?>">
        <?= csrfField() ?>

        <div class="form-row">
            <div class="form-group">
                <label for="username">Benutzername *</label>
                <input type="text"
                       id="username"
                       name="username"
                       value="<?= h($formData['username']) ?>"
                       required
                       pattern="[a-zA-Z0-9_]{3,50}">
            </div>

            <div class="form-group">
                <label for="password">Neues Passwort</label>
                <input type="password"
                       id="password"
                       name="password"
                       minlength="8"
                       autocomplete="new-password">
                <div class="form-hint">Leer lassen, um Passwort nicht zu aendern</div>
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
                <select id="role" name="role" <?= $userId === getCurrentUserId() ? 'disabled' : '' ?>>
                    <option value="user" <?= $formData['role'] === 'user' ? 'selected' : '' ?>>Benutzer</option>
                    <option value="admin" <?= $formData['role'] === 'admin' ? 'selected' : '' ?>>Administrator</option>
                </select>
                <?php if ($userId === getCurrentUserId()): ?>
                    <input type="hidden" name="role" value="<?= h($formData['role']) ?>">
                    <div class="form-hint">Sie koennen Ihre eigene Rolle nicht aendern.</div>
                <?php endif; ?>
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
                        Ist in Ausbildung
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox"
                               name="is_active"
                               value="1"
                               <?= $formData['is_active'] ? 'checked' : '' ?>
                               <?= $userId === getCurrentUserId() ? 'disabled' : '' ?>>
                        Aktiv
                        <?php if ($userId === getCurrentUserId()): ?>
                            <input type="hidden" name="is_active" value="1">
                        <?php endif; ?>
                    </label>
                </div>
            </div>
        </div>

        <div class="flex gap-md mt-lg">
            <button type="submit" class="btn btn-primary">Speichern</button>
            <a href="/users" class="btn">Abbrechen</a>
        </div>
    </form>
</div>

<div class="card mt-lg">
    <h3>Benutzerinformationen</h3>
    <div class="grid grid-2 mt-md">
        <div>
            <div class="text-sm text-muted">Erstellt</div>
            <div><?= formatDateTime($user['created_at']) ?></div>
        </div>
        <div>
            <div class="text-sm text-muted">Letzter Login</div>
            <div><?= $user['last_login'] ? formatDateTime($user['last_login']) : 'Nie' ?></div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
