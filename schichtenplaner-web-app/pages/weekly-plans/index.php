<?php
/**
 * Weekly Plans - List
 */

requireLogin();

$isAdminUser = isAdmin();

$plans = fetchAll(
    "SELECT wp.*, u.firstname, u.lastname,
            (SELECT COUNT(*) FROM plan_weeks WHERE plan_id = wp.id) as week_count,
            (SELECT COUNT(*) FROM weekly_assignments WHERE plan_id = wp.id) as assignment_count
     FROM weekly_plans wp
     JOIN users u ON wp.created_by = u.id
     ORDER BY wp.status = 'published' DESC, wp.status = 'draft' DESC, wp.start_date DESC"
);

$pageTitle = 'Wochenplaene';

ob_start();
?>

<div class="page-header">
    <h1>Wochenplaene</h1>
    <?php if ($isAdminUser): ?>
    <div class="page-actions">
        <a href="/weekly-plans/create" class="btn btn-primary">Neuer Wochenplan</a>
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
                    <th>Wochen</th>
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
                    <td><?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?></td>
                    <td><?= $plan['week_count'] ?></td>
                    <td><?= $plan['assignment_count'] ?></td>
                    <td>
                        <span class="badge badge-<?= $plan['status'] ?>"><?= statusLabel($plan['status']) ?></span>
                    </td>
                    <td class="text-sm"><?= h($plan['firstname'] . ' ' . $plan['lastname']) ?></td>
                    <td>
                        <div class="table-actions">
                            <a href="/weekly-plans/view?id=<?= h($plan['id']) ?>" class="btn btn-sm">Ansehen</a>
                            <?php if ($plan['status'] === 'draft'): ?>
                                <a href="/preferences/weekly?plan=<?= h($plan['id']) ?>" class="btn btn-sm">Praeferenzen</a>
                            <?php endif; ?>
                            <?php if ($isAdminUser): ?>
                                <a href="/weekly-plans/edit?id=<?= h($plan['id']) ?>" class="btn btn-sm">Bearbeiten</a>
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
        <h3>Keine Wochenplaene vorhanden</h3>
        <p>Es wurden noch keine Wochenplaene erstellt.</p>
        <?php if ($isAdminUser): ?>
            <a href="/weekly-plans/create" class="btn btn-primary">Ersten Wochenplan erstellen</a>
        <?php endif; ?>
    </div>
    <?php endif; ?>
</div>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
