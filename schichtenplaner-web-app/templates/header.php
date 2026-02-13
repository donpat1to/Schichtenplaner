<header class="app-header">
    <div class="flex flex-between flex-center" style="width: 100%;">
        <div class="flex flex-center gap-lg">
            <a href="/dashboard" class="logo"><?= APP_NAME ?></a>

            <?php if (isLoggedIn()): ?>
            <nav class="flex gap-md">
                <a href="/shift-plans">Schichtplaene</a>
                <a href="/weekly-plans">Wochenplaene</a>
                <?php if (isAdmin()): ?>
                <a href="/users">Benutzer</a>
                <a href="/settings/holidays">Feiertage</a>
                <?php endif; ?>
            </nav>
            <?php endif; ?>
        </div>

        <nav class="flex gap-md flex-center">
            <?php if (isLoggedIn()): ?>
                <span class="text-sm text-muted">
                    <?= h(session('firstname', session('username'))) ?>
                    <?php if (isAdmin()): ?>
                        <span class="badge badge-draft">Admin</span>
                    <?php endif; ?>
                </span>
                <a href="/settings/profile" class="btn btn-sm">Profil</a>
                <a href="/logout" class="btn btn-sm">Abmelden</a>
            <?php else: ?>
                <a href="/login" class="btn btn-sm btn-primary">Anmelden</a>
            <?php endif; ?>
        </nav>
    </div>
</header>
