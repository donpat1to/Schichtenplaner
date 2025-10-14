// frontend/src/services/scheduling/shiftScheduler.ts
import { 
  SchedulingEmployee, 
  SchedulingShift, 
  Assignment, 
  SchedulingResult,
  SchedulingConstraints,
  RepairContext
} from './types';
import { 
  canAssign, 
  candidateScore, 
  onlyNeuAssigned, 
  assignEmployee, 
  hasErfahrener,
  wouldBeAloneIfAdded,
  isManagerShiftWithOnlyNew,
  isManagerAlone,
  hasExperiencedAloneNotAllowed
} from './utils';
import { 
  attemptMoveErfahrenerTo,
  attemptUnassignOrSwap,
  attemptAddErfahrenerToShift,
  attemptFillFromPool,
  resolveTwoExperiencedInShift,
  attemptMoveExperiencedToManagerShift,
  attemptSwapForExperienced,
  resolveOverstaffedExperienced,
  prioritizeWarningsWithPool,
  resolveExperiencedAloneNotAllowed,
  checkAllProblemsResolved
} from './repairFunctions';

// Phase A: Regular employee scheduling (without manager)
function phaseAPlan(
  shifts: SchedulingShift[],
  employees: SchedulingEmployee[],
  constraints: SchedulingConstraints
): { assignments: Assignment; warnings: string[] } {
  const assignments: Assignment = {};
  const warnings: string[] = [];
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  
  // Initialize assignments
  shifts.forEach(shift => {
    assignments[shift.id] = [];
  });

  // Helper function to find best candidate
  function findBestCandidate(candidates: SchedulingEmployee[], shiftId: string): SchedulingEmployee | null {
    if (candidates.length === 0) return null;
    
    return candidates.reduce((best, current) => {
      const bestScore = candidateScore(best, shiftId);
      const currentScore = candidateScore(current, shiftId);
      return currentScore < bestScore ? current : best;
    });
  }

  // 1) Basic coverage: at least 1 person per shift, prefer experienced
  for (const shift of shifts) {
    const candidates = employees.filter(emp => canAssign(emp, shift.id));
    
    if (candidates.length === 0) {
      warnings.push(`No available employees for shift ${shift.id}`);
      continue;
    }

    // Prefer erfahrene candidates
    const erfahrenCandidates = candidates.filter(emp => emp.role === 'erfahren');
    const bestCandidate = findBestCandidate(
      erfahrenCandidates.length > 0 ? erfahrenCandidates : candidates, 
      shift.id
    );

    if (bestCandidate) {
      assignEmployee(bestCandidate, shift.id, assignments);
    }
  }

  // 2) Prevent 'neu alone' if constraint enabled
  if (constraints.enforceNoTraineeAlone) {
    for (const shift of shifts) {
      if (onlyNeuAssigned(assignments[shift.id], employeeMap)) {
        const erfahrenCandidates = employees.filter(emp => 
          emp.role === 'erfahren' && canAssign(emp, shift.id)
        );

        if (erfahrenCandidates.length > 0) {
          const bestCandidate = findBestCandidate(erfahrenCandidates, shift.id);
          if (bestCandidate) {
            assignEmployee(bestCandidate, shift.id, assignments);
          }
        } else {
          // Try repair
          if (!attemptMoveErfahrenerTo(shift.id, assignments, employeeMap, shifts)) {
            warnings.push(`Cannot prevent neu-alone in shift ${shift.id}`);
          }
        }
      }
    }
  }

  // 3) Fill up to target employees per shift
  const targetPerShift = constraints.targetEmployeesPerShift || 2;
  
  for (const shift of shifts) {
    while (assignments[shift.id].length < targetPerShift) {
      const candidates = employees.filter(emp => 
        canAssign(emp, shift.id) && 
        !assignments[shift.id].includes(emp.id) &&
        !wouldBeAloneIfAdded(emp, shift.id, assignments, employeeMap)
      );

      if (candidates.length === 0) break;

      const bestCandidate = findBestCandidate(candidates, shift.id);
      if (bestCandidate) {
        assignEmployee(bestCandidate, shift.id, assignments);
      } else {
        break;
      }
    }
  }

  return { assignments, warnings };
}

