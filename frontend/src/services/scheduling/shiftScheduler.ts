// frontend/src/services/scheduling/shiftScheduler.ts
import { 
  SchedulingEmployee, 
  SchedulingShift, 
  Assignment, 
  SchedulingResult,
  SchedulingConstraints 
} from './types';
import { 
  canAssign, 
  candidateScore, 
  onlyNeuAssigned, 
  assignEmployee, 
  hasErfahrener,
  respectsNewRuleIfAdded 
} from './utils';
import { 
  attemptRepairMoveErfahrener, 
  attemptSwapBringErfahrener,
  attemptComplexRepairForManagerShift 
} from './repairFunctions';

export function scheduleWithManager(
  shifts: SchedulingShift[],
  employees: SchedulingEmployee[],
  managerShifts: string[], // shift IDs where manager should be assigned
  constraints: SchedulingConstraints
): SchedulingResult {
  
  const assignments: Assignment = {};
  const violations: string[] = [];
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
  
  // Initialize assignments
  shifts.forEach(shift => {
    assignments[shift.id] = [];
  });

  // Find manager
  const manager = employees.find(emp => emp.role === 'manager');
  
  // Helper function to find best candidate
  function findBestCandidate(candidates: SchedulingEmployee[], shiftId: string): SchedulingEmployee | null {
    if (candidates.length === 0) return null;
    
    return candidates.reduce((best, current) => {
      const bestScore = candidateScore(best, shiftId);
      const currentScore = candidateScore(current, shiftId);
      
      // Compare arrays lexicographically
      for (let i = 0; i < bestScore.length; i++) {
        if (currentScore[i] < bestScore[i]) return current;
        if (currentScore[i] > bestScore[i]) return best;
      }
      return best;
    });
  }

  // PHASE A: Regular employee scheduling (IGNORE ManagerShifts)
  const nonManagerShifts = shifts.filter(shift => !managerShifts.includes(shift.id));

  // 1) Basic coverage: at least 1 person per shift (prefer erfahrene)
  for (const shift of nonManagerShifts) {
    const candidates = employees.filter(emp => 
      emp.role !== 'manager' && 
      canAssign(emp, shift.id) &&
      respectsNewRuleIfAdded(emp, shift.id, assignments, employeeMap)
    );

    if (candidates.length === 0) {
      violations.push(`No available employees for shift ${shift.id}`);
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

  // 2) Ensure: no neu working alone (Phase A)
  if (constraints.enforceNoTraineeAlone) {
    for (const shift of nonManagerShifts) {
      if (onlyNeuAssigned(assignments[shift.id], employeeMap)) {
        const erfahrenCandidates = employees.filter(emp => 
          emp.role === 'erfahren' && 
          canAssign(emp, shift.id)
        );

        if (erfahrenCandidates.length > 0) {
          const bestCandidate = findBestCandidate(erfahrenCandidates, shift.id);
          if (bestCandidate) {
            assignEmployee(bestCandidate, shift.id, assignments);
          }
        } else {
          // Try repair
          if (!attemptRepairMoveErfahrener(shift.id, assignments, employeeMap, shifts)) {
            violations.push(`Cannot prevent neu-alone in shift ${shift.id}`);
          }
        }
      }
    }
  }

  // 3) Goal: up to required employees per shift
  for (const shift of nonManagerShifts) {
    while (assignments[shift.id].length < shift.requiredEmployees) {
      const candidates = employees.filter(emp => 
        emp.role !== 'manager' && 
        canAssign(emp, shift.id) && 
        !assignments[shift.id].includes(emp.id) &&
        respectsNewRuleIfAdded(emp, shift.id, assignments, employeeMap)
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

  // PHASE B: Manager shifts
  if (manager) {
    for (const shiftId of managerShifts) {
      const shift = shifts.find(s => s.id === shiftId);
      if (!shift) continue;

      // Assign manager to his chosen shifts
      if (!assignments[shiftId].includes(manager.id)) {
        if (manager.availability.get(shiftId) === 3) {
          violations.push(`Manager assigned to shift he marked unavailable: ${shiftId}`);
        }
        assignEmployee(manager, shiftId, assignments);
      }

      // Rule: if manager present, MUST be at least one ERFAHRENER in same shift
      if (!hasErfahrener(assignments[shiftId], employeeMap)) {
        const erfahrenCandidates = employees.filter(emp => 
          emp.role === 'erfahren' && 
          canAssign(emp, shiftId)
        );

        if (erfahrenCandidates.length > 0) {
          const bestCandidate = findBestCandidate(erfahrenCandidates, shiftId);
          if (bestCandidate) {
            assignEmployee(bestCandidate, shiftId, assignments);
            continue;
          }
        }

        // Try repairs
        if (!attemptSwapBringErfahrener(shiftId, assignments, employeeMap, shifts) &&
            !attemptComplexRepairForManagerShift(shiftId, assignments, employeeMap, shifts)) {
          violations.push(`Cannot satisfy manager+erfahren requirement for shift ${shiftId}`);
        }
      }
    }
  }

  // FINAL: Validate constraints
  for (const shift of shifts) {
    if (assignments[shift.id].length === 0) {
      violations.push(`Empty shift after scheduling: ${shift.id}`);
    }
    if (constraints.enforceNoTraineeAlone && onlyNeuAssigned(assignments[shift.id], employeeMap)) {
      violations.push(`Neu alone after full scheduling: ${shift.id}`);
    }
  }

  for (const emp of employees) {
    if (emp.role !== 'manager' && emp.assignedCount > emp.contract) {
      violations.push(`Contract exceeded for employee: ${emp.id}`);
    }
  }

  return {
    assignments,
    violations,
    success: violations.length === 0
  };
}