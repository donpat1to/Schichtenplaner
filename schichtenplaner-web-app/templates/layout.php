<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= h($pageTitle ?? 'Dashboard') ?> | <?= APP_NAME ?></title>

    <!-- Google Font: IBM Plex Mono -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">

    <!-- Stylesheets -->
    <link rel="stylesheet" href="/assets/css/main.css">
    <link rel="stylesheet" href="/assets/css/print.css" media="print">

    <!-- Alpine.js -->
    <script defer src="/assets/js/alpine.min.js"></script>

    <!-- CSRF Token for AJAX -->
    <meta name="csrf-token" content="<?= csrfToken() ?>">
</head>
<body>
    <div class="app-container">
        <?php include TEMPLATES_PATH . '/header.php'; ?>

        <main class="app-main">
            <?php displayFlashes(); ?>

            <?php if (isset($content)): ?>
                <?= $content ?>
            <?php endif; ?>
        </main>

        <?php include TEMPLATES_PATH . '/footer.php'; ?>
    </div>

    <!-- Custom JavaScript -->
    <script src="/assets/js/app.js"></script>

    <?php if (isset($scripts)): ?>
        <?= $scripts ?>
    <?php endif; ?>
</body>
</html>