// Phase B: Insert manager and ensure "experienced with manager"
function phaseBInsertManager(
  assignments: Assignment,
  manager: SchedulingEmployee | undefined,
  managerShifts: string[],
  employees: SchedulingEmployee[],
  nonManagerShifts: SchedulingShift[],
  constraints: SchedulingConstraints
): { assignments: Assignment; warnings: string[] } {
  const warnings: string[] = [];
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

  if (!manager) return { assignments, warnings };

  console.log(`🎯 Phase B: Processing ${managerShifts.length} manager shifts`);

  for (const shiftId of managerShifts) {
    //const shift = nonManagerShifts.find(s => s.id === shiftId) || { id: shiftId, requiredEmployees: 2 };
    
    // Assign manager to his chosen shifts
    if (!assignments[shiftId].includes(manager.id)) {
      assignments[shiftId].push(manager.id);
      manager.assignedCount++;
      console.log(`✅ Assigned manager to shift ${shiftId}`);
    }

    // Rule: if manager present, MUST have at least one ERFAHRENER
    if (constraints.enforceExperiencedWithChef) {
      const hasExperienced = hasErfahrener(assignments[shiftId], employeeMap);
      
      if (!hasExperienced) {
        console.log(`⚠️ Manager shift ${shiftId} missing experienced employee`);
        
        // Strategy 1: Try to add an experienced employee directly
        const erfahrenCandidates = employees.filter(emp => 
          emp.role === 'erfahren' && 
          canAssign(emp, shiftId) &&
          !assignments[shiftId].includes(emp.id)
        );

        if (erfahrenCandidates.length > 0) {
          // Find best candidate using scoring
          const bestCandidate = erfahrenCandidates.reduce((best, current) => {
            const bestScore = candidateScore(best, shiftId);
            const currentScore = candidateScore(current, shiftId);
            return currentScore < bestScore ? current : best;
          });
          
          assignEmployee(bestCandidate, shiftId, assignments);
          console.log(`✅ Added experienced ${bestCandidate.id} to manager shift ${shiftId}`);
          continue;
        }

        // Strategy 2: Try to swap with another shift
        if (attemptSwapForExperienced(shiftId, assignments, employeeMap, nonManagerShifts)) {
          console.log(`✅ Swapped experienced into manager shift ${shiftId}`);
          continue;
        }

        // Strategy 3: Try to move experienced from overloaded shift
        if (attemptMoveExperiencedToManagerShift(shiftId, assignments, employeeMap, nonManagerShifts)) {
          console.log(`✅ Moved experienced to manager shift ${shiftId}`);
          continue;
        }

        // Final fallback: Check if we can at least add ANY employee (not just experienced)
        const anyCandidates = employees.filter(emp => 
          emp.role !== 'manager' &&
          canAssign(emp, shiftId) &&
          !assignments[shiftId].includes(emp.id) &&
          !wouldBeAloneIfAdded(emp, shiftId, assignments, employeeMap)
        );

        if (anyCandidates.length > 0) {
          const bestCandidate = anyCandidates.reduce((best, current) => {
            const bestScore = candidateScore(best, shiftId);
            const currentScore = candidateScore(current, shiftId);
            return currentScore < bestScore ? current : best;
          });
          
          assignEmployee(bestCandidate, shiftId, assignments);
          warnings.push(`Manager shift ${shiftId} has non-experienced backup: ${bestCandidate.name}`);
          console.log(`⚠️ Added non-experienced backup to manager shift ${shiftId}`);
        } else {
          warnings.push(`Manager alone in shift ${shiftId} - no available employees`);
          console.log(`❌ Cannot fix manager alone in shift ${shiftId}`);
        }
      }
    }
  }

  return { assignments, warnings };
}

