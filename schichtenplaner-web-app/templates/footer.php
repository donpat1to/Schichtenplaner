<footer class="app-footer no-print">
    <div class="flex flex-between flex-center">
        <span>&copy; <?= date('Y') ?> <?= APP_NAME ?></span>
        <span class="text-sm text-muted">
            <?php if (APP_DEBUG): ?>
                PHP <?= phpversion() ?> | <?= APP_ENV ?>
            <?php endif; ?>
        </span>
    </div>
</footer>
