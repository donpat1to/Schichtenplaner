<?php
/**
 * Weekly Preferences Entry
 */

requireLogin();

$planId = get('plan');
$userId = getCurrentUserId();

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/weekly-plans');
}

$plan = fetchOne("SELECT * FROM weekly_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Wochenplan nicht gefunden.');
    redirect('/weekly-plans');
}

// Get weeks
$weeks = fetchAll(
    "SELECT * FROM plan_weeks WHERE plan_id = ? ORDER BY week_number",
    [$planId]
);

// Get existing preferences
$existingPrefs = fetchAll(
    "SELECT week_id, preference_level FROM weekly_preferences WHERE plan_id = ? AND employee_id = ?",
    [$planId, $userId]
);

$preferences = [];
foreach ($existingPrefs as $p) {
    $preferences[$p['week_id']] = (int) $p['preference_level'];
}

// Get work requirement for this user
$requirement = fetchOne(
    "SELECT * FROM work_requirements WHERE plan_id = ? AND employee_id = ?",
    [$planId, $userId]
);

$readonly = $plan['status'] !== 'draft';

$pageTitle = 'Praeferenzen: ' . $plan['name'];

ob_start();
?>

<div class="page-header">
    <h1>Wochen-Praeferenzen</h1>
    <div class="page-actions">
        <a href="/weekly-plans" class="btn">Zurueck</a>
    </div>
</div>

<div class="card mb-lg">
    <h2><?= h($plan['name']) ?></h2>
    <p class="text-muted"><?= formatDate($plan['start_date']) ?> - <?= formatDate($plan['end_date']) ?></p>
    <span class="badge badge-<?= $plan['status'] ?>"><?= statusLabel($plan['status']) ?></span>
</div>

<?php if ($readonly): ?>
<div class="alert alert-warning">
    Dieser Plan ist nicht mehr im Entwurfsstatus. Praeferenzen koennen nicht mehr geaendert werden.
</div>
<?php endif; ?>

<?php if ($requirement): ?>
<div class="card mb-lg">
    <h3>Ihre Anforderungen</h3>
    <p>
        Sie muessen <strong><?= $requirement['required_weeks'] ?> Wochen</strong> arbeiten.
        <?php if ($requirement['assignment_style'] === 'consecutive'): ?>
            (Bevorzugt in Bloecken von <?= $requirement['assignment_style_consecutive'] ?> Wochen)
        <?php elseif ($requirement['assignment_style'] === 'scattered'): ?>
            (Bevorzugt verteilt)
        <?php endif; ?>
    </p>
</div>
<?php endif; ?>

<?php if (count($weeks) > 0): ?>
<?php include TEMPLATES_PATH . '/components/preference-grid.php'; ?>

<div class="card">
    <?php renderWeeklyPreferenceGrid($weeks, $preferences, $planId, $readonly); ?>
</div>
<?php else: ?>
<div class="card">
    <div class="empty-state">
        <h3>Keine Wochen vorhanden</h3>
        <p>Dieser Wochenplan hat noch keine Wochen definiert.</p>
    </div>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
