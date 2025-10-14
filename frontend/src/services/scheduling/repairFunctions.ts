// frontend/src/services/scheduling/repairFunctions.ts
import { SchedulingEmployee, SchedulingShift, Assignment, RepairContext } from './types';
import { canAssign, assignEmployee, unassignEmployee, 
  hasErfahrener, candidateScore, 
  countExperiencedCanWorkAlone, 
  isManagerAlone, isManagerShiftWithOnlyNew, 
  onlyNeuAssigned, canRemove,
  wouldBeAloneIfAdded,
  hasExperiencedAloneNotAllowed
} from './utils';

export function attemptMoveErfahrenerTo(
  targetShiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  for (const shift of allShifts) {
    if (shift.id === targetShiftId) continue;
    
    const currentAssignment = assignments[shift.id] || [];
    
    // Skip if this shift doesn't have multiple employees
    if (currentAssignment.length <= 1) continue;
    
    for (const empId of currentAssignment) {
      const emp = employees.get(empId);
      if (!emp || emp.role !== 'erfahren') continue;
      
      // Check if employee can be moved to target shift
      if (canAssign(emp, targetShiftId)) {
        // Remove from current shift
        unassignEmployee(emp, shift.id, assignments);
        
        // Add to target shift
        assignEmployee(emp, targetShiftId, assignments);
        console.log(`🔧 Repaired: Moved erfahrener ${emp.id} to shift ${targetShiftId}`);
        return true;
      }
    }
  }
  
  return false;
}

export function attemptSwapBringErfahrener(
  targetShiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  const targetAssignment = assignments[targetShiftId] || [];
  
  for (const shift of allShifts) {
    if (shift.id === targetShiftId) continue;
    
    const currentAssignment = assignments[shift.id] || [];
    
    for (const erfahrenerId of currentAssignment) {
      const erfahrener = employees.get(erfahrenerId);
      if (!erfahrener || erfahrener.role !== 'erfahren') continue;
      
      // Check if erfahrener can go to target shift
      if (!canAssign(erfahrener, targetShiftId)) continue;
      
      // Find someone from target shift who can swap
      for (const targetEmpId of targetAssignment) {
        const targetEmp = employees.get(targetEmpId);
        if (!targetEmp) continue;
        
        // Check if target employee can go to the other shift
        if (canAssign(targetEmp, shift.id)) {
          // Check if swap would create new violations
          const tempTargetAssignment = targetAssignment.filter(id => id !== targetEmpId).concat(erfahrenerId);
          const tempCurrentAssignment = currentAssignment.filter(id => id !== erfahrenerId).concat(targetEmpId);
          
          // Perform swap
          assignments[shift.id] = tempCurrentAssignment;
          assignments[targetShiftId] = tempTargetAssignment;
          
          erfahrener.assignedCount++;
          targetEmp.assignedCount--;
          
          console.log(`🔄 Swapped: ${erfahrener.id} <-> ${targetEmp.id}`);
          return true;
        }
      }
    }
  }
  
  return false;
}

export function attemptLocalFixNeuAlone(
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  // Try to move an erfahrener to this shift
  if (attemptMoveErfahrenerTo(shiftId, assignments, employees, allShifts)) {
    return true;
  }
  
  // Try to swap with another shift
  if (attemptSwapBringErfahrener(shiftId, assignments, employees, allShifts)) {
    return true;
  }
  
  return false;
}

export function attemptUnassignOrSwap(
  employeeId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  const employee = employees.get(employeeId);
  if (!employee) return false;
  
  // Find shifts where this employee is assigned
  const assignedShifts = allShifts.filter(shift => 
    assignments[shift.id]?.includes(employeeId)
  );
  
  // Try to remove from shifts where they're least needed
  for (const shift of assignedShifts.sort((a, b) => {
    const aCount = assignments[a.id]?.length || 0;
    const bCount = assignments[b.id]?.length || 0;
    return bCount - aCount; // Remove from shifts with most employees first
  })) {
    // Check if removal would cause new violations
    const wouldBeEmpty = (assignments[shift.id]?.length || 0) <= 1;
    const wouldBeNeuAlone = wouldBeEmpty && employee.role === 'erfahren';
    
    if (!wouldBeEmpty && !wouldBeNeuAlone) {
      unassignEmployee(employee, shift.id, assignments);
      console.log(`📉 Unassigned ${employeeId} from shift ${shift.id} to fix contract`);
      return true;
    }
  }
  
  return false;
}

