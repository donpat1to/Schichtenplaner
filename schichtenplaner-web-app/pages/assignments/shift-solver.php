<?php
/**
 * Shift Solver
 */

requireRole('admin');
require_once INCLUDES_PATH . '/solver.php';

$planId = get('plan');

if (!$planId) {
    flashError('Plan-ID fehlt.');
    redirect('/shift-plans');
}

$plan = fetchOne("SELECT * FROM shift_plans WHERE id = ?", [$planId]);

if (!$plan) {
    flashError('Schichtplan nicht gefunden.');
    redirect('/shift-plans');
}

$result = null;
$solverRan = false;

if (isPost()) {
    requireCsrf();

    $action = post('action');

    if ($action === 'run_solver') {
        $solverInput = prepareShiftSolverInput($planId);
        $result = runShiftSolver($solverInput);
        $solverRan = true;

        if ($result['success']) {
            setSession('solver_result_' . $planId, $result);
            flashSuccess('Solver hat eine Loesung gefunden!');
        } else {
            flashError('Solver konnte keine Loesung finden.');
        }
    } elseif ($action === 'apply') {
        $result = session('solver_result_' . $planId);

        if ($result && processShiftSolverResults($planId, $result, getCurrentUserId())) {
            unsetSession('solver_result_' . $planId);
            flashSuccess('Zuweisungen wurden angewendet.');
            redirect('/shift-plans/view?id=' . $planId);
        } else {
            flashError('Fehler beim Anwenden der Zuweisungen.');
        }
    } elseif ($action === 'clear') {
        delete('shift_assignments', 'plan_id = ?', [$planId]);
        flashSuccess('Alle Zuweisungen geloescht.');
        redirect('/assignments/shift-solver?plan=' . $planId);
    }
}

// Get cached result if exists
if (!$result) {
    $result = session('solver_result_' . $planId);
}

// Get statistics
$shiftCount = fetchOne("SELECT COUNT(*) as c FROM shifts WHERE plan_id = ?", [$planId])['c'];
$prefCount = fetchOne("SELECT COUNT(DISTINCT employee_id) as c FROM shift_availabilities WHERE plan_id = ?", [$planId])['c'];
$assignmentCount = fetchOne("SELECT COUNT(*) as c FROM shift_assignments WHERE plan_id = ?", [$planId])['c'];

$pageTitle = 'Solver: ' . $plan['name'];

ob_start();
?>

<div class="page-header">
    <h1>Solver: <?= h($plan['name']) ?></h1>
    <div class="page-actions">
        <a href="/assignments/shift-manual?plan=<?= h($planId) ?>" class="btn">Manuelle Zuweisung</a>
        <a href="/shift-plans/edit?id=<?= h($planId) ?>" class="btn">Zurueck</a>
    </div>
</div>

<!-- Statistics -->
<div class="grid grid-3 mb-lg">
    <div class="card text-center">
        <div style="font-size: var(--font-size-h1); font-weight: bold;"><?= $shiftCount ?></div>
        <div class="text-muted">Schichten</div>
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

<!-- Solver Actions -->
<div class="card mb-lg">
    <div class="card-header">
        <h3 class="card-title">Solver ausfuehren</h3>
    </div>

    <div class="flex gap-md">
        <form method="POST" action="/assignments/shift-solver?plan=<?= h($planId) ?>">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="run_solver">
            <button type="submit" class="btn btn-primary btn-lg">
                Solver starten
            </button>
        </form>

        <?php if ($assignmentCount > 0): ?>
        <form method="POST" action="/assignments/shift-solver?plan=<?= h($planId) ?>"
              onsubmit="return confirm('Alle bestehenden Zuweisungen loeschen?')">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="clear">
            <button type="submit" class="btn btn-danger">
                Zuweisungen loeschen
            </button>
        </form>
        <?php endif; ?>
    </div>
</div>

<!-- Result -->
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
        <p class="mb-md">
            <?= count($result['assignments']) ?> Zuweisungen generiert.
        </p>

        <?php if (!empty($result['metadata'])): ?>
        <div class="mb-md text-sm text-muted">
            Status: <?= h($result['metadata']['status'] ?? 'N/A') ?>
            <?php if (isset($result['metadata']['objective'])): ?>
                | Zielfunktion: <?= $result['metadata']['objective'] ?>
            <?php endif; ?>
        </div>
        <?php endif; ?>

        <form method="POST" action="/assignments/shift-solver?plan=<?= h($planId) ?>">
            <?= csrfField() ?>
            <input type="hidden" name="action" value="apply">
            <button type="submit" class="btn btn-success btn-lg">
                Zuweisungen anwenden
            </button>
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
