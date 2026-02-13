<?php
/**
 * Shift Plans - List
 */

requireLogin();

$isAdminUser = isAdmin();

// Get all shift plans
$plans = fetchAll(
    "SELECT sp.*, u.firstname, u.lastname,
            (SELECT COUNT(*) FROM shifts WHERE plan_id = sp.id) as shift_count,
            (SELECT COUNT(*) FROM shift_assignments WHERE plan_id = sp.id) as assignment_count
     FROM shift_plans sp
     JOIN users u ON sp.created_by = u.id
     ORDER BY sp.status = 'published' DESC, sp.status = 'draft' DESC, sp.created_at DESC"
);

$pageTitle = 'Schichtplaene';

ob_start();
?>

<div class="page-header">
    <h1>Schichtplaene</h1>
    <?php if ($isAdminUser): ?>
    <div class="page-actions">
        <a href="/shift-plans/create" class="btn btn-primary">Neuer Schichtplan</a>
    </div>
    <?php endif; ?>
</div>

<div class="card">
    <?php if (count($plans) > 0): ?>
    <div class="table-responsive">
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Zeitraum</th>
                    <th>Schichten</th>
                    <th>Zuweisungen</th>
                    <th>Status</th>
                    <th>Erstellt von</th>
                    <th style="width: 200px;">Aktionen</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($plans as $plan): ?>
                <tr>
                    <td>
                        <strong><?= h($plan['name']) ?></strong>
                        <?php if ($plan['description']): ?>
                            <div class="text-sm text-muted"><?= h(truncate($plan['description'], 50)) ?></div>
                        <?php endif; ?>
                    </td>
                    <td>
                        <?php if ($plan['start_date'] && $plan['end_date']): ?>
                            <?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?>
                        <?php else: ?>
                            <span class="text-muted">-</span>
                        <?php endif; ?>
                    </td>
                    <td><?= $plan['shift_count'] ?></td>
                    <td><?= $plan['assignment_count'] ?></td>
                    <td>
                        <span class="badge badge-<?= $plan['status'] ?>"><?= statusLabel($plan['status']) ?></span>
                    </td>
                    <td class="text-sm"><?= h($plan['firstname'] . ' ' . $plan['lastname']) ?></td>
                    <td>
                        <div class="table-actions">
                            <a href="/shift-plans/view?id=<?= h($plan['id']) ?>" class="btn btn-sm">Ansehen</a>
                            <?php if ($plan['status'] === 'draft'): ?>
                                <a href="/preferences/shift?plan=<?= h($plan['id']) ?>" class="btn btn-sm">Praeferenzen</a>
                            <?php endif; ?>
                            <?php if ($isAdminUser): ?>
                                <a href="/shift-plans/edit?id=<?= h($plan['id']) ?>" class="btn btn-sm">Bearbeiten</a>
                            <?php endif; ?>
                        </div>
                    </td>
                </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php else: ?>
    <div class="empty-state">
        <h3>Keine Schichtplaene vorhanden</h3>
        <p>Es wurden noch keine Schichtplaene erstellt.</p>
        <?php if ($isAdminUser): ?>
            <a href="/shift-plans/create" class="btn btn-primary">Ersten Schichtplan erstellen</a>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