export function attemptFillFromOverallocated(
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  // Find employees who are underutilized and available for this shift
  const availableEmployees = Array.from(employees.values())
    .filter(emp => 
      canAssign(emp, shiftId) && 
      emp.assignedCount < emp.contract
    )
    .sort((a, b) => candidateScore(a, shiftId) - candidateScore(b, shiftId));
  
  if (availableEmployees.length > 0) {
    const bestCandidate = availableEmployees[0];
    assignEmployee(bestCandidate, shiftId, assignments);
    console.log(`📈 Filled empty shift ${shiftId} with ${bestCandidate.id}`);
    return true;
  }
  
  return false;
}

export function resolveTwoExperiencedInShift(
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  repairContext: RepairContext
): boolean {
  const assignment = assignments[shiftId] || [];
  const experiencedCanWorkAlone = countExperiencedCanWorkAlone(assignment, employees);
  
  if (experiencedCanWorkAlone.length > 1) {
    // Finde den erfahrenen Mitarbeiter mit den meisten Zuweisungen
    const worstCandidate = experiencedCanWorkAlone.reduce((worst, current) => {
      const worstEmp = employees.get(worst);
      const currentEmp = employees.get(current);
      if (!worstEmp || !currentEmp) return worst;
      return currentEmp.assignedCount > worstEmp.assignedCount ? current : worst;
    });
    
    const worstEmp = employees.get(worstCandidate);
    if (worstEmp && canRemove(worstCandidate, shiftId, repairContext.lockedShifts, assignments, employees)) {
      // Entferne den Mitarbeiter mit den meisten Zuweisungen
      unassignEmployee(worstEmp, shiftId, assignments);
      repairContext.unassignedPool.push(worstCandidate);
      
      repairContext.warnings.push(`Zwei erfahrene in Schicht ${shiftId} - aufgelöst`);
      console.log(`🔧 Resolved two experienced in shift ${shiftId}, removed ${worstCandidate}`);
      return true;
    }
  }
  
  return false;
}

export function attemptFillFromPool(
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  repairContext: RepairContext,
  managerShifts?: string[]
): boolean {
  if (assignments[shiftId] && assignments[shiftId].length > 0) return false;
  
  const isManagerShift = managerShifts?.includes(shiftId) || false;
  
  // Durchsuche den Pool nach geeigneten Mitarbeitern
  for (let i = 0; i < repairContext.unassignedPool.length; i++) {
    const empId = repairContext.unassignedPool[i];
    const emp = employees.get(empId);
    
    if (emp && canAssign(emp, shiftId)) {
      // Für Manager-Schichten: bevorzuge erfahrene Mitarbeiter
      if (isManagerShift && emp.role !== 'erfahren') {
        continue;
      }
      
      // Prüfe ob Zuweisung neue Probleme verursachen würde
      if (wouldBeAloneIfAdded(emp, shiftId, assignments, employees)) {
        continue;
      }
      
      assignEmployee(emp, shiftId, assignments);
      repairContext.unassignedPool.splice(i, 1); // Aus Pool entfernen
      
      console.log(`📈 Filled ${isManagerShift ? 'manager ' : ''}shift ${shiftId} from pool with ${empId}`);
      return true;
    }
  }
  
  return false;
}

