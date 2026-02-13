<?php
/**
 * User Management - List Users
 */

requireRole('admin');

// Pagination
$page = max(1, (int) get('page', 1));
$perPage = 20;
$search = get('search', '');

// Build query
$where = "1=1";
$params = [];

if ($search) {
    $where .= " AND (username LIKE ? OR firstname LIKE ? OR lastname LIKE ?)";
    $searchTerm = "%{$search}%";
    $params = [$searchTerm, $searchTerm, $searchTerm];
}

// Get total count
$totalUsers = fetchOne("SELECT COUNT(*) as count FROM users WHERE {$where}", $params)['count'];
$pagination = calculatePagination($totalUsers, $perPage, $page);

// Get users
$users = fetchAll(
    "SELECT id, username, firstname, lastname, employee_type, contract_type,
            is_trainee, is_active, role, last_login, created_at
     FROM users
     WHERE {$where}
     ORDER BY lastname, firstname
     LIMIT {$pagination['limit']} OFFSET {$pagination['offset']}",
    $params
);

$pageTitle = 'Benutzer verwalten';

ob_start();
?>

<div class="page-header">
    <h1>Benutzer verwalten</h1>
    <div class="page-actions">
        <a href="/users/create" class="btn btn-primary">Neuer Benutzer</a>
    </div>
</div>

<!-- Search -->
<div class="card mb-lg">
    <form method="GET" action="/users" class="flex gap-md flex-center">
        <input type="text"
               name="search"
               value="<?= h($search) ?>"
               placeholder="Suchen..."
               style="max-width: 300px;">
        <button type="submit" class="btn">Suchen</button>
        <?php if ($search): ?>
            <a href="/users" class="btn">Zuruecksetzen</a>
        <?php endif; ?>
    </form>
</div>

<!-- Users Table -->
<div class="card">
    <?php if (count($users) > 0): ?>
    <div class="table-responsive">
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Benutzername</th>
                    <th>Typ</th>
                    <th>Vertrag</th>
                    <th>Status</th>
                    <th>Rolle</th>
                    <th>Letzter Login</th>
                    <th style="width: 150px;">Aktionen</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($users as $user): ?>
                <tr>
                    <td>
                        <?= h(fullName($user)) ?>
                        <?php if ($user['is_trainee']): ?>
                            <span class="badge badge-draft">Azubi</span>
                        <?php endif; ?>
                    </td>
                    <td><?= h($user['username']) ?></td>
                    <td><?= employeeTypeLabel($user['employee_type']) ?></td>
                    <td><?= contractTypeLabel($user['contract_type']) ?></td>
                    <td>
                        <?php if ($user['is_active']): ?>
                            <span class="text-success">Aktiv</span>
                        <?php else: ?>
                            <span class="text-muted">Inaktiv</span>
                        <?php endif; ?>
                    </td>
                    <td>
                        <?php if ($user['role'] === 'admin'): ?>
                            <span class="badge badge-published">Admin</span>
                        <?php else: ?>
                            Benutzer
                        <?php endif; ?>
                    </td>
                    <td class="text-sm text-muted">
                        <?= $user['last_login'] ? formatDateTime($user['last_login']) : 'Nie' ?>
                    </td>
                    <td>
                        <div class="table-actions">
                            <a href="/users/edit?id=<?= h($user['id']) ?>" class="btn btn-sm">Bearbeiten</a>
                            <?php if ($user['id'] !== getCurrentUserId()): ?>
                            <form method="POST" action="/users/delete" style="display: inline;"
                                  onsubmit="return confirm('Benutzer wirklich deaktivieren?')">
                                <?= csrfField() ?>
                                <input type="hidden" name="id" value="<?= h($user['id']) ?>">
                                <button type="submit" class="btn btn-sm btn-danger">
                                    <?= $user['is_active'] ? 'Deaktivieren' : 'Loeschen' ?>
                                </button>
                            </form>
                            <?php endif; ?>
                        </div>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>

    <?php
    include TEMPLATES_PATH . '/components/pagination.php';
    renderPagination($pagination['currentPage'], $pagination['totalPages'], '/users', ['search' => $search]);
    ?>

    <?php else: ?>
    <div class="empty-state">
        <h3>Keine Benutzer gefunden</h3>
        <?php if ($search): ?>
            <p>Keine Benutzer entsprechen Ihrer Suche.</p>
            <a href="/users" class="btn">Suche zuruecksetzen</a>
        <?php else: ?>
            <p>Es wurden noch keine Benutzer angelegt.</p>
            <a href="/users/create" class="btn btn-primary">Ersten Benutzer anlegen</a>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
