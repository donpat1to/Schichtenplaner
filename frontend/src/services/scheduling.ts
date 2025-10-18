import { Employee, EmployeeAvailability } from '../models/Employee';
import { ScheduledShift, ShiftPlan } from '../models/ShiftPlan';
import { shiftAssignmentService } from './shiftAssignmentService'; 

// Enhanced scheduling algorithm with EXACT contract limit enforcement
export class IntelligentShiftScheduler {
  private static CRITICAL_VIOLATIONS = {
    TRAINEE_ALONE: '❌ KRITISCH: Trainee arbeitet alleine',
    EMPTY_SHIFT: '❌ KRITISCH: Schicht ohne Mitarbeiter',
    CONTRACT_LIMIT_VIOLATION: '❌ KRITISCH: Vertragslimit nicht exakt eingehalten',
    UNAVAILABLE_ASSIGNMENT: '❌ KRITISCH: Mitarbeiter unverfügbar zugewiesen',
    MANAGER_ALONE: '❌ KRITISCH: Manager arbeitet komplett alleine'
  };

  private static WARNING_VIOLATIONS = {
    MANAGER_WITH_TRAINEES_ONLY: '⚠️ WARNHINWEIS: Manager nur mit Trainees',
    OVERSTAFFED_EXPERIENCED: '⚠️ WARNHINWEIS: Überbesetzung mit Erfahrenen',
    SUBOPTIMAL_ASSIGNMENT: '⚠️ WARNHINWEIS: Suboptimale Zuweisung'
  };

  // Store scheduled shifts for lookup
  static scheduledShiftsCache: Map<string, ScheduledShift[]> = new Map();

  // Find optimal shifts for a specific employee considering exact contract limits
  private static findOptimalShiftsForEmployee(
    employee: Employee,
    scheduledShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    availabilityMap: Map<string, Map<string, number>>,
    allEmployees: Employee[],
    constraints: SchedulingConstraints
  ): ScheduledShift[] {
    
    return scheduledShifts
      .filter(shift => {
        // Check if shift needs more employees
        const currentAssignments = assignments[shift.id] || [];
        if (currentAssignments.length >= shift.requiredEmployees) return false;

        // Check availability
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        const preference = availabilityMap.get(employee.id)?.get(shiftKey);
        if (preference === 3 || preference === undefined) return false;

        // Check if assignment is compatible
        return this.canAssignEmployee(employee, shift, currentAssignments, allEmployees, constraints);
      })
      .sort((a, b) => {
        // Prioritize shifts where employee is most needed and most available
        const aCurrent = assignments[a.id]?.length || 0;
        const bCurrent = assignments[b.id]?.length || 0;
        const aNeeded = a.requiredEmployees - aCurrent;
        const bNeeded = b.requiredEmployees - bCurrent;

        // Also consider availability preference
        const aDay = this.getDayOfWeek(a.date);
        const bDay = this.getDayOfWeek(b.date);
        const aPref = availabilityMap.get(employee.id)?.get(`${aDay}-${a.timeSlotId}`) || 3;
        const bPref = availabilityMap.get(employee.id)?.get(`${bDay}-${b.timeSlotId}`) || 3;

        // Higher need and better preference first
        if (aNeeded !== bNeeded) return bNeeded - aNeeded;
        return aPref - bPref; // Lower preference number = better
      });
  }

  // PHASE B: Manager Integration
  private static async phaseBManagerIntegration(
    baseAssignments: { [shiftId: string]: string[] },
    shiftPlan: ShiftPlan,
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints,
    report: string[],
    firstWeekShifts: ScheduledShift[]
  ): Promise<{ [shiftId: string]: string[] }> {
    
    const assignments = { ...baseAssignments };
    const managerEmployees = employees.filter(emp => emp.role === 'admin');
    const availabilityMap = this.buildAdvancedAvailabilityMap(availabilities);
    
    // Initialize assignments for FIRST WEEK shifts
    firstWeekShifts.forEach(shift => {
      if (!assignments[shift.id]) {
        assignments[shift.id] = [];
      }
    });

    report.push('👔 PHASE B: Manager-Integration - Alle Priority 1 Schichten ignorieren alle Einschränkungen');

    // Assign managers to ALL their priority 1 shifts (ignoring all restrictions)
    for (const manager of managerEmployees) {
      await this.assignManagerAllPriority1Shifts(manager, firstWeekShifts, assignments, availabilityMap, report);
    }

    // Ensure experienced employee pairing in manager shifts
    for (const shift of firstWeekShifts) {
      await this.ensureExperiencedPairing(shift, assignments, employees, report);
    }

    return assignments;
  }

  // NEW METHOD: Assign manager to ALL priority 1 shifts ignoring restrictions
  private static async assignManagerAllPriority1Shifts(
    manager: Employee,
    shifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    availabilityMap: Map<string, Map<string, number>>,
    report: string[]
  ): Promise<void> {
    
    const priority1Shifts = shifts.filter(shift => {
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
      const preference = availabilityMap.get(manager.id)?.get(shiftKey);
      
      // 🔥 CRITICAL: Only assign Priority 1 shifts
      return preference === 1;
    });

    report.push(`👔 Manager ${manager.name} hat ${priority1Shifts.length} Priority 1 Schichten`);

    // 🔥 ASSIGN TO ALL PRIORITY 1 SHIFTS - IGNORING ALL RESTRICTIONS
    for (const shift of priority1Shifts) {
      // Initialize if missing
      if (!assignments[shift.id]) {
        assignments[shift.id] = [];
      }
      
      // Check if manager is already assigned
      if (!assignments[shift.id].includes(manager.id)) {
        // 🔥 IGNORE ALL RESTRICTIONS - just assign the manager
        assignments[shift.id].push(manager.id);
        report.push(`   ✅ Manager ${manager.name} zu Priority 1 Schicht ${shift.date} ${shift.timeSlotId} zugewiesen (alle Einschränkungen ignoriert)`);
      }
    }
  }

  // Identify manager shifts based on availability and business rules
  private static identifyManagerShifts(
    scheduledShifts: ScheduledShift[],
    managerEmployees: Employee[],
    availabilityMap: Map<string, Map<string, number>>
  ): ScheduledShift[] {
    
    return scheduledShifts.filter(shift => {
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
      
      // Check if any manager is available for this shift
      return managerEmployees.some(manager => {
        const preference = availabilityMap.get(manager.id)?.get(shiftKey);
        return preference !== undefined && preference !== 3;
      });
    });
  }

  // Assign manager to shifts
  private static async assignManagerToShifts(
    manager: Employee,
    managerShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    const availableShifts = managerShifts.filter(shift => {
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
      const preference = availabilityMap.get(manager.id)?.get(shiftKey);
      
      // 🔥 CRITICAL FIX: Ensure assignments[shift.id] exists
      if (!assignments[shift.id]) {
        assignments[shift.id] = []; // Initialize if missing
      }
      
      // 🔥 MANAGER GETS ALL PREFERRED SHIFTS (level 1)
      return preference === 1 && 
            assignments[shift.id].length < shift.requiredEmployees;
    });

    report.push(`👔 Manager ${manager.name} hat ${availableShifts.length} preferred Schichten (Level 1)`);

    // 🔥 NO LIMIT for managers - assign to ALL preferred shifts
    for (const shift of availableShifts) {
      // Double-check initialization (should be redundant but safe)
      if (!assignments[shift.id]) {
        assignments[shift.id] = [];
      }
      
      if (this.canAssignEmployee(manager, shift, assignments[shift.id], [manager], constraints)) {
        assignments[shift.id].push(manager.id);
        report.push(`✅ Manager ${manager.name} zu preferred Schicht ${shift.date} ${shift.timeSlotId} zugewiesen`);
      }
    }
  }

  // Ensure experienced employee pairing in manager shifts
  private static async ensureExperiencedPairing(
    shift: ScheduledShift,
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    report: string[]
  ): Promise<void> {
    
    const currentAssignments = assignments[shift.id] || [];
    const assignedEmployees = currentAssignments
      .map(id => employees.find(emp => emp.id === id))
      .filter(Boolean) as Employee[];

    const hasManager = assignedEmployees.some(emp => emp.role === 'admin');
    const hasExperienced = assignedEmployees.some(emp => emp.employeeType === 'experienced');

    // If manager is present but no experienced employee, try to add one
    if (hasManager && !hasExperienced && currentAssignments.length < shift.requiredEmployees) {
      const availableExperienced = employees.filter(emp => 
        emp.employeeType === 'experienced' && 
        emp.isActive && 
        !currentAssignments.includes(emp.id)
      );

      if (availableExperienced.length > 0) {
        const bestCandidate = availableExperienced[0];
        assignments[shift.id].push(bestCandidate.id);
        report.push(`✅ Erfahrener Mitarbeiter ${bestCandidate.name} zu Manager-Schicht hinzugefügt`);
      } else {
        report.push(`⚠️ Kein erfahrener Mitarbeiter verfügbar für Manager-Schicht`);
      }
    }
  }

  // Optimize assignments for better distribution
  private static optimizeAssignments(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    report: string[]
  ): { [shiftId: string]: string[] } {
    
    // Simple optimization: try to improve preference satisfaction
    const optimizedAssignments = { ...assignments };
    const availabilityMap = this.buildAdvancedAvailabilityMap(availabilities);
    const scheduledShifts = Array.from(this.scheduledShiftsCache.values()).flat();
    
    let improvements = 0;
    
    Object.entries(optimizedAssignments).forEach(([shiftId, assignedEmployees]) => {
      const shift = this.findScheduledShiftById(shiftId, scheduledShifts);
      if (!shift) return;

      assignedEmployees.forEach((employeeId, index) => {
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) return;

        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        const preference = availabilityMap.get(employeeId)?.get(shiftKey) || 3;

        // If preference is low (2), try to find better candidate
        if (preference === 2) {
          // Look for employees with preference 1 for this shift
          const betterCandidates = employees.filter(emp => 
            emp.id !== employeeId &&
            emp.isActive &&
            !assignedEmployees.includes(emp.id) &&
            this.getPreferenceLevel(emp.id, shift, availabilityMap) === 1
          );

          if (betterCandidates.length > 0) {
            const bestCandidate = betterCandidates[0];
            optimizedAssignments[shiftId][index] = bestCandidate.id;
            improvements++;
            report.push(`🔄 Optimiert: ${employee.name} → ${bestCandidate.name} in Schicht ${shift.date} ${shift.timeSlotId}`);
          }
        }
      });
    });

    if (improvements > 0) {
      report.push(`✨ ${improvements} Zuweisungen optimiert für bessere Präferenzen`);
    }

