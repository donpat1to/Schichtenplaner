<?php
/**
 * Weekly Solver
 */

requireRole('admin');
require_once INCLUDES_PATH . '/solver.php';

$planId = get('plan');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/weekly-plans');
}

$plan = fetchOne("SELECT * FROM weekly_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Wochenplan nicht gefunden.');
    redirect('/weekly-plans');
}

$result = null;

if (isPost()) {
    requireCsrf();

    $action = post('action');

    if ($action === 'run_solver') {
        $solverInput = prepareWeeklySolverInput($planId);
        $result = runWeeklySolver($solverInput);

        if ($result['success']) {
            setSession('weekly_solver_result_' . $planId, $result);
            flashSuccess('Solver hat eine Loesung gefunden!');
        } else {
            flashError('Solver konnte keine Loesung finden.');
        }
    } elseif ($action === 'apply') {
        $result = session('weekly_solver_result_' . $planId);

        if ($result && processWeeklySolverResults($planId, $result, getCurrentUserId())) {
            unsetSession('weekly_solver_result_' . $planId);
            flashSuccess('Zuweisungen wurden angewendet.');
            redirect('/weekly-plans/view?id=' . $planId);
        } else {
            flashError('Fehler beim Anwenden der Zuweisungen.');
        }
    } elseif ($action === 'clear') {
        delete('weekly_assignments', 'plan_id = ?', [$planId]);
        flashSuccess('Alle Zuweisungen geloescht.');
        redirect('/assignments/weekly-solver?plan=' . $planId);
    }
}

if (!$result) {
    $result = session('weekly_solver_result_' . $planId);
}

$weekCount = fetchOne("SELECT COUNT(*) as c FROM plan_weeks WHERE plan_id = ?", [$planId])['c'];
$prefCount = fetchOne("SELECT COUNT(DISTINCT employee_id) as c FROM weekly_preferences WHERE plan_id = ?", [$planId])['c'];
$assignmentCount = fetchOne("SELECT COUNT(*) as c FROM weekly_assignments WHERE plan_id = ?", [$planId])['c'];

$pageTitle = 'Solver: ' . $plan['name'];

ob_start();
?>

<div class="page-header">
    <h1>Solver: <?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <a href="/assignments/weekly-manual?plan=<?= h($planId) ?>" class="btn">Manuelle Zuweisung</a>
        <a href="/weekly-plans/edit?id=<?= h($planId) ?>" class="btn">Zurueck</a>
    </div>
</div>

<div class="grid grid-3 mb-lg">
    <div class="card text-center">
        <div style="font-size: var(--font-size-h1); font-weight: bold;"><?= $weekCount ?></div>
        <div class="text-muted">Wochen</div>
    </div>
    <div class="card text-center">
        <div style="font-size: var(--font-size-h1); font-weight: bold;"><?= $prefCount ?></div>
        <div class="text-muted">Mitarbeiter mit Praeferenzen</div>
    </div>
    <div class="card text-center">
        <div style="font-size: var(--font-size-h1); font-weight: bold;"><?= $assignmentCount ?></div>
        <div class="text-muted">Aktuelle Zuweisungen</div>
    </div>
</div>

<div class="card mb-lg">
    <div class="card-header">
        <h3 class="card-title">Solver ausfuehren</h3>
    </div>

    <div class="flex gap-md">
        <form method="POST" action="/assignments/weekly-solver?plan=<?= h($planId) ?>">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="run_solver">
            <button type="submit" class="btn btn-primary btn-lg">Solver starten</button>
        </form>

        <?php if ($assignmentCount > 0): ?>
        <form method="POST" action="/assignments/weekly-solver?plan=<?= h($planId) ?>"
              onsubmit="return confirm('Alle bestehenden Zuweisungen loeschen?')">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="clear">
            <button type="submit" class="btn btn-danger">Zuweisungen loeschen</button>
        </form>
        <?php endif; ?>
    </div>
</div>

<?php if ($result): ?>
<div class="card">
    <div class="card-header">
        <h3 class="card-title">
            Solver-Ergebnis:
            <?php if ($result['success']): ?>
                <span class="text-success">Loesung gefunden</span>
            <?php else: ?>
                <span class="text-error">Keine Loesung</span>
            <?php endif; ?>
        </h3>
    </div>

    <?php if ($result['success']): ?>
        <p class="mb-md"><?= count($result['assignments']) ?> Zuweisungen generiert.</p>

        <form method="POST" action="/assignments/weekly-solver?plan=<?= h($planId) ?>">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="apply">
            <button type="submit" class="btn btn-success btn-lg">Zuweisungen anwenden</button>
        </form>
    <?php else: ?>
        <?php if (!empty($result['violations'])): ?>
        <div class="alert alert-error">
            <strong>Probleme:</strong>
            <ul style="margin: var(--spacing-sm) 0 0 var(--spacing-lg);">
                <?php foreach ($result['violations'] as $v): ?>
                    <li><?= h($v) ?></li>
                <?php endforeach; ?>
            </ul>
        </div>
        <?php endif; ?>
    <?php endif; ?>
</div>
<?php endif; ?>

<?php
$content = ob_get_clean();
include TEMPLATES_PATH . '/layout.php';
