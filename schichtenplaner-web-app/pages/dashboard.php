<?php
/**
 * Dashboard Page
 */

requireLogin();

$userId = getCurrentUserId();
$user = getCurrentUser();
$isAdminUser = isAdmin();

// Get upcoming shift assignments for current user
$upcomingShifts = fetchAll(
    "SELECT sa.*, s.day_of_week, t.name as time_slot_name, t.start_time, t.end_time,
            sp.name as plan_name, sp.start_date as plan_start
     FROM shift_assignments sa
     JOIN shifts s ON sa.shift_id = s.id
     JOIN time_slots t ON s.time_slot_id = t.id
     JOIN shift_plans sp ON sa.plan_id = sp.id
     WHERE sa.employee_id = ? AND sp.status = 'published'
     ORDER BY sp.start_date, s.day_of_week
     LIMIT 10",
    [$userId]
);

// Get upcoming weekly assignments for current user
$upcomingWeeks = fetchAll(
    "SELECT wa.*, pw.week_number, pw.start_date, pw.end_date, wp.name as plan_name
     FROM weekly_assignments wa
     JOIN plan_weeks pw ON wa.week_id = pw.id
     JOIN weekly_plans wp ON wa.plan_id = wp.id
     WHERE wa.employee_id = ? AND wp.status = 'published'
     ORDER BY pw.start_date
     LIMIT 10",
    [$userId]
);

// Get draft plans needing preference entry
$plansNeedingPrefs = fetchAll(
    "SELECT sp.id, sp.name, 'shift' as type, sp.start_date, sp.end_date
     FROM shift_plans sp
     WHERE sp.status = 'draft'
     AND NOT EXISTS (
         SELECT 1 FROM shift_availabilities sa
         WHERE sa.plan_id = sp.id AND sa.employee_id = ?
     )
     UNION
     SELECT wp.id, wp.name, 'weekly' as type, wp.start_date, wp.end_date
     FROM weekly_plans wp
     WHERE wp.status = 'draft'
     AND NOT EXISTS (
         SELECT 1 FROM weekly_preferences wpr
         WHERE wpr.plan_id = wp.id AND wpr.employee_id = ?
     )
     ORDER BY start_date",
    [$userId, $userId]
);

// Admin: Get plan statistics
if ($isAdminUser) {
    $stats = [
        'users' => fetchOne("SELECT COUNT(*) as count FROM users WHERE is_active = 1")['count'],
        'shiftPlansDraft' => fetchOne("SELECT COUNT(*) as count FROM shift_plans WHERE status = 'draft'")['count'],
        'weeklyPlansDraft' => fetchOne("SELECT COUNT(*) as count FROM weekly_plans WHERE status = 'draft'")['count'],
        'shiftPlansPublished' => fetchOne("SELECT COUNT(*) as count FROM shift_plans WHERE status = 'published'")['count'],
        'weeklyPlansPublished' => fetchOne("SELECT COUNT(*) as count FROM weekly_plans WHERE status = 'published'")['count'],
    ];
}

$pageTitle = 'Dashboard';

ob_start();
?>

<div class="page-header">
    <h1>Willkommen, <?= h($user['firstname'] ?: $user['username']) ?>!</h1>
</div>

<?php if (count($plansNeedingPrefs) > 0): ?>
<div class="alert alert-warning">
    <strong>Praeferenzen erforderlich!</strong>
    Sie haben noch nicht Ihre Praeferenzen fuer <?= count($plansNeedingPrefs) ?> Plan(e) eingegeben.
</div>
<?php endif; ?>