    return optimizedAssignments;
  }

  // Adjust assignments to achieve exact contract limits
  private static async adjustContractDeviations(
    assignments: { [shiftId: string]: string[] },
    deviations: ContractStatus[],
    employees: Employee[],
    shiftPlan: ShiftPlan,
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<{ [shiftId: string]: string[] }> {
    
    let adjustedAssignments = { ...assignments };
    const availabilityMap = this.buildAdvancedAvailabilityMap(availabilities);
    const scheduledShifts = this.scheduledShiftsCache.get(shiftPlan.id) || [];

    // Handle over-assigned employees first (remove assignments)
    const overAssigned = deviations.filter(d => d.deviation > 0)
      .sort((a, b) => b.deviation - a.deviation); // Most over-assigned first

    for (const over of overAssigned) {
      const employee = employees.find(emp => emp.id === over.employeeId);
      if (!employee) continue;

      report.push(`🔻 Reduziere Zuweisungen für ${employee.name}: ${over.actual} → ${over.target}`);

      const removed = await this.removeExcessAssignments(
        employee,
        over.deviation,
        adjustedAssignments,
        employees,
        availabilityMap,
        scheduledShifts,
        report
      );

      if (removed < over.deviation) {
        report.push(`⚠️ Konnte nur ${removed}/${over.deviation} überschüssige Zuweisungen entfernen`);
      }
    }

    // Handle under-assigned employees (add assignments)
    const underAssigned = deviations.filter(d => d.deviation < 0)
      .sort((a, b) => a.deviation - b.deviation); // Most under-assigned first

    for (const under of underAssigned) {
      const employee = employees.find(emp => emp.id === under.employeeId);
      if (!employee) continue;

      report.push(`🔺 Erhöhe Zuweisungen für ${employee.name}: ${under.actual} → ${under.target}`);

      const added = await this.addMissingAssignments(
        employee,
        -under.deviation, // Convert to positive number
        adjustedAssignments,
        employees,
        shiftPlan,
        availabilityMap,
        constraints,
        report
      );

      if (added < -under.deviation) {
        report.push(`⚠️ Konnte nur ${added}/${-under.deviation} fehlende Zuweisungen hinzufügen`);
      }
    }

    return adjustedAssignments;
  }

  // Remove excess assignments from over-assigned employee
  private static async removeExcessAssignments(
    employee: Employee,
    excessCount: number,
    assignments: { [shiftId: string]: string[] },
    allEmployees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    scheduledShifts: ScheduledShift[],
    report: string[]
  ): Promise<number> {
    
    let removedCount = 0;
    const employeeAssignments: { shiftId: string; shift: ScheduledShift }[] = [];

    // Find all assignments for this employee
    Object.entries(assignments).forEach(([shiftId, assignedEmployees]) => {
      if (assignedEmployees.includes(employee.id)) {
        const shift = this.findScheduledShiftById(shiftId, scheduledShifts);
        if (shift) {
          employeeAssignments.push({ shiftId, shift });
        }
      }
    });

    // Sort assignments by removability (least critical first)
    const removableAssignments = employeeAssignments.sort((a, b) => {
      const aCurrent = assignments[a.shiftId].length;
      const bCurrent = assignments[b.shiftId].length;
      const aRequired = a.shift.requiredEmployees;
      const bRequired = b.shift.requiredEmployees;

      // Prefer removing from overstaffed shifts
      if (aCurrent > aRequired && bCurrent <= bRequired) return -1;
      if (bCurrent > bRequired && aCurrent <= aRequired) return 1;
      
      // Prefer removing from shifts with lower impact
      return aCurrent - bCurrent;
    });

    // Remove excess assignments
    for (const assignment of removableAssignments) {
      if (removedCount >= excessCount) break;

      const currentAssignments = assignments[assignment.shiftId];
      if (currentAssignments.length > assignment.shift.requiredEmployees) {
        // This shift is overstaffed, safe to remove
        assignments[assignment.shiftId] = currentAssignments.filter(id => id !== employee.id);
        removedCount++;
        report.push(`   🔄 Entfernt ${employee.name} aus überbesetzter Schicht`);
      } else if (this.canShiftSurviveRemoval(assignment.shiftId, employee.id, assignments, allEmployees)) {
        // Shift can survive removal without critical violations
        assignments[assignment.shiftId] = currentAssignments.filter(id => id !== employee.id);
        removedCount++;
        report.push(`   🔄 Entfernt ${employee.name} aus tolerierbarer Schicht`);
      }
    }

    return removedCount;
  }

  // Check if shift can survive employee removal
  private static canShiftSurviveRemoval(
    shiftId: string,
    employeeId: string,
    assignments: { [shiftId: string]: string[] },
    allEmployees: Employee[]
  ): boolean {
    const currentAssignments = assignments[shiftId] || [];
    const remainingAssignments = currentAssignments.filter(id => id !== employeeId);
    
    if (remainingAssignments.length === 0) return false; // Would create empty shift
    
    // Check if removal would create trainee-alone situation
    const remainingEmployees = remainingAssignments
      .map(id => allEmployees.find(emp => emp.id === id))
      .filter(Boolean) as Employee[];
    
    if (remainingEmployees.length === 1 && remainingEmployees[0].employeeType === 'trainee') {
      return false;
    }
    
    return true;
  }

  // Add missing assignments to under-assigned employee
  private static async addMissingAssignments(
    employee: Employee,
    missingCount: number,
    assignments: { [shiftId: string]: string[] },
    allEmployees: Employee[],
    shiftPlan: ShiftPlan,
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<number> {
    
    let addedCount = 0;
    const scheduledShifts = this.scheduledShiftsCache.get(shiftPlan.id) || [];
    
    const availableShifts = this.findOptimalShiftsForEmployee(
      employee,
      scheduledShifts,
      assignments,
      availabilityMap,
      allEmployees,
      constraints
    );

    for (const shift of availableShifts) {
      if (addedCount >= missingCount) break;

      if (this.canAssignEmployee(employee, shift, assignments[shift.id], allEmployees, constraints)) {
        assignments[shift.id].push(employee.id);
        addedCount++;
        report.push(`   🔄 Hinzugefügt ${employee.name} zu Schicht ${shift.date} ${shift.timeSlotId} (${addedCount}/${missingCount})`);
      }
    }

    return addedCount;
  }

  // Calculate exact contract status for all employees
  private static calculateContractStatus(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    firstWeekShifts: ScheduledShift[] // 🔥 Nur erste Woche zählt
  ): ContractStatus[] {
    
    const employeeWorkload = new Map<string, number>();
    
    // 🔥 CRITICAL: Count assignments only from FIRST WEEK
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      assignedEmployees.forEach(employeeId => {
        employeeWorkload.set(employeeId, (employeeWorkload.get(employeeId) || 0) + 1);
      });
    });

    return employees.map(employee => {
      const actual = employeeWorkload.get(employee.id) || 0;
      const target = this.getExactContractAssignments(employee);
      
      // 🔥 MANAGERS: No deviation calculation
      const deviation = employee.role === 'admin' ? 0 : actual - target;

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        actual,
        target,
        deviation,
        isManager: employee.role === 'admin'
      };
    });
  }

  // 🔥 IMPROVED: Better prioritization for limited shifts
  private static prioritizeEmployeesByContractTarget(employees: Employee[]): Employee[] {
    return employees.sort((a, b) => {
      const aTarget = this.getExactContractAssignments(a);
      const bTarget = this.getExactContractAssignments(b);
      
      // 🔥 CRITICAL FIX: Small contracts FIRST (they're harder to place)
      if (aTarget !== bTarget) return aTarget - bTarget;
      
      // 🔥 Then prioritize by flexibility (canWorkAlone employees can fill gaps)
      if (a.canWorkAlone && !b.canWorkAlone) return -1;
      if (!a.canWorkAlone && b.canWorkAlone) return 1;
      
      // 🔥 Then by experience (experienced can work in more situations)
      if (a.employeeType === 'experienced' && b.employeeType !== 'experienced') return -1;
      if (b.employeeType === 'experienced' && a.employeeType !== 'experienced') return 1;
      
      return 0;
    });
  }

  // Helper methods
  private static getEmployeeName(employeeId: string, employees: Employee[]): string {
    return employees.find(emp => emp.id === employeeId)?.name || 'Unbekannt';
  }

  private static getPreferenceLevel(
    employeeId: string,
    shift: ScheduledShift,
    availabilityMap: Map<string, Map<string, number>>
  ): number {
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    return availabilityMap.get(employeeId)?.get(shiftKey) || 3;
  }

  private static findScheduledShiftById(shiftId: string, scheduledShifts: ScheduledShift[]): ScheduledShift | null {
    return scheduledShifts.find(shift => shift.id === shiftId) || null;
  }

  // Core assignment logic
  private static canAssignEmployee(
    employee: Employee,
    shift: ScheduledShift,
    currentAssignments: string[],
    allEmployees: Employee[],
    constraints: SchedulingConstraints
  ): boolean {
    
    // Check if assignment would create trainee-alone situation
    if (constraints.enforceNoTraineeAlone) {
      if (employee.employeeType === 'trainee' && currentAssignments.length === 0) {
        return false; // Can't assign trainee as first employee
      }
      
      if (employee.employeeType === 'trainee' && currentAssignments.length > 0) {
        const currentEmployees = currentAssignments.map(id => 
          allEmployees.find(emp => emp.id === id)
        ).filter(Boolean) as Employee[];
        
        const hasExperienced = currentEmployees.some(emp => 
          emp.employeeType === 'experienced' || emp.role === 'admin'
        );
        
        if (!hasExperienced) return false;
      }
    }
    
    return true;
  }

  // Identify difficult shifts (few available employees)
  private static identifyDifficultShifts(
    shifts: ScheduledShift[],
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>
  ): ScheduledShift[] {
    
    return shifts
      .map(shift => {
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        
        const availableCount = employees.filter(emp => {
          const empAvailability = availabilityMap.get(emp.id);
          return empAvailability && empAvailability.get(shiftKey) !== 3;
        }).length;
        
        return { shift, difficulty: shift.requiredEmployees / Math.max(1, availableCount) };
      })
      .filter(item => item.difficulty > 0.5) // Threshold for "difficult"
      .sort((a, b) => b.difficulty - a.difficulty)
      .map(item => item.shift);
  }

  // Build availability map
  private static buildAdvancedAvailabilityMap(availabilities: EmployeeAvailability[]): Map<string, Map<string, number>> {
    const map = new Map<string, Map<string, number>>();
    
    availabilities.forEach(avail => {
      if (!map.has(avail.employeeId)) {
        map.set(avail.employeeId, new Map<string, number>());
      }
      
      const shiftKey = `${avail.dayOfWeek}-${avail.timeSlotId}`;
      map.get(avail.employeeId)!.set(shiftKey, avail.preferenceLevel);
    });
    
    return map;
  }

  // Get day of week
  private static getDayOfWeek(dateString: string): number {
    const date = new Date(dateString);
    return date.getDay() === 0 ? 7 : date.getDay();
  }

  // Calculate quality metrics
  private static calculateQualityMetrics(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    shiftPlan: ShiftPlan
  ): QualityMetrics {
    
    const scheduledShifts = this.scheduledShiftsCache.get(shiftPlan.id) || [];
    const totalShifts = scheduledShifts.length;
    const filledShifts = Object.values(assignments).filter(a => a.length > 0).length;
    const perfectlyFilledShifts = Object.entries(assignments)
      .filter(([shiftId, assigned]) => {
        const shift = this.findScheduledShiftById(shiftId, scheduledShifts);
        return shift && assigned.length === shift.requiredEmployees;
      }).length;

    const employeeWorkload = new Map<string, number>();
    Object.values(assignments).forEach(assignedEmployees => {
      assignedEmployees.forEach(employeeId => {
        employeeWorkload.set(employeeId, (employeeWorkload.get(employeeId) || 0) + 1);
      });
    });

    let workloadDistributionScore = 0;
    employeeWorkload.forEach(workload => {
      // Ideal distribution score
      workloadDistributionScore += Math.max(0, 1 - Math.abs(workload - 2) / 2);
    });
    
    workloadDistributionScore /= employees.length;

    return {
      coverageRate: filledShifts / totalShifts,
      perfectAssignmentRate: perfectlyFilledShifts / totalShifts,
      workloadDistributionScore,
      totalAssignments: Object.values(assignments).reduce((sum, a) => sum + a.length, 0),
      criticalViolations: 0 // Will be filled separately
    };
  }

  // Main scheduling method with STRICT contract enforcement
  static async generateOptimalSchedule(
    shiftPlan: ShiftPlan,
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints
  ): Promise<SchedulingResult> {
    
    const resolutionReport: string[] = [];
    const violations: string[] = [];
    
    console.log('🚀 STARTING SCHEDULING MIT NICHT VERHANDELBAREN VERTRAGSGRENZEN - NUR ERSTE WOCHE');
    resolutionReport.push('🚀 STARTING SCHEDULING MIT NICHT VERHANDELBAREN VERTRAGSGRENZEN - NUR ERSTE WOCHE');

    // Load all scheduled shifts
    const scheduledShifts = await shiftAssignmentService.getScheduledShiftsForPlan(shiftPlan.id);
    this.scheduledShiftsCache.set(shiftPlan.id, scheduledShifts);
    
    // 🔥 CRITICAL: Use ONLY FIRST WEEK for ENTIRE scheduling process
    const firstWeekShifts = this.getFirstWeekShifts(scheduledShifts);
    
    console.log('📋 Scheduling analysis:', {
      totalShifts: scheduledShifts.length,
      firstWeekShifts: firstWeekShifts.length,
      weeks: Math.ceil(scheduledShifts.length / firstWeekShifts.length)
    });
    
    resolutionReport.push(`📋 ${firstWeekShifts.length} Schichten in erster Woche für KOMPLETTES Scheduling`);
    resolutionReport.push(`📋 ${scheduledShifts.length} Schichten gesamt im Plan`);

    // PHASE A: Base Staffing with NON-NEGOTIABLE Contract Limits - FIRST WEEK ONLY
    resolutionReport.push('📊 PHASE A: Grundbesetzung mit NICHT VERHANDELBAREN Vertragsgrenzen - NUR ERSTE WOCHE');
    const baseAssignments = await this.phaseANonNegotiableContractStaffing(
      shiftPlan, employees, availabilities, constraints, resolutionReport, violations, firstWeekShifts // 🔥 Pass first week shifts
    );

    // If we have contract violations in phase A, stop immediately
    const contractViolations = violations.filter(v => v.includes('CONTRACT_LIMIT_VIOLATION'));
    if (contractViolations.length > 0) {
      resolutionReport.push('🚨 ABBRUCH: Nicht verhandelbare Vertragsverletzungen können nicht behoben werden');
      this.scheduledShiftsCache.delete(shiftPlan.id);
      return {
        assignments: baseAssignments,
        violations,
        success: false,
        resolutionReport,
        qualityMetrics: this.calculateQualityMetrics(baseAssignments, employees, shiftPlan)
      };
    }

    // PHASE B: Manager Integration - FIRST WEEK ONLY
    resolutionReport.push('👔 PHASE B: Manager-Integration - NUR ERSTE WOCHE');
    const managerAssignments = await this.phaseBManagerIntegration(
      baseAssignments, shiftPlan, employees, availabilities, constraints, resolutionReport, firstWeekShifts // 🔥 Pass first week shifts
    );

    // PHASE C: Final Validation - FIRST WEEK ONLY
    resolutionReport.push('🔍 PHASE C: Finale Validierung - NUR ERSTE WOCHE');
    const finalAssignments = await this.phaseCFinalValidation(
      managerAssignments, employees, availabilities, constraints, resolutionReport, violations, firstWeekShifts // 🔥 Pass first week shifts
    );

    // Final validation with NON-NEGOTIABLE contract limit checking - FIRST WEEK ONLY
    resolutionReport.push('✅ FINALE VALIDIERUNG MIT NICHT VERHANDELBAREN VERTRAGSGRENZEN - NUR ERSTE WOCHE');
    this.finalNonNegotiableContractValidation(finalAssignments, employees, violations, resolutionReport, firstWeekShifts); // 🔥 Pass first week shifts

    const success = violations.filter(v => 
      v.includes('❌ KRITISCH') || v.includes('ERROR:')
    ).length === 0;

    if (success) {
      resolutionReport.push('🎉 ALLE NICHT VERHANDELBAREN VERTRAGSGRENZEN EINGEHALTEN!');
    } else {
      resolutionReport.push('🚨 KRITISCHE VERTRAGSVERLETZUNGEN: Plan kann nicht veröffentlicht werden');
    }

    this.scheduledShiftsCache.delete(shiftPlan.id);

    // 🔥 RETURN ONLY FIRST WEEK ASSIGNMENTS - Pattern wird später auf alle Wochen angewendet
    return {
      assignments: finalAssignments, // Diese enthalten nur erste Woche
      violations,
      success,
      resolutionReport,
      qualityMetrics: this.calculateQualityMetrics(finalAssignments, employees, shiftPlan)
    };
  }

  // PHASE A: Base Staffing with NON-NEGOTIABLE Contract Limits
  private static async phaseANonNegotiableContractStaffing(
    shiftPlan: ShiftPlan,
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints,
    report: string[],
    violations: string[],
    firstWeekShifts: ScheduledShift[]
  ): Promise<{ [shiftId: string]: string[] }> {
    
    const assignments: { [shiftId: string]: string[] } = {};
    const employeeWorkload = new Map<string, number>();
    const employeeTargetAssignments = new Map<string, number>();
    const availabilityMap = this.buildAdvancedAvailabilityMap(availabilities);
    
    // Initialize with EXACT contract targets
    employees.forEach(emp => {
      employeeWorkload.set(emp.id, 0);
      employeeTargetAssignments.set(emp.id, this.getExactContractAssignments(emp));
    });

    // Initialize assignments for FIRST WEEK shifts only
    firstWeekShifts.forEach(shift => assignments[shift.id] = []);

    report.push(`📋 ${firstWeekShifts.length} Schichten in erster Woche für Vertragserfüllung`);

    // 🔥 STEP 1: Categorize employees
    const newEmployees = employees.filter(emp => 
      emp.role !== 'admin' && 
      emp.employeeType === 'trainee'
    );
    
    const experiencedEmployees = employees.filter(emp => 
      emp.role !== 'admin' && 
      emp.employeeType === 'experienced'
    );
    
    const experiencedCannotWorkAlone = experiencedEmployees.filter(emp => !emp.canWorkAlone);
    const experiencedCanWorkAlone = experiencedEmployees.filter(emp => emp.canWorkAlone);
    
    const otherEmployees = employees.filter(emp => 
      emp.role !== 'admin' && 
      emp.employeeType !== 'trainee' && 
      emp.employeeType !== 'experienced'
    );

    report.push('👥 Mitarbeiter-Kategorisierung:');
    report.push(`   🆕 Neue (Trainees): ${newEmployees.length}`);
    report.push(`   🎯 Erfahrene (cannot work alone): ${experiencedCannotWorkAlone.length}`);
    report.push(`   🎯 Erfahrene (can work alone): ${experiencedCanWorkAlone.length}`);
    report.push(`   📊 Sonstige: ${otherEmployees.length}`);

    // 🔥 STEP 2: Assign New + Experienced employees together
    report.push('🔄 STEP 1: Weise Neue + Erfahrene zusammen zu');
    await this.assignNewWithExperienced(
      firstWeekShifts,
      assignments,
      employeeWorkload,
      employeeTargetAssignments,
      newEmployees,
      experiencedEmployees,
      availabilityMap,
      employees,
      constraints,
      report
    );

    // 🔥 STEP 3: Ensure experienced (cannot work alone) always work in pairs
    report.push('🔄 STEP 2: Erfahrene (cannot work alone) immer zu zweit');
    await this.assignExperiencedInPairs(
      firstWeekShifts,
      assignments,
      employeeWorkload,
      employeeTargetAssignments,
      experiencedCannotWorkAlone,
      availabilityMap,
      employees,
      constraints,
      report
    );

    // 🔥 STEP 4: Fill remaining shifts by priority sum
    report.push('🔄 STEP 3: Fülle verbleibende Schichten nach Prioritäts-Summe');
    await this.fillRemainingShiftsByPrioritySum(
      firstWeekShifts,
      assignments,
      employeeWorkload,
      employeeTargetAssignments,
      employees,
      availabilityMap,
      constraints,
      report
    );

    const filledShifts = Object.values(assignments).filter(a => a.length > 0).length;
    const totalAssignments = Object.values(assignments).reduce((sum, a) => sum + a.length, 0);
    
    report.push(`✅ Grundbesetzung abgeschlossen: ${filledShifts}/${firstWeekShifts.length} Schichten besetzt, ${totalAssignments} Zuweisungen`);

    // 🔥 STEP 5: Calculate and report contract fulfillment
    this.calculateContractFulfillment(employeeWorkload, employeeTargetAssignments, employees, violations, report);

    return assignments;
  }

  private static async assignNewWithExperienced(
    shifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    newEmployees: Employee[],
    experiencedEmployees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    allEmployees: Employee[],
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    // Try to assign each new employee with an experienced colleague
    for (const newEmployee of newEmployees) {
      const currentWorkload = employeeWorkload.get(newEmployee.id) || 0;
      const targetWorkload = employeeTargetAssignments.get(newEmployee.id) || 0;
      
      if (currentWorkload >= targetWorkload) continue;
      
      report.push(`🎯 Weise ${newEmployee.name} (Neu) mit erfahrenem Kollegen zu`);

      // Find suitable shifts where new employee is available and needs assignment
      const suitableShifts = shifts
        .filter(shift => {
          const currentAssignments = assignments[shift.id] || [];
          const dayOfWeek = this.getDayOfWeek(shift.date);
          const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
          
          // Check if new employee is available
          const newEmployeePref = availabilityMap.get(newEmployee.id)?.get(shiftKey);
          if (newEmployeePref === 3 || newEmployeePref === undefined) return false;
          
          // Check if shift can accept more employees
          if (currentAssignments.length >= shift.requiredEmployees) return false;
          
          // Check if new employee can be assigned here
          return this.canAssignEmployee(newEmployee, shift, currentAssignments, allEmployees, constraints);
        })
        .sort((a, b) => {
          // Prefer shifts with experienced employees already assigned
          const aHasExperienced = (assignments[a.id] || []).some(id => 
            experiencedEmployees.some(exp => exp.id === id)
          );
          const bHasExperienced = (assignments[b.id] || []).some(id => 
            experiencedEmployees.some(exp => exp.id === id)
          );
          
          if (aHasExperienced && !bHasExperienced) return -1;
          if (!aHasExperienced && bHasExperienced) return 1;
          
          // Otherwise prefer shifts with fewer assignments
          return (assignments[a.id]?.length || 0) - (assignments[b.id]?.length || 0);
        });

      for (const shift of suitableShifts) {
        // FIX: Use the variable we already defined instead of calling get() again
        const newEmployeeCurrentWorkload = employeeWorkload.get(newEmployee.id) || 0;
        if (newEmployeeCurrentWorkload >= targetWorkload) break;
        
        const currentAssignments = assignments[shift.id] || [];
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        
        // Check if there's already an experienced employee in this shift
        const hasExperienced = currentAssignments.some(id => 
          experiencedEmployees.some(exp => exp.id === id)
        );
        
        if (!hasExperienced) {
          // Try to find an available experienced employee to assign together
          const availableExperienced = experiencedEmployees
            .filter(exp => {
              const expWorkload = employeeWorkload.get(exp.id) || 0;
              const expTarget = employeeTargetAssignments.get(exp.id) || 0;
              if (expWorkload >= expTarget) return false;
              
              const expPref = availabilityMap.get(exp.id)?.get(shiftKey);
              if (expPref === 3 || expPref === undefined) return false;
              
              return this.canAssignEmployee(exp, shift, currentAssignments, allEmployees, constraints);
            })
            .sort((a, b) => {
              // Prefer experienced with better availability
              const aPref = availabilityMap.get(a.id)?.get(shiftKey) || 3;
              const bPref = availabilityMap.get(b.id)?.get(shiftKey) || 3;
              return aPref - bPref;
            });
          
          if (availableExperienced.length > 0) {
            // Assign experienced employee first
            const experienced = availableExperienced[0];
            assignments[shift.id].push(experienced.id);
            employeeWorkload.set(experienced.id, (employeeWorkload.get(experienced.id) || 0) + 1);
            report.push(`   ✅ ${experienced.name} (Erfahren) zu ${shift.date} ${shift.timeSlotId}`);
          }
        }
        
        // Now assign the new employee
        if (this.canAssignEmployee(newEmployee, shift, assignments[shift.id], allEmployees, constraints)) {
          assignments[shift.id].push(newEmployee.id);
          employeeWorkload.set(newEmployee.id, (employeeWorkload.get(newEmployee.id) || 0) + 1);
          report.push(`   ✅ ${newEmployee.name} (Neu) zu ${shift.date} ${shift.timeSlotId} mit erfahrenem Kollegen`);
          break; // Move to next new employee after successful assignment
        }
      }
    }
  }

  private static async assignExperiencedInPairs(
    shifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    experiencedCannotWorkAlone: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    allEmployees: Employee[],
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    for (const experiencedEmployee of experiencedCannotWorkAlone) {
      const currentWorkload = employeeWorkload.get(experiencedEmployee.id) || 0;
      const targetWorkload = employeeTargetAssignments.get(experiencedEmployee.id) || 0;
      
      if (currentWorkload >= targetWorkload) continue;
      
      report.push(`🎯 Weise ${experiencedEmployee.name} (Erfahren, cannot work alone) nur mit Partner zu`);

      // Find shifts where this employee can work with at least one other person
      const suitableShifts = shifts
        .filter(shift => {
          const currentAssignments = assignments[shift.id] || [];
          const dayOfWeek = this.getDayOfWeek(shift.date);
          const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
          
          // Check availability
          const preference = availabilityMap.get(experiencedEmployee.id)?.get(shiftKey);
          if (preference === 3 || preference === undefined) return false;
          
          // Check if shift has at least one other employee OR can accept multiple
          const hasPartner = currentAssignments.length >= 1;
          const canAcceptMultiple = currentAssignments.length < shift.requiredEmployees;
          
          return hasPartner && canAcceptMultiple && 
                this.canAssignEmployee(experiencedEmployee, shift, currentAssignments, allEmployees, constraints);
        })
        .sort((a, b) => {
          // Prefer shifts with more experienced colleagues
          const aExperiencedCount = (assignments[a.id] || []).filter(id => 
            experiencedCannotWorkAlone.some(exp => exp.id === id)
          ).length;
          const bExperiencedCount = (assignments[b.id] || []).filter(id => 
            experiencedCannotWorkAlone.some(exp => exp.id === id)
          ).length;
          
          return bExperiencedCount - aExperiencedCount;
        });

      for (const shift of suitableShifts) {
        // FIX: Use the variable we already defined instead of calling get() again
        const experiencedCurrentWorkload = employeeWorkload.get(experiencedEmployee.id) || 0;
        if (experiencedCurrentWorkload >= targetWorkload) break;
        
        if (this.canAssignEmployee(experiencedEmployee, shift, assignments[shift.id], allEmployees, constraints)) {
          assignments[shift.id].push(experiencedEmployee.id);
          employeeWorkload.set(experiencedEmployee.id, (employeeWorkload.get(experiencedEmployee.id) || 0) + 1);
          report.push(`   ✅ ${experiencedEmployee.name} zu ${shift.date} ${shift.timeSlotId} mit Partner`);
          break;
        }
      }
    }
  }

  private static async fillRemainingShiftsByPrioritySum(
    shifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    const nonManagerEmployees = employees.filter(emp => emp.role !== 'admin');
    
    // 🔥 Calculate priority sum for each shift
    const shiftsWithPriority = shifts.map(shift => {
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
      
      let prioritySum = 0;
      let availableCount = 0;
      
      nonManagerEmployees.forEach(emp => {
        const preference = availabilityMap.get(emp.id)?.get(shiftKey);
        if (preference !== undefined && preference !== 3) {
          // Level 1 = 3 points, Level 2 = 1 point
          prioritySum += (preference === 1 ? 3 : 1);
          availableCount++;
        }
      });
      
      return {
        shift,
        prioritySum,
        availableCount,
        currentAssignments: assignments[shift.id]?.length || 0,
        neededAssignments: shift.requiredEmployees - (assignments[shift.id]?.length || 0)
      };
    });

    // 🔥 Sort by priority sum (LOWEST first - hardest to fill)
    const sortedShifts = shiftsWithPriority
      .filter(item => item.neededAssignments > 0) // Only shifts that need more employees
      .sort((a, b) => a.prioritySum - b.prioritySum);

    report.push('📊 Schicht-Prioritäten (niedrigste zuerst):');
    sortedShifts.forEach((item, index) => {
      report.push(`   ${index + 1}. ${item.shift.date} ${item.shift.timeSlotId}: Priorität ${item.prioritySum}, ${item.availableCount} verfügbar, benötigt ${item.neededAssignments}`);
    });

    // 🔥 Fill shifts from lowest priority sum to highest
    for (const item of sortedShifts) {
      const shift = item.shift;
      const currentAssignments = assignments[shift.id] || [];
      
      if (currentAssignments.length >= shift.requiredEmployees) continue;
      
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
      
      report.push(`🔄 Fülle Schicht ${shift.date} ${shift.timeSlotId} (Priorität: ${item.prioritySum})`);

      // Find available employees with capacity
      const availableEmployees = nonManagerEmployees
        .filter(emp => {
          // Check availability
          const preference = availabilityMap.get(emp.id)?.get(shiftKey);
          if (preference === 3 || preference === undefined) return false;
          
          // Check contract capacity
          const currentWorkload = employeeWorkload.get(emp.id) || 0;
          const targetWorkload = employeeTargetAssignments.get(emp.id) || 0;
          if (currentWorkload >= targetWorkload) return false;
          
          // Check if assignment is compatible
          return this.canAssignEmployee(emp, shift, currentAssignments, employees, constraints);
        })
        .sort((a, b) => {
          // Prioritize by:
          // 1. Better availability preference
          const aPref = availabilityMap.get(a.id)?.get(shiftKey) || 3;
          const bPref = availabilityMap.get(b.id)?.get(shiftKey) || 3;
          if (aPref !== bPref) return aPref - bPref;
          
          // 2. Lower current workload (better distribution)
          const aWorkload = employeeWorkload.get(a.id) || 0;
          const bWorkload = employeeWorkload.get(b.id) || 0;
          return aWorkload - bWorkload;
        });
      
      // Assign employees until shift is filled
      for (const employee of availableEmployees) {
        if (assignments[shift.id].length >= shift.requiredEmployees) break;
        
        const currentWorkload = employeeWorkload.get(employee.id) || 0;
        const targetWorkload = employeeTargetAssignments.get(employee.id) || 0;
        
        // Only assign if within contract limits
        if (currentWorkload < targetWorkload) {
          assignments[shift.id].push(employee.id);
          employeeWorkload.set(employee.id, currentWorkload + 1);
          report.push(`   ✅ ${employee.name} zugewiesen (${employeeWorkload.get(employee.id)}/${targetWorkload})`);
        }
      }
    }
  }

  private static async fillShiftsByPriorityNonNegotiable(
    prioritizedShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    const nonManagerEmployees = employees.filter(emp => emp.role !== 'admin');
    
    // 🔥 PHASE 1: Fill each shift to minimum viable staffing
    for (const shift of prioritizedShifts) {
      const currentAssignments = assignments[shift.id] || [];
      
      // Skip if shift already has enough employees
      if (currentAssignments.length >= shift.requiredEmployees) continue;
      
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
      
      // Find available employees with capacity
      const availableEmployees = nonManagerEmployees
        .filter(emp => {
          // Check availability
          const preference = availabilityMap.get(emp.id)?.get(shiftKey);
          if (preference === 3 || preference === undefined) return false;
          
          // Check contract capacity
          const currentWorkload = employeeWorkload.get(emp.id) || 0;
          const targetWorkload = employeeTargetAssignments.get(emp.id) || 0;
          if (currentWorkload >= targetWorkload) return false;
          
          // Check if assignment is compatible
          return this.canAssignEmployee(emp, shift, currentAssignments, employees, constraints);
        })
        .sort((a, b) => {
          // Prioritize employees who:
          // 1. Have better availability preference
          const aPref = availabilityMap.get(a.id)?.get(shiftKey) || 3;
          const bPref = availabilityMap.get(b.id)?.get(shiftKey) || 3;
          if (aPref !== bPref) return aPref - bPref;
          
          // 2. Have lower current workload (better distribution)
          const aWorkload = employeeWorkload.get(a.id) || 0;
          const bWorkload = employeeWorkload.get(b.id) || 0;
          return aWorkload - bWorkload;
        });
      
      // Assign employees until shift is adequately staffed
      for (const employee of availableEmployees) {
        if (currentAssignments.length >= shift.requiredEmployees) break;
        
        const currentWorkload = employeeWorkload.get(employee.id) || 0;
        const targetWorkload = employeeTargetAssignments.get(employee.id) || 0;
        
        // 🔥 STRICT: Only assign if within contract limits
        if (currentWorkload < targetWorkload) {
          assignments[shift.id].push(employee.id);
          employeeWorkload.set(employee.id, currentWorkload + 1);
          report.push(`   ✅ ${employee.name} zu ${shift.date} ${shift.timeSlotId} (${employeeWorkload.get(employee.id)}/${targetWorkload})`);
        }
      }
    }
    
    // 🔥 PHASE 2: Try to fulfill remaining contract requirements
    await this.fulfillRemainingContracts(
      prioritizedShifts,
      assignments,
      employeeWorkload,
      employeeTargetAssignments,
      employees,
      availabilityMap,
      constraints,
      report
    );
  }

  private static async fulfillRemainingContracts(
    shifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    const nonManagerEmployees = employees.filter(emp => emp.role !== 'admin');
    
    // Find employees who haven't reached their contract targets
    const underAssignedEmployees = nonManagerEmployees
      .filter(emp => {
        const current = employeeWorkload.get(emp.id) || 0;
        const target = employeeTargetAssignments.get(emp.id) || 0;
        return current < target;
      })
      .sort((a, b) => {
        // Prioritize employees with smallest contracts first (they're hardest to place)
        const aTarget = employeeTargetAssignments.get(a.id) || 0;
        const bTarget = employeeTargetAssignments.get(b.id) || 0;
        return aTarget - bTarget;
      });
    
    if (underAssignedEmployees.length === 0) {
      report.push('✅ Alle Vertragsziele erfüllt!');
      return;
    }
    
    report.push(`📋 Versuche Vertragserfüllung für ${underAssignedEmployees.length} Mitarbeiter`);
    
    // Try to assign remaining shifts to fulfill contracts
    for (const employee of underAssignedEmployees) {
      const currentWorkload = employeeWorkload.get(employee.id) || 0;
      const targetWorkload = employeeTargetAssignments.get(employee.id) || 0;
      const needed = targetWorkload - currentWorkload;
      
      if (needed <= 0) continue;
      
      report.push(`🎯 Versuche ${employee.name}: ${currentWorkload} → ${targetWorkload} (${needed} benötigt)`);
      
      let assigned = 0;
      
      // Find available shifts for this employee
      const availableShifts = shifts
        .filter(shift => {
          const currentAssignments = assignments[shift.id] || [];
          const dayOfWeek = this.getDayOfWeek(shift.date);
          const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
          
          // Check availability
          const preference = availabilityMap.get(employee.id)?.get(shiftKey);
          if (preference === 3 || preference === undefined) return false;
          
          // Check if shift can accept more employees
          if (currentAssignments.length >= shift.requiredEmployees) return false;
          
          // Check if assignment is compatible
          return this.canAssignEmployee(employee, shift, currentAssignments, employees, constraints);
        })
        .sort((a, b) => {
          // Prefer shifts with fewer current assignments
          return (assignments[a.id]?.length || 0) - (assignments[b.id]?.length || 0);
        });
      
      // Assign to available shifts
      for (const shift of availableShifts) {
        if (assigned >= needed) break;
        
        // Final check for contract limit
        const current = employeeWorkload.get(employee.id) || 0;
        if (current >= targetWorkload) break;
        
        assignments[shift.id].push(employee.id);
        employeeWorkload.set(employee.id, current + 1);
        assigned++;
        
        report.push(`   🔄 ${employee.name} zu ${shift.date} ${shift.timeSlotId} (${current + 1}/${targetWorkload})`);
      }
      
      if (assigned < needed) {
        report.push(`   ⚠️ ${employee.name}: Nur ${assigned}/${needed} zusätzliche Schichten gefunden`);
      }
    }
  }

  private static calculateContractFulfillment(
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    employees: Employee[],
    violations: string[],
    report: string[]
  ): void {
    
    const nonManagerEmployees = employees.filter(emp => emp.role !== 'admin');
    let totalFulfilled = 0;
    let totalRequired = 0;
    
    report.push('📊 Vertragserfüllungs-Report:');
    
    nonManagerEmployees.forEach(emp => {
      const actual = employeeWorkload.get(emp.id) || 0;
      const target = employeeTargetAssignments.get(emp.id) || 0;
      
      totalFulfilled += actual;
      totalRequired += target;
      
      if (actual < target) {
        const violation = `${this.CRITICAL_VIOLATIONS.CONTRACT_LIMIT_VIOLATION}: ${emp.name} (${actual}/${target})`;
        violations.push(violation);
        report.push(`   ❌ ${violation}`);
      } else {
        report.push(`   ✅ ${emp.name}: ${actual}/${target} erfüllt`);
      }
    });
    
    const fulfillmentRate = totalRequired > 0 ? (totalFulfilled / totalRequired) * 100 : 100;
    report.push(`📈 Gesamterfüllung: ${totalFulfilled}/${totalRequired} (${fulfillmentRate.toFixed(1)}%)`);
    
    if (fulfillmentRate < 100) {
      report.push(`💡 Grund: Zu wenige Schichten (${Math.round(totalRequired - totalFulfilled)} fehlende Schicht-Zuweisungen)`);
    }
  }

  private static async fillRemainingShiftsFlexible(
    scheduledShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    // 🔥 STRICT CONTRACT LIMITS: Only employees with remaining capacity
    const employeesWithCapacity = employees.filter(emp => {
      const current = employeeWorkload.get(emp.id) || 0;
      const target = employeeTargetAssignments.get(emp.id) || 0;
      return current < target; // 🔥 VERTRAGSLIMIT muss eingehalten werden
    });

    report.push(`👥 ${employeesWithCapacity.length} Mitarbeiter haben noch Kapazität für Vertragserfüllung`);

    // Fill shifts with FLEXIBLE staffing rules but STRICT contract limits
    for (const shift of scheduledShifts) {
      const currentAssignments = assignments[shift.id] || [];
      
      const needsMoreEmployees = this.doesShiftNeedMoreEmployees(shift, currentAssignments, employees);
      
      if (!needsMoreEmployees) continue;

      const availableEmployees = this.findAvailableEmployeesForShiftFlexible(
        shift,
        employeesWithCapacity, // 🔥 Nur Mitarbeiter mit Kapazität
        availabilityMap,
        employeeWorkload,
        employeeTargetAssignments,
        currentAssignments
      );

      const candidates = this.scoreCandidatesFlexible(
        availableEmployees,
        shift,
        availabilityMap,
        employeeWorkload,
        currentAssignments
      );

      // Assign best candidates - BUT RESPECT CONTRACT LIMITS
      for (const candidate of candidates) {
        // 🔥 CRITICAL: Check contract limit before assignment
        const currentWorkload = employeeWorkload.get(candidate.id) || 0;
        const targetWorkload = employeeTargetAssignments.get(candidate.id) || 0;
        
        if (currentWorkload >= targetWorkload) {
          continue; // 🔥 VERTRAGSLIMIT erreicht - überspringen
        }

        if (this.canAssignEmployeeFlexible(candidate, shift, currentAssignments, employees, constraints)) {
          assignments[shift.id].push(candidate.id);
          employeeWorkload.set(candidate.id, currentWorkload + 1);
          report.push(`   🔄 ${candidate.name} zu Schicht ${shift.date} ${shift.timeSlotId} hinzugefügt`);
          
          // Check if we should stop assigning to this shift
          if (!this.shouldAssignMoreToShift(shift, assignments[shift.id], employees)) {
            break;
          }
        }
      }
    }
  }

  private static getFirstWeekShifts(shifts: ScheduledShift[]): ScheduledShift[] {
    if (shifts.length === 0) return [];
    
    // Sort by date and get the first 7 days
    const sortedShifts = [...shifts].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sortedShifts[0].date);
    const firstWeekEnd = new Date(firstDate);
    firstWeekEnd.setDate(firstWeekEnd.getDate() + 6); // 7 days total
    
    const firstWeekShifts = sortedShifts.filter(shift => {
      const shiftDate = new Date(shift.date);
      return shiftDate >= firstDate && shiftDate <= firstWeekEnd;
    });

    console.log('📅 First week analysis:', {
      totalShifts: shifts.length,
      firstWeekShifts: firstWeekShifts.length,
      dateRange: `${firstDate.toISOString().split('T')[0]} to ${firstWeekEnd.toISOString().split('T')[0]}`
    });

    return firstWeekShifts;
  }

  // 🔥 IMPROVED: Enhanced assignment with fallback options
  private static async assignToReachExactTargetNonNegotiable(
    employee: Employee,
    neededAssignments: number,
    scheduledShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    availabilityMap: Map<string, Map<string, number>>,
    allEmployees: Employee[],
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<number> {
    
    let assignedCount = 0;
    
    // 🔥 STRATEGY 1: Try preferred shifts first (Level 1)
    const preferredShifts = this.findOptimalShiftsForEmployeeFlexible(
      employee,
      scheduledShifts,
      assignments,
      availabilityMap,
      allEmployees,
      constraints
    );

    for (const shift of preferredShifts) {
      if (assignedCount >= neededAssignments) break;

      if (this.canAssignEmployeeFlexible(employee, shift, assignments[shift.id], allEmployees, constraints)) {
        assignments[shift.id].push(employee.id);
        employeeWorkload.set(employee.id, (employeeWorkload.get(employee.id) || 0) + 1);
        assignedCount++;
        report.push(`   ✅ ${employee.name} zu Schicht ${shift.date} ${shift.timeSlotId} zugewiesen (${assignedCount}/${neededAssignments})`);
      }
    }

    // 🔥 STRATEGY 2: If still need assignments, try Level 2 availability
    if (assignedCount < neededAssignments) {
      const availableShifts = scheduledShifts.filter(shift => {
        const currentAssignments = assignments[shift.id] || [];
        
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        const preference = availabilityMap.get(employee.id)?.get(shiftKey);
        
        // 🔥 FALLBACK: Accept Level 2 availability if needed
        return (preference === 1 || preference === 2) && 
              this.canAssignEmployeeFlexible(employee, shift, currentAssignments, allEmployees, constraints);
      });

      for (const shift of availableShifts) {
        if (assignedCount >= neededAssignments) break;

        if (!assignments[shift.id].includes(employee.id)) {
          assignments[shift.id].push(employee.id);
          employeeWorkload.set(employee.id, (employeeWorkload.get(employee.id) || 0) + 1);
          assignedCount++;
          report.push(`   🔄 ${employee.name} zu verfügbarer Schicht ${shift.date} ${shift.timeSlotId} zugewiesen (${assignedCount}/${neededAssignments})`);
        }
      }
    }

    return assignedCount;
  }

  // 🔥 IMPROVED: Find optimal shifts with better availability checking
  private static findOptimalShiftsForEmployeeFlexible(
    employee: Employee,
    scheduledShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    availabilityMap: Map<string, Map<string, number>>,
    allEmployees: Employee[],
    constraints: SchedulingConstraints
  ): ScheduledShift[] {
    
    return scheduledShifts
      .filter(shift => {
        const currentAssignments = assignments[shift.id] || [];
        
        // 🔥 IMPROVED: Better availability checking
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        const preference = availabilityMap.get(employee.id)?.get(shiftKey);
        
        // 🔥 ACCEPT BOTH Level 1 AND Level 2 availability
        if (preference === 3 || preference === undefined) return false;

        // Check if shift can benefit from this employee
        const shiftNeedsEmployee = this.doesShiftNeedThisEmployee(shift, employee, currentAssignments, allEmployees);
        if (!shiftNeedsEmployee) return false;

        // Check if assignment is compatible with business rules
        return this.canAssignEmployeeFlexible(employee, shift, currentAssignments, allEmployees, constraints);
      })
      .sort((a, b) => {
        // 🔥 IMPROVED: Prioritize by availability level AND current assignments
        const aCurrent = assignments[a.id]?.length || 0;
        const bCurrent = assignments[b.id]?.length || 0;
        
        const aDay = this.getDayOfWeek(a.date);
        const bDay = this.getDayOfWeek(b.date);
        const aPref = availabilityMap.get(employee.id)?.get(`${aDay}-${a.timeSlotId}`) || 3;
        const bPref = availabilityMap.get(employee.id)?.get(`${bDay}-${b.timeSlotId}`) || 3;

        // 🔥 Level 1 availability first, then fewer current assignments
        if (aPref !== bPref) return aPref - bPref; // Lower preference number = better
        return aCurrent - bCurrent; // Fewer current assignments first
      });
  }

  // 🔥 Check if a shift specifically needs this employee
  private static doesShiftNeedThisEmployee(
    shift: ScheduledShift,
    employee: Employee,
    currentAssignments: string[],
    allEmployees: Employee[]
  ): boolean {
    const currentCount = currentAssignments.length;
    
    // If shift is empty, definitely needs this employee
    if (currentCount === 0) return true;
    
    // If shift has one employee who cannot work alone, needs another
    if (currentCount === 1) {
      const currentEmployee = allEmployees.find(emp => emp.id === currentAssignments[0]);
      if (currentEmployee && !currentEmployee.canWorkAlone) {
        return true;
      }
    }
    
    // 🔥 ENHANCED: Check if shift can have more employees
    const canHaveMore = this.canShiftHaveMoreEmployees(shift, currentAssignments, allEmployees);
    if (!canHaveMore) return false;
    
    // 🔥 SPECIAL: If shift has manager, prefer experienced employees
    const hasManager = currentAssignments.some(id => {
      const emp = allEmployees.find(e => e.id === id);
      return emp && emp.role === 'admin';
    });
    
    if (hasManager && employee.employeeType === 'experienced') {
      return true; // 🔥 Manager-Schicht braucht erfahrene Unterstützung
    }
    
    // If shift already has 2 employees, only add if it brings special value
    if (currentCount >= 2) {
      return employee.canWorkAlone || employee.employeeType === 'experienced';
    }
    
    return true;
  }

  // Find optimal shifts for employee - NON-NEGOTIABLE version (respects all limits strictly)
  private static findOptimalShiftsForEmployeeNonNegotiable(
    employee: Employee,
    scheduledShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    availabilityMap: Map<string, Map<string, number>>,
    allEmployees: Employee[],
    constraints: SchedulingConstraints
  ): ScheduledShift[] {
    
    return scheduledShifts
      .filter(shift => {
        // Check if shift needs more employees
        const currentAssignments = assignments[shift.id] || [];
        if (currentAssignments.length >= shift.requiredEmployees) return false;

        // Check availability
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        const preference = availabilityMap.get(employee.id)?.get(shiftKey);
        if (preference === 3 || preference === undefined) return false;

        // Check if assignment is compatible with business rules
        return this.canAssignEmployee(employee, shift, currentAssignments, allEmployees, constraints);
      })
      .sort((a, b) => {
        // Prioritize shifts where employee is most needed and most available
        const aCurrent = assignments[a.id]?.length || 0;
        const bCurrent = assignments[b.id]?.length || 0;
        const aNeeded = a.requiredEmployees - aCurrent;
        const bNeeded = b.requiredEmployees - bCurrent;

        // Also consider availability preference
        const aDay = this.getDayOfWeek(a.date);
        const bDay = this.getDayOfWeek(b.date);
        const aPref = availabilityMap.get(employee.id)?.get(`${aDay}-${a.timeSlotId}`) || 3;
        const bPref = availabilityMap.get(employee.id)?.get(`${bDay}-${b.timeSlotId}`) || 3;

        // Higher need and better preference first
        if (aNeeded !== bNeeded) return bNeeded - aNeeded;
        return aPref - bPref; // Lower preference number = better
      });
  }

  // Fill remaining shifts WITHOUT violating contract limits
  private static async fillRemainingShiftsNonNegotiable(
    scheduledShifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    const employeesWithCapacity = employees.filter(emp => {
      const current = employeeWorkload.get(emp.id) || 0;
      const target = employeeTargetAssignments.get(emp.id) || 0;
      return current < target; // Only employees who haven't reached their exact target
    });

    report.push(`👥 ${employeesWithCapacity.length} Mitarbeiter haben noch Kapazität für Vertragserfüllung`);

    // Fill shifts that are still understaffed
    for (const shift of scheduledShifts) {
      const currentAssignments = assignments[shift.id] || [];
      const needed = shift.requiredEmployees - currentAssignments.length;

      if (needed <= 0) continue;

      const availableEmployees = this.findAvailableEmployeesForShiftNonNegotiable(
        shift,
        employeesWithCapacity,
        availabilityMap,
        employeeWorkload,
        employeeTargetAssignments
      );

      const candidates = this.scoreCandidatesNonNegotiable(
        availableEmployees,
        shift,
        availabilityMap,
        employeeWorkload
      );

      for (let i = 0; i < Math.min(needed, candidates.length); i++) {
        const candidate = candidates[i];
        if (this.canAssignEmployee(candidate, shift, currentAssignments, employees, constraints)) {
          assignments[shift.id].push(candidate.id);
          employeeWorkload.set(candidate.id, (employeeWorkload.get(candidate.id) || 0) + 1);
          report.push(`   🔄 ${candidate.name} zu unterbesetzter Schicht hinzugefügt`);
        }
      }
    }
  }

  // Find available employees for shift - NON-NEGOTIABLE version
  private static findAvailableEmployeesForShiftNonNegotiable(
    shift: ScheduledShift,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>
  ): Employee[] {
    
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    
    return employees.filter(employee => {
      // Check availability
      const preference = availabilityMap.get(employee.id)?.get(shiftKey);
      if (preference === 3 || preference === undefined) return false;

      // Check contract capacity (NON-NEGOTIABLE)
      const current = employeeWorkload.get(employee.id) || 0;
      const target = employeeTargetAssignments.get(employee.id) || 0;
      if (current >= target) return false; // STRICT: No exceeding contract limits

      return true;
    });
  }

  // Score candidates - NON-NEGOTIABLE version
  private static scoreCandidatesNonNegotiable(
    employees: Employee[],
    shift: ScheduledShift,
    availabilityMap: Map<string, Map<string, number>>,
    employeeWorkload: Map<string, number>
  ): Employee[] {
    
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    
    return employees
      .map(employee => {
        let score = 0;
        
        // Availability preference (Level 1 = +10, Level 2 = +5)
        const preference = availabilityMap.get(employee.id)?.get(shiftKey) || 3;
        if (preference === 1) score += 10;
        if (preference === 2) score += 5;
        
        // Experience bonus
        if (employee.employeeType === 'experienced') score += 3;
        
        // Workload distribution (favor those closer to their target)
        const currentWorkload = employeeWorkload.get(employee.id) || 0;
        const maxWorkload = this.getExactContractAssignments(employee);
        const workloadRatio = currentWorkload / maxWorkload;
        score += (1 - workloadRatio) * 5; // Higher score for underutilized
        
        return { employee, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(item => item.employee);
  }

  // PHASE C: Final Validation (NO adjustments allowed)
  private static async phaseCFinalValidation(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints,
    report: string[],
    violations: string[],
    firstWeekShifts: ScheduledShift[] // 🔥 Nur erste Woche
  ): Promise<{ [shiftId: string]: string[] }> {
    
    report.push('🔍 FINALE VALIDIERUNG: Überprüfe alle nicht verhandelbaren Regeln - NUR ERSTE WOCHE');

    // Validate only FIRST WEEK assignments
    this.validateNoEmptyShifts(assignments, violations, report, firstWeekShifts);
    this.validateNoTraineeAlone(assignments, employees, violations, report, firstWeekShifts);
    this.validateNoManagerAlone(assignments, employees, violations, report, firstWeekShifts);
    this.validateAvailability(assignments, employees, availabilities, violations, report, firstWeekShifts);

    return assignments;
  }

  // Final validation with NON-NEGOTIABLE contract limit checking
  private static finalNonNegotiableContractValidation(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    violations: string[],
    report: string[],
    firstWeekShifts: ScheduledShift[]
  ): void {
    
    // Calculate workload from FIRST WEEK only
    const employeeWorkload = new Map<string, number>();
    
    // Count assignments only from FIRST WEEK
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      assignedEmployees.forEach(employeeId => {
        employeeWorkload.set(employeeId, (employeeWorkload.get(employeeId) || 0) + 1);
      });
    });

    const contractStatus = employees.map(employee => {
      const actual = employeeWorkload.get(employee.id) || 0;
      const target = this.getExactContractAssignments(employee);
      
      // 🔥 MANAGERS: No deviation calculation (they have no limits)
      const deviation = employee.role === 'admin' ? 0 : actual - target;

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        actual,
        target,
        deviation,
        isManager: employee.role === 'admin'
      };
    });

    // 🔥 FILTER OUT MANAGERS from contract validation
    const nonManagerContractStatus = contractStatus.filter(status => !status.isManager);
    const exactContractViolations = nonManagerContractStatus.filter(status => status.deviation !== 0);

    report.push(`📋 NICHT VERHANDELBARE Vertragsvalidierung: ${exactContractViolations.length} Abweichungen`);

    exactContractViolations.forEach(status => {
      const violation = `${this.CRITICAL_VIOLATIONS.CONTRACT_LIMIT_VIOLATION}: ${status.employeeName} (${status.actual}/${status.target})`;
      violations.push(violation);
      report.push(`   🚨 ${violation}`);
    });

    // Separate info for managers
    const managerStatus = contractStatus.filter(status => status.isManager);
    managerStatus.forEach(status => {
      report.push(`   👔 Manager ${status.employeeName}: ${status.actual} preferred Schichten zugewiesen`);
    });

    // Report successful contract fulfillment
    const successfulContracts = nonManagerContractStatus.filter(status => status.deviation === 0);
    successfulContracts.forEach(status => {
      report.push(`   ✅ ${status.employeeName}: ${status.actual}/${status.target} Vertrag erfüllt`);
    });

    if (exactContractViolations.length === 0) {
      report.push('✅ ALLE NICHT VERHANDELBAREN VERTRAGSGRENZEN EINGEHALTEN!');
    } else {
      report.push('❌ VERTRAGSGRENZEN NICHT EINGEHALTEN: Plan kann nicht veröffentlicht werden');
    }
  }

  private static validateNoTraineeAlone(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    violations: string[],
    report: string[],
    firstWeekShifts: ScheduledShift[] // 🔥 Nur erste Woche prüfen
  ): void {
    let traineeAloneCount = 0;
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // Check only FIRST WEEK shifts
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      if (assignedEmployees.length === 1) {
        const employee = employeeMap.get(assignedEmployees[0]);
        if (employee && employee.employeeType === 'trainee') {
          traineeAloneCount++;
        }
      }
    });

    if (traineeAloneCount > 0) {
      violations.push(`${this.CRITICAL_VIOLATIONS.TRAINEE_ALONE}: ${traineeAloneCount} Schichten in erster Woche`);
      report.push(`🚨 ${traineeAloneCount} Schichten mit allein arbeitendem Trainee in erster Woche`);
    } else {
      report.push('✅ Keine allein arbeitenden Trainees in erster Woche');
    }
  }

  private static validateNoManagerAlone(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    violations: string[],
    report: string[],
    firstWeekShifts: ScheduledShift[] // 🔥 Parameter hinzufügen
  ): void {
    let managerAloneCount = 0;
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // 🔥 Nur erste Woche prüfen
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      if (assignedEmployees.length === 1) {
        const employee = employeeMap.get(assignedEmployees[0]);
        if (employee && employee.role === 'admin') {
          managerAloneCount++;
        }
      }
    });

    if (managerAloneCount > 0) {
      violations.push(`${this.CRITICAL_VIOLATIONS.MANAGER_ALONE}: ${managerAloneCount} Schichten in erster Woche`);
      report.push(`🚨 ${managerAloneCount} Schichten mit allein arbeitendem Manager in erster Woche`);
    } else {
      report.push('✅ Keine allein arbeitenden Manager in erster Woche');
    }
  }

  private static validateAvailability(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    violations: string[],
    report: string[],
    firstWeekShifts: ScheduledShift[] // 🔥 Parameter hinzufügen
  ): void {
    let availabilityViolations = 0;
    const availabilityMap = this.buildAdvancedAvailabilityMap(availabilities);
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // 🔥 Nur erste Woche prüfen
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      
      assignedEmployees.forEach(employeeId => {
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        const preference = availabilityMap.get(employeeId)?.get(shiftKey);

        if (preference === 3) {
          const employee = employeeMap.get(employeeId);
          availabilityViolations++;
          violations.push(`${this.CRITICAL_VIOLATIONS.UNAVAILABLE_ASSIGNMENT}: ${employee?.name || employeeId} in erster Woche`);
        }
      });
    });

    if (availabilityViolations > 0) {
      report.push(`🚨 ${availabilityViolations} Verfügbarkeitsverletzungen in erster Woche`);
    } else {
      report.push('✅ Keine Verfügbarkeitsverletzungen in erster Woche');
    }
  }

  // Get EXACT contract assignments (NON-NEGOTIABLE)
  private static getExactContractAssignments(employee: Employee): number {
    // 🔥 MANAGER EXEMPTION: Managers have NO contract limits at all
    if (employee.role === 'admin') {
      console.log(`👔 Manager ${employee.name} has NO contract limits`);
      return 0; // 🔥 0 means no limit checking for managers
    }
    
    switch (employee.contractType) {
      case 'small': return 1;
      case 'large': return 2;
      default: return 2;
    }
  }

  private static validateNoEmptyShifts(
    assignments: { [shiftId: string]: string[] },
    violations: string[],
    report: string[],
    firstWeekShifts: ScheduledShift[] // 🔥 Nur erste Woche prüfen
  ): void {
    // Check only FIRST WEEK shifts
    const emptyShifts = firstWeekShifts.filter(shift => 
      !assignments[shift.id] || assignments[shift.id].length === 0
    ).length;

    if (emptyShifts > 0) {
      report.push(`ℹ️ ${emptyShifts} leere Schichten in erster Woche (OK für Vorschau)`);
    } else {
      report.push('✅ Keine leeren Schichten in erster Woche');
    }
  }

  // 🔥 FLEXIBLE RULE 1: Does shift need more employees?
  private static doesShiftNeedMoreEmployees(
    shift: ScheduledShift,
    currentAssignments: string[],
    allEmployees: Employee[]
  ): boolean {
    const currentCount = currentAssignments.length;
    
    // 🔥 RULE 1a: If no employees assigned, definitely needs at least one
    if (currentCount === 0) return true;
    
    // 🔥 RULE 1b: If only one employee, check if they can work alone
    if (currentCount === 1) {
      const soloEmployee = allEmployees.find(emp => emp.id === currentAssignments[0]);
      if (soloEmployee && !soloEmployee.canWorkAlone) {
        return true; // Needs another employee if current one cannot work alone
      }
    }
    
    // 🔥 RULE 1c: Check if shift can have more employees based on manager/special cases
    return this.canShiftHaveMoreEmployees(shift, currentAssignments, allEmployees);
  }

  // 🔥 FLEXIBLE RULE 2: Enhanced employee availability check
  private static findAvailableEmployeesForShiftFlexible(
    shift: ScheduledShift,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    currentAssignments: string[]
  ): Employee[] {
    
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    
    return employees.filter(employee => {
      // Skip if already assigned to this shift
      if (currentAssignments.includes(employee.id)) return false;
      
      // Check availability
      const preference = availabilityMap.get(employee.id)?.get(shiftKey);
      if (preference === 3 || preference === undefined) return false;

      // 🔥 STRICT CONTRACT LIMIT CHECK
      const current = employeeWorkload.get(employee.id) || 0;
      const target = employeeTargetAssignments.get(employee.id) || 0;
      if (current >= target) return false; // 🔥 VERTRAGSLIMIT erreicht

      return true;
    });
  }

  // 🔥 FLEXIBLE RULE 3: Enhanced candidate scoring
  private static scoreCandidatesFlexible(
    employees: Employee[],
    shift: ScheduledShift,
    availabilityMap: Map<string, Map<string, number>>,
    employeeWorkload: Map<string, number>,
    currentAssignments: string[]
  ): Employee[] {
    
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    const allEmployees = Array.from(employeeWorkload.keys()).map(id => 
      employees.find(emp => emp.id === id)
    ).filter(Boolean) as Employee[];
    
    return employees
      .map(employee => {
        let score = 0;
        
        // Availability preference (Level 1 = +20, Level 2 = +10)
        const preference = availabilityMap.get(employee.id)?.get(shiftKey) || 3;
        if (preference === 1) score += 20;
        if (preference === 2) score += 10;
        
        // Experience bonus
        if (employee.employeeType === 'experienced') score += 5;
        
        // Can work alone bonus
        if (employee.canWorkAlone) score += 3;
        
        // Contract progress bonus
        const currentWorkload = employeeWorkload.get(employee.id) || 0;
        const maxWorkload = this.getExactContractAssignments(employee);
        const workloadRatio = currentWorkload / Math.max(1, maxWorkload);
        score += (1 - workloadRatio) * 8;
        
        // 🔥 ENHANCED: Team compatibility with current assignments
        if (currentAssignments.length > 0) {
          const compatibilityBonus = this.calculateTeamCompatibility(employee, currentAssignments, allEmployees);
          score += compatibilityBonus;
          
          // 🔥 SPECIAL: Extra bonus for experienced with manager
          const hasManager = currentAssignments.some(id => {
            const emp = allEmployees.find(e => e.id === id);
            return emp && emp.role === 'admin';
          });
          if (hasManager && employee.employeeType === 'experienced') {
            score += 4; // 🔥 Erfahrener mit Manager = Sehr gut
          }
        }
        
        return { employee, score };
      })
      .sort((a, b) => b.score - a.score)
      .map(item => item.employee);
  }

  // 🔥 FLEXIBLE RULE 6: Team compatibility scoring
  private static calculateTeamCompatibility(
    candidate: Employee,
    currentAssignments: string[],
    allEmployees: Employee[]
  ): number {
    let compatibilityScore = 0;
    
    const currentEmployees = currentAssignments.map(id => 
      allEmployees.find(emp => emp.id === id)
    ).filter(Boolean) as Employee[];
    
    // 🔥 PRIMÄR: Hoher Bonus wenn Manager im Team ist und Kandidat Erfahrung hat
    const hasManager = currentEmployees.some(emp => emp.role === 'admin');
    if (hasManager && candidate.employeeType === 'experienced') {
      compatibilityScore += 5; // 🔥 Manager + Erfahrener = Optimal
    }
    
    // 🔥 Mix von Erfahrungsstufen
    const hasExperienced = currentEmployees.some(emp => emp.employeeType === 'experienced');
    const hasTrainee = currentEmployees.some(emp => emp.employeeType === 'trainee');
    
    if (candidate.employeeType === 'experienced' && hasTrainee) {
      compatibilityScore += 3; // Erfahrener kann Trainee unterstützen
    }
    
    if (candidate.employeeType === 'trainee' && hasExperienced) {
      compatibilityScore += 2; // Trainee mit Erfahrenem ist gut
    }
    
    // 🔥 Flexible Employees die alleine arbeiten können
    if (candidate.canWorkAlone) {
      compatibilityScore += 2;
    }
    
    // 🔥 Vermeide zu viele Erfahrene in einer Schicht (Overstaffing)
    const experiencedCount = currentEmployees.filter(emp => emp.employeeType === 'experienced').length;
    if (candidate.employeeType === 'experienced' && experiencedCount >= 1 && !hasManager) {
      compatibilityScore -= 2; // Zu viele Erfahrene ohne Manager
    }
    
    return compatibilityScore;
  }

  // 🔥 FLEXIBLE RULE 4: Enhanced assignment checking with canWorkAlone
  private static canAssignEmployeeFlexible(
    employee: Employee,
    shift: ScheduledShift,
    currentAssignments: string[],
    allEmployees: Employee[],
    constraints: SchedulingConstraints
  ): boolean {
    
    // 🔥 CRITICAL RULE: Employee can ONLY work alone if canWorkAlone is true
    if (currentAssignments.length === 0 && !employee.canWorkAlone) {
      return false; // Cannot assign as first employee if cannot work alone
    }
    
    // Check if assignment would create trainee-alone situation
    if (constraints.enforceNoTraineeAlone) {
      if (employee.employeeType === 'trainee' && currentAssignments.length === 0) {
        return false; // Can't assign trainee as first employee
      }
      
      if (employee.employeeType === 'trainee' && currentAssignments.length > 0) {
        const currentEmployees = currentAssignments.map(id => 
          allEmployees.find(emp => emp.id === id)
        ).filter(Boolean) as Employee[];
        
        const hasExperienced = currentEmployees.some(emp => 
          emp.employeeType === 'experienced' || emp.role === 'admin'
        );
        
        if (!hasExperienced) return false;
      }
    }
    
    return true;
  }

  // 🔥 FLEXIBLE RULE 5: Should we assign more employees to this shift?
  private static shouldAssignMoreToShift(
    shift: ScheduledShift,
    currentAssignments: string[],
    allEmployees: Employee[]
  ): boolean {
    const currentCount = currentAssignments.length;
    
    // 🔥 Ideal: 2 employees per shift
    if (currentCount >= 2) {
      // 🔥 PRIMÄR: Nur bis zu 3 Employees wenn Manager dabei ist
      const hasManager = currentAssignments.some(employeeId => {
        const employee = allEmployees.find(emp => emp.id === employeeId);
        return employee && employee.role === 'admin';
      });
      
      if (hasManager && currentCount < 3) {
        return true; // 🔥 Manager ist dabei - kann bis zu 3 Employees haben
      }
      
      // 🔥 SEKUNDÄR: Bis zu 3 Employees mit anderen Mitarbeitern nur in speziellen Fällen
      const hasSpecialCase = this.hasSpecialCaseForThirdEmployee(shift, currentAssignments, allEmployees);
      if (hasSpecialCase && currentCount < 3) {
        return true; // 🔥 Spezialfall erlaubt dritten Employee
      }
      
      return false; // Maximale Besetzung erreicht
    }
    
    // 🔥 Minimum: At least one employee who can work alone, or two employees
    if (currentCount === 1) {
      const currentEmployee = allEmployees.find(emp => emp.id === currentAssignments[0]);
      if (currentEmployee && currentEmployee.canWorkAlone) {
        return false; // Shift is adequately staffed with one employee who can work alone
      }
    }
    
    return currentCount < 2; // Standard: Bis zu 2 Employees
  }

  // 🔥 Neue Methode: Kann Schicht mehr Employees haben?
  private static canShiftHaveMoreEmployees(
    shift: ScheduledShift,
    currentAssignments: string[],
    allEmployees: Employee[]
  ): boolean {
    const currentCount = currentAssignments.length;
    
    // Standard: Maximale Besetzung ist 2
    if (currentCount >= 2) {
      // 🔥 PRIMÄR: Bis zu 3 wenn Manager dabei
      const hasManager = currentAssignments.some(employeeId => {
        const employee = allEmployees.find(emp => emp.id === employeeId);
        return employee && employee.role === 'admin';
      });
      
      if (hasManager) {
        return currentCount < allEmployees.length; // 🔥 Manager-Schicht: Bis zu 3 Employees
      }
      
      // 🔥 SEKUNDÄR: Bis zu 3 in speziellen Fällen
      const hasSpecialCase = this.hasSpecialCaseForThirdEmployee(shift, currentAssignments, allEmployees);
      if (hasSpecialCase) {
        return currentCount < 3; // 🔥 Spezialfall: Bis zu 3 Employees
      }
      
      return false; // Maximale Besetzung erreicht
    }
    
    return currentCount < 2; // Standard: Bis zu 2 Employees
  }

  // 🔥 FLEXIBLE RULE 6: Special cases for third employee (without manager)
  private static hasSpecialCaseForThirdEmployee(
    shift: ScheduledShift,
    currentAssignments: string[],
    allEmployees: Employee[]
  ): boolean {
    const currentEmployees = currentAssignments.map(id => 
      allEmployees.find(emp => emp.id === id)
    ).filter(Boolean) as Employee[];
    
    // 🔥 SEKUNDÄR: Dritter Employee nur in folgenden Fällen:
    
    // Fall 1: Shift hat viele Trainees die Unterstützung brauchen
    const traineeCount = currentEmployees.filter(emp => emp.employeeType === 'trainee').length;
    if (traineeCount >= 1) {
      return true; // Braucht erfahrene Unterstützung
    }
    
    // Fall 2: Besondere Schichtanforderungen (z.B. Wochenende, Feiertag)
    const isSpecialShift = this.isSpecialShift(shift);
    if (isSpecialShift) {
      return true; // Besondere Schichten können mehr Personal brauchen
    }
    
    // Fall 3: Mix von Erfahrungsstufen für besseres Training
    const experienceMix = this.hasGoodExperienceMix(currentEmployees);
    if (!experienceMix) {
      return true; // Kann von zusätzlicher Erfahrung profitieren
    }
    
    return false; // Kein Spezialfall für dritten Employee
  }

  // 🔥 Hilfsmethode: Besondere Schichten identifizieren
  private static isSpecialShift(shift: ScheduledShift): boolean {
    const date = new Date(shift.date);
    const dayOfWeek = date.getDay();
    
    // Wochenende (Samstag = 6, Sonntag = 0)
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      return true;
    }
    
    // Spätschichten (nach 18 Uhr) - müsste an TimeSlot angepasst werden
    // Hier als Beispiel für erweiterte Logik
    const timeSlot = shift.timeSlotId; // Hier müsste man die tatsächliche Zeit aus dem TimeSlot holen
    // Beispiel: if (timeSlot.includes('evening') || timeSlot.includes('late')) return true;
    
    return false;
  }

  // 🔥 Hilfsmethode: Gute Erfahrungs-Mischung im Team
  private static hasGoodExperienceMix(currentEmployees: Employee[]): boolean {
    if (currentEmployees.length < 2) return false;
    
    const hasExperienced = currentEmployees.some(emp => emp.employeeType === 'experienced');
    const hasTrainee = currentEmployees.some(emp => emp.employeeType === 'trainee');
    
    // Gute Mischung: Mindestens ein Erfahrener und ein Trainee, oder zwei Erfahrene
    return (hasExperienced && hasTrainee) || 
          currentEmployees.filter(emp => emp.employeeType === 'experienced').length >= 2;
  }
}