// Phase C: Repair and validate
export function enhancedPhaseCRepairValidate(
  assignments: Assignment,
  employees: SchedulingEmployee[],
  shifts: SchedulingShift[],
  managerShifts: string[],
  constraints: SchedulingConstraints
): { assignments: Assignment; violations: string[]; resolutionReport: string[]; allProblemsResolved: boolean } {
  
  const repairContext: RepairContext = {
    lockedShifts: new Set<string>(),
    unassignedPool: [],
    warnings: [],
    violations: []
  };
  
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  const manager = employees.find(emp => emp.role === 'manager');

  console.log('🔄 Starting Enhanced Phase C: Smart Repair & Validation');

  // 1. Manager-Schutzregel
  managerShifts.forEach(shiftId => {
    repairContext.lockedShifts.add(shiftId);
  });

  // 2. Überbesetzte erfahrene Mitarbeiter identifizieren und in Pool verschieben
  resolveOverstaffedExperienced(assignments, employeeMap, shifts, repairContext);

  // 3. Erfahrene Mitarbeiter, die nicht alleine arbeiten dürfen
  resolveExperiencedAloneNotAllowed(assignments, employeeMap, shifts, repairContext);

  // 4. Doppel-Erfahrene-Strafe (nur für Nicht-Manager-Schichten)
  shifts.forEach(shift => {
    if (!managerShifts.includes(shift.id)) {
      resolveTwoExperiencedInShift(shift.id, assignments, employeeMap, repairContext);
    }
  });

  // 5. Priorisierte Zuweisung von Pool-Mitarbeitern zu Schichten mit Warnungen
  prioritizeWarningsWithPool(assignments, employeeMap, shifts, managerShifts, repairContext);

  // 6. Standard-Validation
  shifts.forEach(shift => {
    const assignment = assignments[shift.id] || [];
    
    // Leere Schichten beheben
    if (assignment.length === 0) {
      if (!attemptFillFromPool(shift.id, assignments, employeeMap, repairContext, managerShifts)) {
        repairContext.violations.push({
          type: 'EmptyShift',
          shiftId: shift.id,
          severity: 'error',
          message: `Leere Schicht: ${shift.id}`
        });
      }
    }
    
    // Neu-allein Schichten beheben (nur für Nicht-Manager-Schichten)
    if (constraints.enforceNoTraineeAlone && 
        !managerShifts.includes(shift.id) && 
        onlyNeuAssigned(assignment, employeeMap)) {
      if (!attemptAddErfahrenerToShift(shift.id, assignments, employeeMap, shifts)) {
        repairContext.violations.push({
          type: 'NeuAlone',
          shiftId: shift.id,
          severity: 'error',
          message: `Nur neue Mitarbeiter in Schicht: ${shift.id}`
        });
      }
    }
    
    // Erfahrene-allein Prüfung (erneut nach Reparaturen)
    const experiencedAloneCheck = hasExperiencedAloneNotAllowed(assignment, employeeMap);
    if (experiencedAloneCheck.hasViolation && !repairContext.lockedShifts.has(shift.id)) {
      const emp = employeeMap.get(experiencedAloneCheck.employeeId!);
      repairContext.violations.push({
        type: 'ExperiencedAloneNotAllowed',
        shiftId: shift.id,
        employeeId: experiencedAloneCheck.employeeId,
        severity: 'error',
        message: `Erfahrener Mitarbeiter ${emp?.name || experiencedAloneCheck.employeeId} arbeitet allein, darf aber nicht alleine arbeiten`
      });
    }
  });

  // 7. Vertragsüberschreitungen beheben
  employees.forEach(emp => {
    if (emp.role !== 'manager' && emp.assignedCount > emp.contract) {
      if (!attemptUnassignOrSwap(emp.id, assignments, employeeMap, shifts)) {
        repairContext.violations.push({
          type: 'ContractExceeded',
          employeeId: emp.id,
          severity: 'error',
          message: `Vertragslimit überschritten für: ${emp.name}`
        });
      }
    }
  });

  // 8. Nachbesserung: Manager-Schichten prüfen
  managerShifts.forEach(shiftId => {
    const assignment = assignments[shiftId] || [];
    
    // Manager allein -> KRITISCH (error)
    if (isManagerAlone(assignment, manager?.id)) {
        repairContext.violations.push({
        type: 'ManagerAlone',
        shiftId: shiftId,
        severity: 'error', // KRITISCH
        message: `Manager allein in Schicht ${shiftId}`
        });
    }
    
    // Manager + nur Neue -> NUR WARNUNG (warning)
    if (isManagerShiftWithOnlyNew(assignment, employeeMap, manager?.id)) {
        repairContext.violations.push({
        type: 'ManagerWithOnlyNew',
        shiftId: shiftId,
        severity: 'warning', // NUR WARNUNG
        message: `Manager mit nur Neuen in Schicht ${shiftId}`
        });
    }
    });

  // Erstelle finale Violations-Liste
  const uniqueViolations = repairContext.violations.filter((v, index, self) =>
    index === self.findIndex(t => 
      t.type === v.type && 
      t.shiftId === v.shiftId && 
      t.employeeId === v.employeeId
    )
  );

  const uniqueWarnings = repairContext.warnings.filter((warning, index, array) => 
    array.indexOf(warning) === index
  );

  const finalViolations = [
    // Nur ERROR-Violations als ERROR markieren
    ...uniqueViolations
        .filter(v => v.severity === 'error')
        .map(v => `ERROR: ${v.message}`),
    
    // WARNING-Violations als WARNING markieren  
    ...uniqueViolations
        .filter(v => v.severity === 'warning')
        .map(v => `WARNING: ${v.message}`),
    
    // Andere Warnungen als INFO (Aktionen)
    ...uniqueWarnings.map(w => `INFO: ${w}`)
    ];

  // 9. FINALE ÜBERPRÜFUNG: Prüfe ob alle kritischen Probleme gelöst wurden
  const resolutionCheck = checkAllProblemsResolved(
    assignments, 
    employeeMap, 
    shifts, 
    managerShifts, 
    finalViolations
  );

  const resolutionReport = [
    '=== REPARATUR-BERICHT ===',
    `Aufgelöste Probleme: ${resolutionCheck.resolved.length}`,
    `Verbleibende Probleme: ${resolutionCheck.remaining.length}`,
    `Alle kritischen Probleme behoben: ${resolutionCheck.allResolved ? '✅ JA' : '❌ NEIN'}`,
    '',
    '--- AUFGELÖSTE PROBLEME ---',
    ...(resolutionCheck.resolved.length > 0 ? resolutionCheck.resolved : ['Keine']),
    '',
    '--- VERBLEIBENDE PROBLEME ---',
    ...(resolutionCheck.remaining.length > 0 ? resolutionCheck.remaining : ['Keine']),
    '',
    '=== ENDE BERICHT ==='
  ];

  console.log('📊 Enhanced Phase C completed:', {
    poolSize: repairContext.unassignedPool.length,
    violations: uniqueViolations.length,
    warnings: uniqueWarnings.length,
    allProblemsResolved: resolutionCheck.allResolved
  });

  return {
    assignments,
    violations: finalViolations,
    resolutionReport,
    allProblemsResolved: resolutionCheck.allResolved
  };
}