<div class="grid grid-2">
    <!-- Quick Actions -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Schnellzugriff</h3>
        </div>

        <div class="flex flex-col gap-sm">
            <?php if (count($plansNeedingPrefs) > 0): ?>
                <?php foreach ($plansNeedingPrefs as $plan): ?>
                    <a href="/preferences/<?= $plan['type'] ?>?plan=<?= h($plan['id']) ?>" class="btn">
                        Praeferenzen eingeben: <?= h($plan['name']) ?>
                    </a>
                <?php endforeach; ?>
            <?php else: ?>
                <p class="text-muted">Keine ausstehenden Praeferenzeingaben.</p>
            <?php endif; ?>
        </div>
    </div>

    <!-- Plans Overview -->
    <div class="card">
        <div class="card-header">
            <h3 class="card-title">Plaene</h3>
        </div>

        <div class="flex gap-md">
            <a href="/shift-plans" class="btn btn-lg" style="flex: 1;">
                Schichtplaene
            </a>
            <a href="/weekly-plans" class="btn btn-lg" style="flex: 1;">
                Wochenplaene
            </a>
        </div>
    </div>
</div>

<?php if ($isAdminUser): ?>
<!-- Admin Statistics -->
<div class="card mt-lg">
    <div class="card-header">
        <h3 class="card-title">Verwaltung</h3>
    </div>

    <div class="grid grid-4">
        <div class="text-center p-md">
            <div style="font-size: var(--font-size-h1); font-weight: bold; color: var(--color-accent);">
                <?= $stats['users'] ?>
            </div>
            <div class="text-sm text-muted">Aktive Benutzer</div>
        </div>
        <div class="text-center p-md">
            <div style="font-size: var(--font-size-h1); font-weight: bold;">
                <?= $stats['shiftPlansDraft'] ?>
            </div>
            <div class="text-sm text-muted">Schichtplan-Entwuerfe</div>
        </div>
        <div class="text-center p-md">
            <div style="font-size: var(--font-size-h1); font-weight: bold;">
                <?= $stats['weeklyPlansDraft'] ?>
            </div>
            <div class="text-sm text-muted">Wochenplan-Entwuerfe</div>
        </div>
        <div class="text-center p-md">
            <div style="font-size: var(--font-size-h1); font-weight: bold; color: var(--color-success);">
                <?= $stats['shiftPlansPublished'] + $stats['weeklyPlansPublished'] ?>
            </div>
            <div class="text-sm text-muted">Veroeffentlichte Plaene</div>
        </div>
    </div>

    <div class="flex gap-md mt-lg">
        <a href="/users" class="btn">Benutzer verwalten</a>
        <a href="/shift-plans/create" class="btn btn-primary">Neuer Schichtplan</a>
        <a href="/weekly-plans/create" class="btn btn-primary">Neuer Wochenplan</a>
    </div>
</div>
<?php endif; ?>

<!-- Upcoming Shifts -->
<?php if (count($upcomingShifts) > 0): ?>
<div class="card mt-lg">
    <div class="card-header">
        <h3 class="card-title">Meine Schichten</h3>
    </div>

    <table>
        <thead>
            <tr>
                <th>Plan</th>
                <th>Tag</th>
                <th>Zeitfenster</th>
                <th>Zeit</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($upcomingShifts as $shift): ?>
            <tr>
                <td><?= h($shift['plan_name']) ?></td>
                <td><?= dayName($shift['day_of_week']) ?></td>
                <td><?= h($shift['time_slot_name']) ?></td>
                <td><?= formatTime($shift['start_time']) ?> - <?= formatTime($shift['end_time']) ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>

<!-- Upcoming Weeks -->
<?php if (count($upcomingWeeks) > 0): ?>
<div class="card mt-lg">
    <div class="card-header">
        <h3 class="card-title">Meine Wochen</h3>
    </div>

    <table>
        <thead>
            <tr>
                <th>Plan</th>
                <th>Woche</th>
                <th>Zeitraum</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($upcomingWeeks as $week): ?>
            <tr>
                <td><?= h($week['plan_name']) ?></td>
                <td>KW <?= getCalendarWeek($week['start_date']) ?></td>
                <td><?= formatWeekRange($week['start_date'], $week['end_date']) ?></td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>

<?php if (count($upcomingShifts) === 0 && count($upcomingWeeks) === 0): ?>
<div class="card mt-lg">
    <div class="empty-state">
        <h3>Keine anstehenden Zuweisungen</h3>
        <p>Sie haben derzeit keine veroeffentlichten Schicht- oder Wochenzuweisungen.</p>
    </div>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