export function attemptAddErfahrenerToShift(
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  const assignment = assignments[shiftId] || [];
  
  if (!onlyNeuAssigned(assignment, employees)) return false;
  
  // Suche verfügbaren erfahrenen Mitarbeiter
  const erfahrenCandidates = Array.from(employees.values()).filter(emp => 
    emp.role === 'erfahren' && 
    canAssign(emp, shiftId) &&
    !assignment.includes(emp.id)
  );
  
  if (erfahrenCandidates.length > 0) {
    // Wähle den besten Kandidaten basierend auf Score
    const bestCandidate = erfahrenCandidates.reduce((best, current) => {
      const bestScore = candidateScore(best, shiftId);
      const currentScore = candidateScore(current, shiftId);
      return currentScore < bestScore ? current : best;
    });
    
    assignEmployee(bestCandidate, shiftId, assignments);
    console.log(`🎯 Added erfahrener ${bestCandidate.id} to neu-alone shift ${shiftId}`);
    return true;
  }
  
  return false;
}

export function checkManagerShiftRules(
  shiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  managerId: string | undefined,
  repairContext: RepairContext
): void {
  const assignment = assignments[shiftId] || [];
  
  if (!managerId) return;
  
  // Manager allein in Schicht
  if (isManagerAlone(assignment, managerId)) {
    repairContext.warnings.push(`Manager allein in Schicht ${shiftId}`);
    repairContext.violations.push({
      type: 'ManagerAlone',
      shiftId,
      severity: 'warning',
      message: `Manager arbeitet allein in Schicht ${shiftId}`
    });
  }
  
  // Manager + nur Neue ohne Erfahrene
  if (isManagerShiftWithOnlyNew(assignment, employees, managerId)) {
    repairContext.warnings.push(`Manager + Neue(r) ohne Erfahrene in Schicht ${shiftId}`);
    repairContext.violations.push({
      type: 'ManagerWithOnlyNew',
      shiftId,
      severity: 'warning',
      message: `Manager arbeitet nur mit Neuen in Schicht ${shiftId}`
    });
  }
}

export function attemptSwapForExperienced(
  managerShiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  const managerAssignment = assignments[managerShiftId] || [];
  const manager = managerAssignment.find(empId => employees.get(empId)?.role === 'manager');
  if (!manager) return false;

  // Look for shifts with experienced employees that could swap
  for (const otherShift of allShifts) {
    if (otherShift.id === managerShiftId) continue;
    
    const otherAssignment = assignments[otherShift.id] || [];
    const experiencedInOther = otherAssignment.filter(empId => {
      const emp = employees.get(empId);
      return emp?.role === 'erfahren';
    });

    for (const experiencedId of experiencedInOther) {
      const experiencedEmp = employees.get(experiencedId);
      if (!experiencedEmp) continue;

      // Check if experienced can work in manager shift
      if (!canAssign(experiencedEmp, managerShiftId)) continue;

      // Find someone from manager shift (non-manager) who can swap to other shift
      const nonManagerInManagerShift = managerAssignment.filter(id => id !== manager);
      
      for (const swapCandidateId of nonManagerInManagerShift) {
        const swapCandidate = employees.get(swapCandidateId);
        if (!swapCandidate) continue;

        // Check if swap candidate can work in other shift
        if (canAssign(swapCandidate, otherShift.id)) {
          // Perform the swap
          assignments[managerShiftId] = managerAssignment.filter(id => id !== swapCandidateId).concat(experiencedId);
          assignments[otherShift.id] = otherAssignment.filter(id => id !== experiencedId).concat(swapCandidateId);
          
          experiencedEmp.assignedCount++;
          swapCandidate.assignedCount--;
          
          console.log(`🔄 Swapped ${experiencedId} into manager shift for ${swapCandidateId}`);
          return true;
        }
      }

      // If no swap candidate, try just moving the experienced if other shift won't be empty
      if (otherAssignment.length > 1) {
        assignments[managerShiftId].push(experiencedId);
        assignments[otherShift.id] = otherAssignment.filter(id => id !== experiencedId);
        
        experiencedEmp.assignedCount++;
        console.log(`➡️ Moved ${experiencedId} to manager shift from ${otherShift.id}`);
        return true;
      }
    }
  }

  return false;
}