export function scheduleWithManager(
  shifts: SchedulingShift[],
  employees: SchedulingEmployee[],
  managerShifts: string[],
  constraints: SchedulingConstraints
): SchedulingResult & { resolutionReport?: string[]; allProblemsResolved?: boolean } {
  
  const assignments: Assignment = {};
  //const allViolations: string[] = [];

  // Initialisiere Zuweisungen
  shifts.forEach(shift => {
    assignments[shift.id] = [];
  });

  // Finde Manager
  const manager = employees.find(emp => emp.role === 'manager');
  
  // Filtere Manager und Nicht-Manager-Schichten für Phase A
  const nonManagerEmployees = employees.filter(emp => emp.role !== 'manager');
  const nonManagerShifts = shifts.filter(shift => !managerShifts.includes(shift.id));

  console.log('🔄 Starting Phase A: Regular employee scheduling');
  
  // Phase A: Reguläre Planung
  const phaseAResult = phaseAPlan(nonManagerShifts, nonManagerEmployees, constraints);
  Object.assign(assignments, phaseAResult.assignments);

  console.log('🔄 Starting Phase B: Enhanced Manager insertion');
  
  // Phase B: Erweiterte Manager-Einfügung
  /*const phaseBResult = phaseBInsertManager(
    assignments, 
    manager, 
    managerShifts, 
    employees, 
    nonManagerShifts,
    constraints
  );*/

  console.log('🔄 Starting Enhanced Phase C: Smart Repair & Validation');
  
  // Phase C: Erweiterte Reparatur und Validierung mit Pool-Verwaltung
  const phaseCResult = enhancedPhaseCRepairValidate(assignments, employees, shifts, managerShifts, constraints);
  
  // Verwende Array.filter für uniqueIssues
  const uniqueIssues = phaseCResult.violations.filter((issue, index, array) => 
    array.indexOf(issue) === index
  );

  // Erfolg basiert jetzt auf allProblemsResolved statt nur auf ERRORs
  const success = phaseCResult.allProblemsResolved;

  console.log('📊 Enhanced scheduling with pool management completed:', {
    assignments: Object.keys(assignments).filter(k => assignments[k].length > 0).length,
    totalShifts: shifts.length,
    totalIssues: uniqueIssues.length,
    errors: uniqueIssues.filter(v => v.includes('ERROR:')).length,
    warnings: uniqueIssues.filter(v => v.includes('WARNING:')).length,
    allProblemsResolved: success
  });

  return {
    assignments,
    violations: uniqueIssues,
    success: success,
    resolutionReport: phaseCResult.resolutionReport,
    allProblemsResolved: success
  };
}