// Enhanced interfaces
interface ContractStatus {
  employeeId: string;
  employeeName: string;
  actual: number;
  target: number;
  deviation: number;
}

export interface SchedulingConstraints {
  enforceNoTraineeAlone: boolean;
  enforceExperiencedWithChef: boolean;
  maxRepairAttempts: number;
  targetEmployeesPerShift: number;
  prioritizePreferences: boolean;
  enforceExactContractLimits: boolean;
}

export interface SchedulingResult {
  assignments: { [shiftId: string]: string[] };
  violations: string[];
  success: boolean;
  resolutionReport: string[];
  qualityMetrics: QualityMetrics;
}

export interface QualityMetrics {
  coverageRate: number;
  perfectAssignmentRate: number;
  workloadDistributionScore: number;
  totalAssignments: number;
  criticalViolations: number;
}

export interface AssignmentResult {
  assignments: { [shiftId: string]: string[] };
  violations: string[];
  success: boolean;
  pattern?: WeeklyPattern;
  resolutionReport?: string[];
  qualityMetrics?: QualityMetrics;
}

export interface WeeklyPattern {
  weekShifts: ScheduledShift[];
  assignments: { [shiftId: string]: string[] };
  weekNumber: number;
}

export interface SchedulingConstraints {
  enforceNoTraineeAlone: boolean;
  enforceExperiencedWithChef: boolean;
  maxRepairAttempts: number;
  targetEmployeesPerShift: number;
  prioritizePreferences: boolean;
  enforceExactContractLimits: boolean;
}

export interface SchedulingResult {
  assignments: { [shiftId: string]: string[] };
  violations: string[];
  success: boolean;
  resolutionReport: string[];
  qualityMetrics: QualityMetrics;
}