// New function to move experienced to manager shift
export function attemptMoveExperiencedToManagerShift(
  managerShiftId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[]
): boolean {
  // Find shifts with multiple experienced employees
  for (const otherShift of allShifts) {
    if (otherShift.id === managerShiftId) continue;
    
    const otherAssignment = assignments[otherShift.id] || [];
    const experiencedEmployees = otherAssignment.filter(empId => {
      const emp = employees.get(empId);
      return emp?.role === 'erfahren';
    });

    // If this shift has multiple experienced, we can move one
    if (experiencedEmployees.length > 1) {
      for (const experiencedId of experiencedEmployees) {
        const experiencedEmp = employees.get(experiencedId);
        if (!experiencedEmp) continue;

        if (canAssign(experiencedEmp, managerShiftId)) {
          // Move the experienced employee
          assignments[managerShiftId].push(experiencedId);
          assignments[otherShift.id] = otherAssignment.filter(id => id !== experiencedId);
          
          experiencedEmp.assignedCount++;
          console.log(`🎯 Moved experienced ${experiencedId} from overloaded shift to manager shift`);
          return true;
        }
      }
    }
  }

  return false;
}

export function resolveOverstaffedExperienced(
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  shifts: SchedulingShift[],
  repairContext: RepairContext
): void {
  const experiencedShifts: { shiftId: string, experiencedCount: number, canWorkAloneCount: number }[] = [];
  
  // Analysiere alle Schichten auf erfahrene Mitarbeiter
  shifts.forEach(shift => {
    const assignment = assignments[shift.id] || [];
    const experiencedEmployees = assignment.filter(empId => {
      const emp = employees.get(empId);
      return emp?.role === 'erfahren';
    });
    
    const canWorkAloneCount = experiencedEmployees.filter(empId => {
      const emp = employees.get(empId);
      return emp?.originalData?.canWorkAlone;
    }).length;
    
    if (experiencedEmployees.length > 0) {
      experiencedShifts.push({
        shiftId: shift.id,
        experiencedCount: experiencedEmployees.length,
        canWorkAloneCount
      });
    }
  });
  
  // Sortiere Schichten nach Anzahl der erfahrenen Mitarbeiter (absteigend)
  experiencedShifts.sort((a, b) => b.experiencedCount - a.experiencedCount);
  
  // Behebe Schichten mit mehr als 1 erfahrenem Mitarbeiter
  experiencedShifts.forEach(shiftInfo => {
    if (shiftInfo.experiencedCount > 1 && !repairContext.lockedShifts.has(shiftInfo.shiftId)) {
      const assignment = assignments[shiftInfo.shiftId] || [];
      const experiencedInShift = assignment.filter(empId => {
        const emp = employees.get(empId);
        return emp?.role === 'erfahren';
      });
      
      // Entferne überschüssige erfahrene Mitarbeiter (behalte mindestens 1)
      const excessCount = shiftInfo.experiencedCount - 1;
      const toRemove = experiencedInShift.slice(0, excessCount);
      
      toRemove.forEach(empId => {
        const emp = employees.get(empId);
        if (emp && canRemove(empId, shiftInfo.shiftId, repairContext.lockedShifts, assignments, employees)) {
          unassignEmployee(emp, shiftInfo.shiftId, assignments);
          repairContext.unassignedPool.push(empId);
          
          repairContext.warnings.push(`Überzählige erfahrene in Schicht ${shiftInfo.shiftId} entfernt: ${emp.name}`);
          console.log(`📉 Removed excess experienced ${empId} from shift ${shiftInfo.shiftId}`);
        }
      });
    }
  });
}

