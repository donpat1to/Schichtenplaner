<?php
/**
 * Login Page
 */

// Redirect if already logged in
if (isLoggedIn()) {
    redirect('/dashboard');
}

$error = '';
$localLoginEnabled = isLocalLoginEnabled();
$oidcEnabled = isOidcEnabled();
$oidcProviders = $oidcEnabled ? getEnabledProviders() : [];

// Handle local login
if (isPost() && $localLoginEnabled) {
    requireCsrf();

    $username = trim(post('username', ''));
    $password = post('password', '');

    if (empty($username) || empty($password)) {
        $error = 'Bitte Benutzername und Passwort eingeben.';
    } else {
        $user = authenticateUser($username, $password);

        if ($user) {
            loginUser($user, 'local');
            flashSuccess('Willkommen zurueck, ' . h($user['firstname'] ?: $user['username']) . '!');
            redirect('/dashboard');
        } else {
            $error = 'Ungueltige Anmeldedaten.';
        }
    }
}

$pageTitle = 'Anmelden';

// Start output buffering for content
ob_start();
?>

<div class="login-container">
    <h1>Anmelden</h1>

    <?php if ($error): ?>
        <div class="alert alert-error"><?= h($error) ?></div>
    <?php endif; ?>

    <?php if ($oidcEnabled && count($oidcProviders) > 0): ?>
        <div class="oidc-providers">
            <h3>Anmelden mit</h3>
            <?php foreach ($oidcProviders as $provider): ?>
                <a href="/auth/oidc/login?provider=<?= h($provider['slug']) ?>" class="btn btn-oidc btn-lg">
                    <?= h($provider['name']) ?>
                </a>
            <?php endforeach; ?>
        </div>

        <?php if ($localLoginEnabled): ?>
            <div class="divider"><span>oder</span></div>
        <?php endif; ?>
    <?php endif; ?>

    <?php if ($localLoginEnabled): ?>
        <form method="POST" action="/login">
            <?= csrfField() ?>

            <div class="form-group">
                <label for="username">Benutzername</label>
                <input type="text"
                       id="username"
                       name="username"
                       value="<?= h(post('username', '')) ?>"
                       required
                       autofocus
                       autocomplete="username">
            </div>

            <div class="form-group">
                <label for="password">Passwort</label>
                <input type="password"
                       id="password"
                       name="password"
                       required
                       autocomplete="current-password">
            </div>

            <button type="submit" class="btn btn-primary btn-block btn-lg">
                Anmelden
            </button>
        </form>
    <?php elseif (!$oidcEnabled || count($oidcProviders) === 0): ?>
        <div class="alert alert-warning">
            Keine Anmeldemethode verfuegbar. Bitte kontaktieren Sie den Administrator.
        </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
