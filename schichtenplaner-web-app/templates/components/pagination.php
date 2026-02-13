<?php
/**
 * Pagination Component
 *
 * Usage:
 * <?php renderPagination($currentPage, $totalPages, '/users'); ?>
 */

function renderPagination(int $currentPage, int $totalPages, string $baseUrl, array $queryParams = []): void {
    if ($totalPages <= 1) {
        return;
    }

    // Build base query string
    $queryString = http_build_query($queryParams);
    $separator = $queryString ? '&' : '';

    // Calculate page range
    $range = 2; // Pages to show on each side of current
    $startPage = max(1, $currentPage - $range);
    $endPage = min($totalPages, $currentPage + $range);

    ?>
    <nav class="pagination" aria-label="Seitennavigation">
        <div class="pagination-info text-sm text-muted">
            Seite <?= $currentPage ?> von <?= $totalPages ?>
        </div>

        <div class="pagination-links">
            <?php if ($currentPage > 1): ?>
                <a href="<?= h($baseUrl) ?>?<?= $queryString ?><?= $separator ?>page=1" class="btn btn-sm" title="Erste Seite">&laquo;</a>
                <a href="<?= h($baseUrl) ?>?<?= $queryString ?><?= $separator ?>page=<?= $currentPage - 1 ?>" class="btn btn-sm" title="Vorherige Seite">&lsaquo;</a>
            <?php else: ?>
                <span class="btn btn-sm disabled">&laquo;</span>
                <span class="btn btn-sm disabled">&lsaquo;</span>
            <?php endif; ?>

            <?php if ($startPage > 1): ?>
                <span class="pagination-ellipsis">...</span>
            <?php endif; ?>

            <?php for ($i = $startPage; $i <= $endPage; $i++): ?>
                <?php if ($i === $currentPage): ?>
                    <span class="btn btn-sm btn-primary"><?= $i ?></span>
                <?php else: ?>
                    <a href="<?= h($baseUrl) ?>?<?= $queryString ?><?= $separator ?>page=<?= $i ?>" class="btn btn-sm"><?= $i ?></a>
                <?php endif; ?>
            <?php endfor; ?>

            <?php if ($endPage < $totalPages): ?>
                <span class="pagination-ellipsis">...</span>
            <?php endif; ?>

            <?php if ($currentPage < $totalPages): ?>
                <a href="<?= h($baseUrl) ?>?<?= $queryString ?><?= $separator ?>page=<?= $currentPage + 1 ?>" class="btn btn-sm" title="Naechste Seite">&rsaquo;</a>
                <a href="<?= h($baseUrl) ?>?<?= $queryString ?><?= $separator ?>page=<?= $totalPages ?>" class="btn btn-sm" title="Letzte Seite">&raquo;</a>
            <?php else: ?>
                <span class="btn btn-sm disabled">&rsaquo;</span>
                <span class="btn btn-sm disabled">&raquo;</span>
            <?php endif; ?>
        </div>
    </nav>

    <style>
    .pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: var(--spacing-lg);
        flex-wrap: wrap;
        gap: var(--spacing-md);
    }

    .pagination-links {
        display: flex;
        gap: var(--spacing-xs);
    }

    .pagination-ellipsis {
        padding: var(--spacing-sm);
        color: var(--color-text);
    }
    </style>
    <?php
}

/**
 * Calculate pagination values
 *
 * @param int $totalItems Total number of items
 * @param int $perPage Items per page
 * @param int $currentPage Current page number
 * @return array ['offset' => int, 'limit' => int, 'totalPages' => int]
 */
function calculatePagination(int $totalItems, int $perPage = 20, int $currentPage = 1): array {
    $totalPages = max(1, ceil($totalItems / $perPage));
    $currentPage = max(1, min($currentPage, $totalPages));
    $offset = ($currentPage - 1) * $perPage;

    return [
        'offset' => $offset,
        'limit' => $perPage,
        'totalPages' => $totalPages,
        'currentPage' => $currentPage
    ];
}