// Neue Funktion: Behebe erfahrene Mitarbeiter, die nicht alleine arbeiten dürfen
export function resolveExperiencedAloneNotAllowed(
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  shifts: SchedulingShift[],
  repairContext: RepairContext
): void {
  shifts.forEach(shift => {
    if (repairContext.lockedShifts.has(shift.id)) return;
    
    const assignment = assignments[shift.id] || [];
    const violation = hasExperiencedAloneNotAllowed(assignment, employees);
    
    if (violation.hasViolation) {
      console.log(`⚠️ Experienced alone not allowed in shift ${shift.id}, employee: ${violation.employeeId}`);
      
      // Versuche einen weiteren Mitarbeiter hinzuzufügen
      const availableEmployees = Array.from(employees.values()).filter(emp => 
        emp.id !== violation.employeeId &&
        canAssign(emp, shift.id) &&
        !assignment.includes(emp.id) &&
        !wouldBeAloneIfAdded(emp, shift.id, assignments, employees)
      );
      
      if (availableEmployees.length > 0) {
        // Wähle den besten Kandidaten
        const bestCandidate = availableEmployees.reduce((best, current) => {
          const bestScore = candidateScore(best, shift.id);
          const currentScore = candidateScore(current, shift.id);
          return currentScore < bestScore ? current : best;
        });
        
        assignEmployee(bestCandidate, shift.id, assignments);
        repairContext.warnings.push(`Zusätzlicher Mitarbeiter zu Schicht ${shift.id} hinzugefügt, um erfahrenen nicht allein zu lassen`);
        console.log(`✅ Added ${bestCandidate.id} to shift ${shift.id} to prevent experienced alone`);
        return;
      }
      
      // Wenn Hinzufügen nicht möglich, versuche zu tauschen
      if (attemptSwapForExperiencedAlone(shift.id, violation.employeeId!, assignments, employees, shifts, repairContext)) {
        return;
      }
      
      // Wenn nichts funktioniert, füge Verletzung hinzu
      const emp = employees.get(violation.employeeId!);
      repairContext.violations.push({
        type: 'ExperiencedAloneNotAllowed',
        shiftId: shift.id,
        employeeId: violation.employeeId,
        severity: 'error',
        message: `Erfahrener Mitarbeiter ${emp?.name || violation.employeeId} arbeitet allein, darf aber nicht alleine arbeiten`
      });
    }
  });
}

