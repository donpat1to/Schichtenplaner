<?php
/**
 * User Profile Settings
 */

requireLogin();

$userId = getCurrentUserId();
$user = getCurrentUser();

$errors = [];
$success = false;

if (isPost()) {
    requireCsrf();

    $action = post('action', 'update_profile');

    if ($action === 'update_profile') {
        $firstname = trim(post('firstname', ''));
        $lastname = trim(post('lastname', ''));

        if (empty($firstname)) {
            $errors[] = 'Vorname ist erforderlich.';
        }
        if (empty($lastname)) {
            $errors[] = 'Nachname ist erforderlich.';
        }

        if (empty($errors)) {
            update('users', [
                'firstname' => $firstname,
                'lastname' => $lastname,
            ], 'id = ?', [$userId]);

            // Update session
            setSession('firstname', $firstname);
            setSession('lastname', $lastname);

            flashSuccess('Profil aktualisiert.');
            redirect('/settings/profile');
        }

    } elseif ($action === 'change_password') {
        $currentPassword = post('current_password', '');
        $newPassword = post('new_password', '');
        $confirmPassword = post('confirm_password', '');

        if (empty($currentPassword)) {
            $errors[] = 'Aktuelles Passwort ist erforderlich.';
        } elseif (!password_verify($currentPassword, $user['password_hash'])) {
            $errors[] = 'Aktuelles Passwort ist falsch.';
        }

        $passwordErrors = validatePassword($newPassword);
        $errors = array_merge($errors, $passwordErrors);

        if ($newPassword !== $confirmPassword) {
            $errors[] = 'Passwoerter stimmen nicht ueberein.';
        }

        if (empty($errors)) {
            update('users', [
                'password_hash' => hashPassword($newPassword),
            ], 'id = ?', [$userId]);

            flashSuccess('Passwort geaendert.');
            redirect('/settings/profile');
        }
    }
}

$pageTitle = 'Profil';

ob_start();
?>

<div class="page-header">
    <h1>Mein Profil</h1>
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
    <!-- Profile Information -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Profilinformationen</h3>
        </div>

        <form method="POST" action="/settings/profile">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="update_profile">

            <div class="form-group">
                <label>Benutzername</label>
                <input type="text" value="<?= h($user['username']) ?>" disabled>
                <div class="form-hint">Der Benutzername kann nicht geaendert werden.</div>
            </div>

            <div class="form-group">
                <label for="firstname">Vorname *</label>
                <input type="text" id="firstname" name="firstname" value="<?= h($user['firstname']) ?>" required>
            </div>

            <div class="form-group">
                <label for="lastname">Nachname *</label>
                <input type="text" id="lastname" name="lastname" value="<?= h($user['lastname']) ?>" required>
            </div>

            <button type="submit" class="btn btn-primary">Speichern</button>
        </form>
    </div>

    <!-- Change Password -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Passwort aendern</h3>
        </div>

        <?php if (session('auth_method') === 'oidc'): ?>
        <div class="alert alert-info">
            Sie sind ueber SSO angemeldet. Das Passwort wird ueber Ihren Identity Provider verwaltet.
        </div>
        <?php else: ?>
        <form method="POST" action="/settings/profile">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="change_password">

            <div class="form-group">
                <label for="current_password">Aktuelles Passwort *</label>
                <input type="password" id="current_password" name="current_password" required autocomplete="current-password">
            </div>

            <div class="form-group">
                <label for="new_password">Neues Passwort *</label>
                <input type="password" id="new_password" name="new_password" required minlength="8" autocomplete="new-password">
                <div class="form-hint">Mindestens 8 Zeichen</div>
            </div>

            <div class="form-group">
                <label for="confirm_password">Passwort bestaetigen *</label>
                <input type="password" id="confirm_password" name="confirm_password" required autocomplete="new-password">
            </div>

            <button type="submit" class="btn btn-primary">Passwort aendern</button>
        </form>
        <?php endif; ?>
    </div>
</div>

<!-- Account Information -->
<div class="card mt-lg">
    <div class="card-header">
        <h3 class="card-title">Kontoinformationen</h3>
    </div>

    <div class="grid grid-3">
        <div>
            <div class="text-sm text-muted">Mitarbeitertyp</div>
            <div><?= employeeTypeLabel($user['employee_type']) ?></div>
        </div>
        <div>
            <div class="text-sm text-muted">Vertragstyp</div>
            <div><?= contractTypeLabel($user['contract_type']) ?></div>
        </div>
        <div>
            <div class="text-sm text-muted">Rolle</div>
            <div><?= $user['role'] === 'admin' ? 'Administrator' : 'Benutzer' ?></div>
        </div>
        <div>
            <div class="text-sm text-muted">Konto erstellt</div>
            <div><?= formatDateTime($user['created_at']) ?></div>
        </div>
        <div>
            <div class="text-sm text-muted">Letzter Login</div>
            <div><?= $user['last_login'] ? formatDateTime($user['last_login']) : 'Nie' ?></div>
        </div>
        <div>
            <div class="text-sm text-muted">Anmeldemethode</div>
            <div><?= session('auth_method') === 'oidc' ? 'SSO' : 'Lokal' ?></div>
        </div>
    </div>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