// Neue Funktion: Tausche für experienced-alone Problem
export function attemptSwapForExperiencedAlone(
  shiftId: string,
  experiencedEmpId: string,
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  allShifts: SchedulingShift[],
  repairContext: RepairContext
): boolean {
  const experiencedEmp = employees.get(experiencedEmpId);
  if (!experiencedEmp) return false;
  
  // Suche nach Schichten mit mehreren Mitarbeitern, wo wir tauschen können
  for (const otherShift of allShifts) {
    if (otherShift.id === shiftId || repairContext.lockedShifts.has(otherShift.id)) continue;
    
    const otherAssignment = assignments[otherShift.id] || [];
    
    // Suche nach einem Mitarbeiter, der alleine arbeiten darf
    for (const otherEmpId of otherAssignment) {
      const otherEmp = employees.get(otherEmpId);
      if (!otherEmp) continue;
      
      // Prüfe ob dieser Mitarbeiter alleine arbeiten darf oder erfahren ist
      const canWorkAlone = otherEmp.role === 'manager' || 
                          (otherEmp.role === 'erfahren' && otherEmp.originalData?.canWorkAlone) ||
                          otherEmp.role === 'neu';
      
      if (canWorkAlone) {
        // Prüfe ob Tausch möglich ist
        if (canAssign(experiencedEmp, otherShift.id) && canAssign(otherEmp, shiftId)) {
          // Prüfe ob Tausch neue Probleme verursachen würde
          const wouldCauseProblemsInTarget = wouldBeAloneIfAdded(experiencedEmp, otherShift.id, assignments, employees);
          const wouldCauseProblemsInSource = wouldBeAloneIfAdded(otherEmp, shiftId, assignments, employees);
          
          if (!wouldCauseProblemsInTarget && !wouldCauseProblemsInSource) {
            // Führe Tausch durch
            assignments[shiftId] = [otherEmpId];
            assignments[otherShift.id] = otherAssignment.filter(id => id !== otherEmpId).concat(experiencedEmpId);
            
            experiencedEmp.assignedCount++;
            otherEmp.assignedCount--;
            
            console.log(`🔄 Swapped ${experiencedEmpId} with ${otherEmpId} to resolve experienced-alone`);
            repairContext.warnings.push(`Getauscht: ${experiencedEmp.name} mit ${otherEmp.name} um allein-Arbeiten zu vermeiden`);
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Erweiterte prioritizeWarningsWithPool Funktion
export function prioritizeWarningsWithPool(
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  shifts: SchedulingShift[],
  managerShifts: string[],
  repairContext: RepairContext
): void {
  if (repairContext.unassignedPool.length === 0) return;
  
  // Identifiziere Schichten mit Warnungen (priorisierte Reihenfolge)
  const warningShifts: { shiftId: string, priority: number, reason: string }[] = [];
  
  shifts.forEach(shift => {
    const assignment = assignments[shift.id] || [];
    const manager = Array.from(employees.values()).find(emp => emp.role === 'manager');
    
    // 1. Höchste Priorität: Experienced alone not allowed
    const experiencedAloneCheck = hasExperiencedAloneNotAllowed(assignment, employees);
    if (experiencedAloneCheck.hasViolation) {
      warningShifts.push({
        shiftId: shift.id,
        priority: 1,
        reason: 'Erfahrener arbeitet allein (nicht erlaubt)'
      });
    }
    // 2. Hohe Priorität: Manager allein
    else if (managerShifts.includes(shift.id) && isManagerAlone(assignment, manager?.id)) {
      warningShifts.push({
        shiftId: shift.id,
        priority: 2,
        reason: 'Manager allein'
      });
    }
    // 3. Hohe Priorität: Manager + nur Neue
    else if (managerShifts.includes(shift.id) && isManagerShiftWithOnlyNew(assignment, employees, manager?.id)) {
      warningShifts.push({
        shiftId: shift.id,
        priority: 3,
        reason: 'Manager mit nur Neuen'
      });
    }
    // 4. Mittlere Priorität: Nur Neue (nicht-Manager Schichten)
    else if (!managerShifts.includes(shift.id) && onlyNeuAssigned(assignment, employees)) {
      warningShifts.push({
        shiftId: shift.id,
        priority: 4,
        reason: 'Nur Neue in Schicht'
      });
    }
    // 5. Niedrige Priorität: Unterbesetzte Schichten
    else {
      const shiftObj = shifts.find(s => s.id === shift.id);
      if (shiftObj && assignment.length < shiftObj.requiredEmployees) {
        warningShifts.push({
          shiftId: shift.id,
          priority: 5,
          reason: 'Unterbesetzt'
        });
      }
    }
  });
  
  // Sortiere nach Priorität
  warningShifts.sort((a, b) => a.priority - b.priority);
  
  console.log(`🎯 Found ${warningShifts.length} warning shifts to prioritize`);
  
  // Weise Pool-Mitarbeiter priorisiert zu
  warningShifts.forEach(warningShift => {
    if (repairContext.unassignedPool.length === 0) return;
    
    const shiftId = warningShift.shiftId;
    const assignment = assignments[shiftId] || [];
    const isManagerShift = managerShifts.includes(shiftId);
    const isExperiencedAlone = warningShift.priority === 1;
    
    // Für Manager-Schichten und experienced-alone: bevorzuge erfahrene Mitarbeiter
    let candidates = [...repairContext.unassignedPool];
    
    if (isManagerShift || isExperiencedAlone) {
      candidates = candidates.filter(empId => {
        const emp = employees.get(empId);
        return emp?.role === 'erfahren';
      });
    }
    
    // Finde den besten Kandidaten für diese Schicht
    const bestCandidate = candidates.reduce((best: string | null, current) => {
      if (!best) return current;
      
      const bestEmp = employees.get(best);
      const currentEmp = employees.get(current);
      
      if (!bestEmp || !currentEmp) return best;
      
      const bestScore = candidateScore(bestEmp, shiftId);
      const currentScore = candidateScore(currentEmp, shiftId);
      
      return currentScore < bestScore ? current : best;
    }, null);
    
    if (bestCandidate) {
      const emp = employees.get(bestCandidate);
      if (emp && canAssign(emp, shiftId)) {
        // Prüfe ob Zuweisung neue Probleme verursachen würde
        const wouldCauseProblems = wouldBeAloneIfAdded(emp, shiftId, assignments, employees);
        
        if (!wouldCauseProblems) {
          assignEmployee(emp, shiftId, assignments);
          
          // Entferne aus Pool
          const poolIndex = repairContext.unassignedPool.indexOf(bestCandidate);
          if (poolIndex > -1) {
            repairContext.unassignedPool.splice(poolIndex, 1);
          }
          
          console.log(`🎯 Assigned ${bestCandidate} from pool to ${warningShift.reason} shift ${shiftId}`);
          repairContext.warnings.push(`Pool-Mitarbeiter ${emp.name} zugewiesen zu ${warningShift.reason} Schicht`);
        }
      }
    }
  });
}

export function checkResolvedWarnings(
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  shifts: SchedulingShift[],
  managerShifts: string[],
  initialWarnings: string[]
): { resolved: string[]; remaining: string[] } {
  const resolved: string[] = [];
  const remaining: string[] = [];
  const manager = Array.from(employees.values()).find(emp => emp.role === 'manager');

  // Prüfe jede anfängliche Warnung
  initialWarnings.forEach(warning => {
    let isResolved = true;

    // Extrahiere die Shift-ID aus der Warnung
    const shiftIdMatch = warning.match(/Schicht\s+([a-f0-9-]+)/);
    if (shiftIdMatch) {
      const shiftId = shiftIdMatch[1];
      const assignment = assignments[shiftId] || [];
      
      // Prüfe basierend auf Warnungstyp
      if (warning.includes('Manager allein')) {
        isResolved = !isManagerAlone(assignment, manager?.id);
      } else if (warning.includes('Manager mit nur Neuen')) {
        isResolved = !isManagerShiftWithOnlyNew(assignment, employees, manager?.id);
      } else if (warning.includes('Zwei erfahrene in Schicht')) {
        const experiencedCanWorkAlone = countExperiencedCanWorkAlone(assignment, employees);
        isResolved = experiencedCanWorkAlone.length <= 1;
      } else if (warning.includes('Überzählige erfahrene')) {
        // Diese Warnung zeigt eine durchgeführte Aktion an, nicht ein bestehendes Problem
        isResolved = true;
      } else if (warning.includes('Erfahrener arbeitet allein')) {
        const violation = hasExperiencedAloneNotAllowed(assignment, employees);
        isResolved = !violation.hasViolation;
      }
    } else {
      // Für Warnungen ohne spezifische Shift-ID
      isResolved = !warning.includes('nicht repariert');
    }

    if (isResolved) {
      resolved.push(`✅ BEHOBEN: ${warning}`);
    } else {
      remaining.push(`❌ VERBLEIBEND: ${warning}`);
    }
  });

  return { resolved, remaining };
}

// Erweiterte Funktion zur Überprüfung aller Probleme
export function checkAllProblemsResolved(
  assignments: Assignment,
  employees: Map<string, SchedulingEmployee>,
  shifts: SchedulingShift[],
  managerShifts: string[],
  finalViolations: string[]
): { resolved: string[]; remaining: string[]; allResolved: boolean } {
  const resolved: string[] = [];
  const remaining: string[] = [];
  const manager = Array.from(employees.values()).find(emp => emp.role === 'manager');

  // Prüfe jede finale Violation
  finalViolations.forEach(violation => {
    // IGNORIERE Aktionen - das sind keine Probleme
    if (violation.includes('Pool-Mitarbeiter') && violation.includes('zugewiesen')) {
      resolved.push(`✅ AKTION: ${violation.replace('WARNING: ', '')}`);
      return; // Überspringe diese Meldung
    }
    
    if (violation.startsWith('ERROR:')) {
      // ... bestehende ERROR-Logik ...
    } else if (violation.startsWith('WARNING:')) {
      const warningText = violation.replace('WARNING: ', '');
      const shiftIdMatch = warningText.match(/Schicht\s+([a-f0-9-]+)/);
      
      if (shiftIdMatch) {
        const shiftId = shiftIdMatch[1];
        const assignment = assignments[shiftId] || [];
        let isResolved = false;

        // Prüfe basierend auf Warnungstyp
        if (warningText.includes('Manager allein')) {
          isResolved = !isManagerAlone(assignment, manager?.id);
        } else if (warningText.includes('Manager mit nur Neuen')) {
          isResolved = !isManagerShiftWithOnlyNew(assignment, employees, manager?.id);
        } else if (warningText.includes('Zwei erfahrene in Schicht')) {
          const experiencedCanWorkAlone = countExperiencedCanWorkAlone(assignment, employees);
          isResolved = experiencedCanWorkAlone.length <= 1;
        } else if (warningText.includes('Erfahrener arbeitet allein')) {
          const violationCheck = hasExperiencedAloneNotAllowed(assignment, employees);
          isResolved = !violationCheck.hasViolation;
        } else {
          // Für allgemeine Warnungen
          isResolved = true;
        }

        if (isResolved) {
          resolved.push(`✅ BEHOBEN: ${warningText}`);
        } else {
          remaining.push(`⚠️ WARNHINWEIS: ${warningText}`);
        }
      } else {
        // Für Warnungen ohne Shift-ID
        remaining.push(`⚠️ WARNHINWEIS: ${warningText}`);
      }
    }
  });

  // Zusätzliche Prüfung auf KRITISCHE Probleme (die ein Publizieren verhindern)
  const criticalProblems: string[] = [];
  
  shifts.forEach(shift => {
    const assignment = assignments[shift.id] || [];
    
    // KRITISCH: Manager allein
    if (managerShifts.includes(shift.id) && isManagerAlone(assignment, manager?.id)) {
      criticalProblems.push(`Manager allein in Schicht ${shift.id}`);
    }
    
    // KRITISCH: Erfahrene allein (nicht erlaubt)
    const experiencedAloneCheck = hasExperiencedAloneNotAllowed(assignment, employees);
    if (experiencedAloneCheck.hasViolation) {
      const emp = employees.get(experiencedAloneCheck.employeeId!);
      criticalProblems.push(`Erfahrener ${emp?.name} arbeitet allein in Schicht ${shift.id}`);
    }
    
    // KRITISCH: Leere Schichten
    if (assignment.length === 0) {
      criticalProblems.push(`Leere Schicht ${shift.id}`);
    }
    
    // KRITISCH: Nur Neue in normalen Schichten
    if (!managerShifts.includes(shift.id) && onlyNeuAssigned(assignment, employees)) {
      criticalProblems.push(`Nur Neue in Schicht ${shift.id}`);
    }
    
    // KRITISCH: Vertragsüberschreitungen
    employees.forEach(emp => {
      if (emp.role !== 'manager' && emp.assignedCount > emp.contract) {
        criticalProblems.push(`Vertragslimit überschritten für ${emp.name}`);
      }
    });
    
    // NICHT KRITISCH: Manager mit nur Neuen (nur Warnung)
    // -> wird nicht in criticalProblems aufgenommen
  });

  // Füge kritische Probleme zu remaining hinzu
  criticalProblems.forEach(problem => {
    if (!remaining.some(r => r.includes(problem))) {
      remaining.push(`❌ KRITISCH: ${problem}`);
    }
  });

  const allResolved = criticalProblems.length === 0;

  return { resolved, remaining, allResolved };
}