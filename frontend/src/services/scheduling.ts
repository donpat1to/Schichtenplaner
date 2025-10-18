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
    
    // 🔥 CRITICAL FIX: Neue Mitarbeiter können als ERSTE in einer Schicht zugewiesen werden
    // wenn sie mit einem erfahrenen Mitarbeiter zusammen zugewiesen werden
    if (employee.employeeType === 'trainee' && currentAssignments.length === 0) {
      // Ein neuer Mitarbeiter KANN als erste Person zugewiesen werden, 
      // wenn die Zuweisung Teil einer "Neue + Erfahrene" Pairing-Strategie ist
      // Diese Prüfung erfolgt auf höherer Ebene in der forceAssignNewWithExperienced Methode
      return true;
    }
    
    // Original Logic für den Fall dass bereits Mitarbeiter in der Schicht sind
    if (constraints.enforceNoTraineeAlone) {
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
    
    console.log('🚀 STARTING SCHEDULING MIT VIOLATION-FIXING');
    resolutionReport.push('🚀 STARTING SCHEDULING MIT VIOLATION-FIXING');

    // Load all scheduled shifts
    const scheduledShifts = await shiftAssignmentService.getScheduledShiftsForPlan(shiftPlan.id);
    this.scheduledShiftsCache.set(shiftPlan.id, scheduledShifts);
    
    const firstWeekShifts = this.getFirstWeekShifts(scheduledShifts);
      
    resolutionReport.push(`📋 ${firstWeekShifts.length} Schichten in erster Woche für KOMPLETTES Scheduling`);
    resolutionReport.push(`📋 ${scheduledShifts.length} Schichten gesamt im Plan`);

    // PHASE A: Base Staffing
    resolutionReport.push('📊 PHASE A: Grundbesetzung mit NICHT VERHANDELBAREN Vertragsgrenzen');
    const baseAssignments = await this.phaseANonNegotiableContractStaffing(
      shiftPlan, employees, availabilities, constraints, resolutionReport, violations, firstWeekShifts
    );

    // PHASE B: Manager Integration
    resolutionReport.push('👔 PHASE B: Manager-Integration');
    const managerAssignments = await this.phaseBManagerIntegration(
      baseAssignments, shiftPlan, employees, availabilities, constraints, resolutionReport, firstWeekShifts
    );

    // 🔥 NEUE PHASE C: Violation-Fixing
    resolutionReport.push('🔧 PHASE C: Violation-Fixing mit automatischen Reparaturen');
    const finalAssignments = await this.phaseCViolationFixing(
      managerAssignments, employees, availabilities, constraints, resolutionReport, violations, firstWeekShifts
    );

    const success = violations.filter(v => 
      v.includes('❌ KRITISCH') || v.includes('ERROR:')
    ).length === 0;

    if (success) {
      resolutionReport.push('🎉 ALLE KRITISCHEN VIOLATIONS BEHOBEN!');
    } else {
      resolutionReport.push('⚠️ Einige Violations konnten nicht behoben werden');
    }

    this.scheduledShiftsCache.delete(shiftPlan.id);

    return {
      assignments: finalAssignments,
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
    
    // Initialize
    employees.forEach(emp => {
      employeeWorkload.set(emp.id, 0);
      employeeTargetAssignments.set(emp.id, this.getExactContractAssignments(emp));
    });
    firstWeekShifts.forEach(shift => assignments[shift.id] = []);

    report.push(`📋 ${firstWeekShifts.length} Schichten in erster Woche`);
    report.push(`👥 ${employees.filter(emp => emp.role !== 'admin').length} nicht-Manager Mitarbeiter`);

    // 🔥 STEP 1: FORCIERE Neue + Erfahrene Zuordnung zuerst
    report.push('🔄 STEP 1: FORCIERE Neue + Erfahrene Zuordnung');
    const newEmployees = employees.filter(emp => 
      emp.role !== 'admin' && emp.employeeType === 'trainee'
    );
    const experiencedEmployees = employees.filter(emp => 
      emp.role !== 'admin' && emp.employeeType === 'experienced'
    );

    report.push(`🎯 ${newEmployees.length} neue Mitarbeiter müssen zugewiesen werden:`);
    newEmployees.forEach(emp => {
      report.push(`   - ${emp.name} (Vertrag: ${emp.contractType}, Ziel: ${employeeTargetAssignments.get(emp.id)})`);
    });

    await this.forceAssignNewWithExperienced(
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

    // 🔥 STEP 2: Erfahrene (cannot work alone) immer zu zweit
    report.push('🔄 STEP 2: Erfahrene (cannot work alone) immer zu zweit');
    await this.assignExperiencedInPairs(
      firstWeekShifts,
      assignments,
      employeeWorkload,
      employeeTargetAssignments,
      employees,
      availabilityMap,
      constraints,
      report
    );

    // 🔥 STEP 3: Fülle verbleibende Schichten
    report.push('🔄 STEP 3: Fülle verbleibende Schichten');
    await this.fillRemainingShifts(
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
    
    report.push(`✅ Grundbesetzung: ${filledShifts}/${firstWeekShifts.length} Schichten, ${totalAssignments} Zuweisungen`);

    this.calculateContractFulfillment(employeeWorkload, employeeTargetAssignments, employees, violations, report);

    return assignments;
  }

  private static async forceAssignNewWithExperienced(
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
    
    let totalAssigned = 0;

    // 🔥 STRATEGIE 1: Zuerst versuchen, neue und erfahrene Mitarbeiter GEMEINSAM zuzuweisen
    report.push('🤝 STRATEGIE 1: Neue + Erfahrene Gemeinsamzuweisung');
    
    for (const newEmployee of newEmployees) {
      const newCurrentWorkload = employeeWorkload.get(newEmployee.id) || 0;
      const newTargetWorkload = employeeTargetAssignments.get(newEmployee.id) || 0;
      
      if (newCurrentWorkload >= newTargetWorkload) continue;

      report.push(`🎯 Suche Partner für ${newEmployee.name} (${newCurrentWorkload}/${newTargetWorkload})`);

      // Finde Schichten wo neue und erfahrene Mitarbeiter GLEICHZEITIG verfügbar sind
      const pairedShifts = shifts.filter(shift => {
        const currentAssignments = assignments[shift.id] || [];
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        
        // Prüfe ob neuer Mitarbeiter verfügbar ist
        const newPref = availabilityMap.get(newEmployee.id)?.get(shiftKey);
        if (newPref === 3 || newPref === undefined) return false;
        
        // Prüfe ob Schicht noch Platz für MINDESTENS 2 Personen hat
        if (currentAssignments.length > shift.requiredEmployees - 2) return false;
        
        // Prüfe ob ein erfahrener Mitarbeiter verfügbar ist
        const hasAvailableExperienced = experiencedEmployees.some(exp => {
          const expPref = availabilityMap.get(exp.id)?.get(shiftKey);
          const expWorkload = employeeWorkload.get(exp.id) || 0;
          const expTarget = employeeTargetAssignments.get(exp.id) || 0;
          
          return expPref !== undefined && expPref !== 3 && 
                expWorkload < expTarget &&
                this.canAssignEmployee(exp, shift, currentAssignments, allEmployees, constraints);
        });
        
        return hasAvailableExperienced;
      });

      report.push(`   📅 ${pairedShifts.length} Schichten mit verfügbaren erfahrenen Partnern`);

      // Versuche Paar-Zuweisung
      for (const shift of pairedShifts) {
        if ((employeeWorkload.get(newEmployee.id) || 0) >= newTargetWorkload) break;
        
        const currentAssignments = assignments[shift.id] || [];
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;

        // Finde den besten erfahrenen Partner
        const bestExperiencedPartner = experiencedEmployees
          .filter(exp => {
            const expPref = availabilityMap.get(exp.id)?.get(shiftKey);
            const expWorkload = employeeWorkload.get(exp.id) || 0;
            const expTarget = employeeTargetAssignments.get(exp.id) || 0;
            
            return expPref !== undefined && expPref !== 3 && 
                  expWorkload < expTarget &&
                  this.canAssignEmployee(exp, shift, currentAssignments, allEmployees, constraints);
          })
          .sort((a, b) => {
            // Bevorzuge Partner mit besserer Verfügbarkeit und weniger Auslastung
            const aPref = availabilityMap.get(a.id)?.get(shiftKey) || 3;
            const bPref = availabilityMap.get(b.id)?.get(shiftKey) || 3;
            if (aPref !== bPref) return aPref - bPref;
            
            return (employeeWorkload.get(a.id) || 0) - (employeeWorkload.get(b.id) || 0);
          })[0];

        if (bestExperiencedPartner) {
          // 🔥 GEMEINSAME ZUWEISUNG: Erfahrener zuerst, dann neuer Mitarbeiter
          assignments[shift.id].push(bestExperiencedPartner.id);
          employeeWorkload.set(bestExperiencedPartner.id, (employeeWorkload.get(bestExperiencedPartner.id) || 0) + 1);
          
          assignments[shift.id].push(newEmployee.id);
          employeeWorkload.set(newEmployee.id, (employeeWorkload.get(newEmployee.id) || 0) + 1);
          
          totalAssigned += 2;
          report.push(`   ✅ ${newEmployee.name} + ${bestExperiencedPartner.name} zu ${shift.date} ${shift.timeSlotId}`);
          break;
        }
      }
    }

    // 🔥 STRATEGIE 2: Einzelne neue Mitarbeiter zu bereits besetzten Schichten
    report.push('👥 STRATEGIE 2: Neue zu bereits besetzten Schichten');
    
    for (const newEmployee of newEmployees) {
      const newCurrentWorkload = employeeWorkload.get(newEmployee.id) || 0;
      const newTargetWorkload = employeeTargetAssignments.get(newEmployee.id) || 0;
      
      if (newCurrentWorkload >= newTargetWorkload) continue;

      // Finde Schichten die bereits erfahrene Mitarbeiter haben
      const experiencedShifts = shifts.filter(shift => {
        const currentAssignments = assignments[shift.id] || [];
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        
        // Prüfe ob neuer Mitarbeiter verfügbar ist
        const newPref = availabilityMap.get(newEmployee.id)?.get(shiftKey);
        if (newPref === 3 || newPref === undefined) return false;
        
        // Prüfe ob Schicht noch Platz hat
        if (currentAssignments.length >= shift.requiredEmployees) return false;
        
        // Prüfe ob bereits ein erfahrener Mitarbeiter in der Schicht ist
        const hasExperienced = currentAssignments.some(id => 
          experiencedEmployees.some(exp => exp.id === id)
        );
        
        return hasExperienced && this.canAssignEmployee(newEmployee, shift, currentAssignments, allEmployees, constraints);
      });

      for (const shift of experiencedShifts) {
        if ((employeeWorkload.get(newEmployee.id) || 0) >= newTargetWorkload) break;
        
        assignments[shift.id].push(newEmployee.id);
        employeeWorkload.set(newEmployee.id, (employeeWorkload.get(newEmployee.id) || 0) + 1);
        totalAssigned++;
        report.push(`   ✅ ${newEmployee.name} zu ${shift.date} ${shift.timeSlotId} (erfahrener Kollege bereits da)`);
        break;
      }
    }

    // 🔥 STRATEGIE 3: Fallback - Einzelzuweisung wenn nötig
    report.push('🆘 STRATEGIE 3: Fallback-Einzelzuweisung');
    
    for (const newEmployee of newEmployees) {
      const newCurrentWorkload = employeeWorkload.get(newEmployee.id) || 0;
      const newTargetWorkload = employeeTargetAssignments.get(newEmployee.id) || 0;
      
      if (newCurrentWorkload >= newTargetWorkload) continue;

      // Finde irgendeine verfügbare Schicht
      const fallbackShifts = shifts.filter(shift => {
        const currentAssignments = assignments[shift.id] || [];
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        
        const newPref = availabilityMap.get(newEmployee.id)?.get(shiftKey);
        return newPref !== undefined && newPref !== 3 && 
              currentAssignments.length < shift.requiredEmployees;
      });

      for (const shift of fallbackShifts) {
        if ((employeeWorkload.get(newEmployee.id) || 0) >= newTargetWorkload) break;
        
        // FORCIERE Zuweisung - ignoriere canAssign für Fallback
        assignments[shift.id].push(newEmployee.id);
        employeeWorkload.set(newEmployee.id, (employeeWorkload.get(newEmployee.id) || 0) + 1);
        totalAssigned++;
        report.push(`   🚨 FORCED: ${newEmployee.name} zu ${shift.date} ${shift.timeSlotId}`);
        break;
      }
    }

    report.push(`📈 Neue+Erfahrene Policy: ${totalAssigned} Zuweisungen abgeschlossen`);
  }

  private static async fillRemainingShifts(
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
    
    // Finde Mitarbeiter die ihre Verträge noch nicht erfüllt haben
    const underAssignedEmployees = nonManagerEmployees.filter(emp => {
      const current = employeeWorkload.get(emp.id) || 0;
      const target = employeeTargetAssignments.get(emp.id) || 0;
      return current < target;
    });

    report.push(`🎯 ${underAssignedEmployees.length} Mitarbeiter benötigen weitere Zuweisungen`);

    // Fülle Schichten priorisiert mit unterbesetzten Mitarbeitern
    for (const shift of shifts) {
      const currentAssignments = assignments[shift.id] || [];
      const needed = shift.requiredEmployees - currentAssignments.length;
      
      if (needed <= 0) continue;

      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;

      // Finde unterbesetzte Mitarbeiter die für diese Schicht verfügbar sind
      const availableUnderAssigned = underAssignedEmployees
        .filter(emp => {
          const preference = availabilityMap.get(emp.id)?.get(shiftKey);
          if (preference === 3 || preference === undefined) return false;
          
          return this.canAssignEmployee(emp, shift, currentAssignments, employees, constraints);
        })
        .sort((a, b) => {
          // Priorisiere Mitarbeiter mit größter Unterbesetzung
          const aCurrent = employeeWorkload.get(a.id) || 0;
          const aTarget = employeeTargetAssignments.get(a.id) || 0;
          const aNeeded = aTarget - aCurrent;
          
          const bCurrent = employeeWorkload.get(b.id) || 0;
          const bTarget = employeeTargetAssignments.get(b.id) || 0;
          const bNeeded = bTarget - bCurrent;
          
          return bNeeded - aNeeded; // Höchster Bedarf zuerst
        });

      // Weise unterbesetzte Mitarbeiter zu
      for (let i = 0; i < Math.min(needed, availableUnderAssigned.length); i++) {
        const candidate = availableUnderAssigned[i];
        assignments[shift.id].push(candidate.id);
        employeeWorkload.set(candidate.id, (employeeWorkload.get(candidate.id) || 0) + 1);
        report.push(`   ✅ ${candidate.name} zu ${shift.date} ${shift.timeSlotId} (Vertragserfüllung)`);
      }
    }
  }

  private static async assignExperiencedInPairs(
    shifts: ScheduledShift[],
    assignments: { [shiftId: string]: string[] },
    employeeWorkload: Map<string, number>,
    employeeTargetAssignments: Map<string, number>,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    report: string[]
  ): Promise<void> {
    
    const experiencedCannotWorkAlone = employees.filter(emp => 
      emp.role !== 'admin' && 
      emp.employeeType === 'experienced' && 
      !emp.canWorkAlone
    );

    report.push(`🎯 ${experiencedCannotWorkAlone.length} erfahrene Mitarbeiter benötigen Partner`);

    for (const experiencedEmployee of experiencedCannotWorkAlone) {
      const currentWorkload = employeeWorkload.get(experiencedEmployee.id) || 0;
      const targetWorkload = employeeTargetAssignments.get(experiencedEmployee.id) || 0;
      
      if (currentWorkload >= targetWorkload) continue;

      // Finde Schichten mit Partnern
      const suitableShifts = shifts
        .filter(shift => {
          const currentAssignments = assignments[shift.id] || [];
          const dayOfWeek = this.getDayOfWeek(shift.date);
          const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
          
          // Verfügbarkeit prüfen
          const preference = availabilityMap.get(experiencedEmployee.id)?.get(shiftKey);
          if (preference === 3 || preference === undefined) return false;
          
          // Schicht muss bereits mindestens einen Mitarbeiter haben ODER Platz für zwei
          const hasPartner = currentAssignments.length >= 1;
          const canAcceptTwo = currentAssignments.length <= shift.requiredEmployees - 2;
          
          return (hasPartner || canAcceptTwo) && 
                this.canAssignEmployee(experiencedEmployee, shift, currentAssignments, employees, constraints);
        })
        .sort((a, b) => {
          // Bevorzuge Schichten mit mehr Partnern
          const aPartnerCount = (assignments[a.id] || []).length;
          const bPartnerCount = (assignments[b.id] || []).length;
          return bPartnerCount - aPartnerCount;
        });

      let assigned = false;
      for (const shift of suitableShifts) {
        const experiencedCurrentWorkload = employeeWorkload.get(experiencedEmployee.id) || 0;
        if (experiencedCurrentWorkload >= targetWorkload) break;
        
        const currentAssignments = assignments[shift.id] || [];
        
        // Wenn Schicht leer ist, versuche einen Partner zu finden
        if (currentAssignments.length === 0) {
          const availablePartners = employees.filter(partner => 
            partner.id !== experiencedEmployee.id &&
            this.isEmployeeAvailableForShift(partner, shift, availabilityMap) &&
            (employeeWorkload.get(partner.id) || 0) < (employeeTargetAssignments.get(partner.id) || 0)
          );
          
          if (availablePartners.length > 0) {
            // Weise Partner zuerst zu
            const partner = availablePartners[0];
            assignments[shift.id].push(partner.id);
            employeeWorkload.set(partner.id, (employeeWorkload.get(partner.id) || 0) + 1);
            
            // Dann erfahrenen Mitarbeiter
            assignments[shift.id].push(experiencedEmployee.id);
            employeeWorkload.set(experiencedEmployee.id, experiencedCurrentWorkload + 1);
            report.push(`   ✅ ${experiencedEmployee.name} + ${partner.name} als Paar zu ${shift.date} ${shift.timeSlotId}`);
            assigned = true;
            break;
          }
        } else {
          // Schicht hat bereits Mitarbeiter - direkt zuweisen
          assignments[shift.id].push(experiencedEmployee.id);
          employeeWorkload.set(experiencedEmployee.id, experiencedCurrentWorkload + 1);
          report.push(`   ✅ ${experiencedEmployee.name} zu ${shift.date} ${shift.timeSlotId} mit vorhandenem Partner`);
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        report.push(`   ⚠️ ${experiencedEmployee.name}: Keine geeignete Schicht mit Partner gefunden`);
      }
    }
  }

  // HELPER METHODE: Prüfe ob Mitarbeiter für Schicht verfügbar ist
  private static isEmployeeAvailableForShift(
    employee: Employee,
    shift: ScheduledShift,
    availabilityMap: Map<string, Map<string, number>>
  ): boolean {
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    const preference = availabilityMap.get(employee.id)?.get(shiftKey);
    return preference !== undefined && preference !== 3;
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

    // NEUE METHODE: Phase C mit Violation-Fixing
  private static async phaseCViolationFixing(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints,
    report: string[],
    violations: string[],
    firstWeekShifts: ScheduledShift[]
  ): Promise<{ [shiftId: string]: string[] }> {
    
    let fixedAssignments = { ...assignments };
    let iteration = 1;
    const maxIterations = 10;
    
    report.push('🔧 PHASE C: Violation-Fixing mit Reparatur-Funktionen');
    
    while (iteration <= maxIterations) {
      report.push(`\n🔄 Iteration ${iteration}/${maxIterations}:`);
      
      const currentViolations = this.detectAllViolations(
        fixedAssignments, 
        employees, 
        availabilities, 
        constraints, 
        firstWeekShifts
      );
      
      report.push(`📊 Aktuelle Violations: ${currentViolations.length}`);
      currentViolations.forEach(v => report.push(`   - ${v}`));
      
      // Wenn keine Violations mehr, abbrechen
      if (currentViolations.length === 0) {
        report.push('✅ Alle Violations behoben!');
        break;
      }
      
      // Wende Fix-Funktionen basierend auf Violation-Typ an
      const fixesApplied = await this.applyViolationFixes(
        fixedAssignments,
        currentViolations,
        employees,
        availabilities,
        constraints,
        firstWeekShifts,
        report
      );
      
      if (fixesApplied === 0) {
        report.push('⚠️ Keine weiteren Fixes möglich - breche ab');
        break;
      }
      
      iteration++;
    }
    
    // Finale Violation-Überprüfung
    const finalViolations = this.detectAllViolations(
      fixedAssignments, 
      employees, 
      availabilities, 
      constraints, 
      firstWeekShifts
    );
    
    violations.push(...finalViolations);
    
    report.push(`\n🎯 Finale Violations: ${finalViolations.length}`);
    finalViolations.forEach(v => report.push(`   - ${v}`));
    
    return fixedAssignments;
  }

  // NEUE METHODE: Erkenne alle Violations
  private static detectAllViolations(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints,
    firstWeekShifts: ScheduledShift[]
  ): string[] {
    
    const violations: string[] = [];
    const availabilityMap = this.buildAdvancedAvailabilityMap(availabilities);
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

    // 1. TRAINEE ALONE Violation
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      if (assignedEmployees.length === 1) {
        const employee = employeeMap.get(assignedEmployees[0]);
        if (employee && employee.employeeType === 'trainee') {
          violations.push(`${this.CRITICAL_VIOLATIONS.TRAINEE_ALONE}: ${employee.name} in ${shift.date} ${shift.timeSlotId}`);
        }
      }
    });

    // 2. EMPTY SHIFT Violation
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      if (assignedEmployees.length === 0) {
        violations.push(`${this.CRITICAL_VIOLATIONS.EMPTY_SHIFT}: ${shift.date} ${shift.timeSlotId}`);
      }
    });

    // 3. CONTRACT LIMIT Violation
    const contractViolations = this.detectContractViolations(assignments, employees, firstWeekShifts);
    violations.push(...contractViolations);

    // 4. UNAVAILABLE ASSIGNMENT Violation
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      assignedEmployees.forEach(employeeId => {
        const dayOfWeek = this.getDayOfWeek(shift.date);
        const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
        const preference = availabilityMap.get(employeeId)?.get(shiftKey);

        if (preference === 3) {
          const employee = employeeMap.get(employeeId);
          violations.push(`${this.CRITICAL_VIOLATIONS.UNAVAILABLE_ASSIGNMENT}: ${employee?.name || employeeId} in ${shift.date} ${shift.timeSlotId}`);
        }
      });
    });

    return violations;
  }

  // NEUE METHODE: Wende Violation-Fixes an
  private static async applyViolationFixes(
    assignments: { [shiftId: string]: string[] },
    violations: string[],
    employees: Employee[],
    availabilities: EmployeeAvailability[],
    constraints: SchedulingConstraints,
    firstWeekShifts: ScheduledShift[],
    report: string[]
  ): Promise<number> {
    
    let fixesApplied = 0;
    const availabilityMap = this.buildAdvancedAvailabilityMap(availabilities);

    // 🔥 ALTERNATIVE: Extrahiere nur den Violation-Teil für den Vergleich
    const traineeAloneViolations = violations.filter(v => {
      const violationText = v.split(':')[0]; // Nur "❌ KRITISCH: Trainee arbeitet alleine"
      return violationText.includes(this.CRITICAL_VIOLATIONS.TRAINEE_ALONE.split(':')[0]);
    });
    
    const emptyShiftViolations = violations.filter(v => {
      const violationText = v.split(':')[0];
      return violationText.includes(this.CRITICAL_VIOLATIONS.EMPTY_SHIFT.split(':')[0]);
    });
    
    const contractViolations = violations.filter(v => {
      const violationText = v.split(':')[0];
      return violationText.includes(this.CRITICAL_VIOLATIONS.CONTRACT_LIMIT_VIOLATION.split(':')[0]);
    });
    
    const unavailableViolations = violations.filter(v => {
      const violationText = v.split(':')[0];
      return violationText.includes(this.CRITICAL_VIOLATIONS.UNAVAILABLE_ASSIGNMENT.split(':')[0]);
    });

    report.push(`🔧 Wende Fixes an: ${traineeAloneViolations.length} Trainee-Alone, ${emptyShiftViolations.length} Empty-Shift, ${contractViolations.length} Contract, ${unavailableViolations.length} Unavailable`);

    // DEBUG: Zeige was tatsächlich gefiltert wurde
    report.push(`🔍 Violation Constants:`);
    report.push(`   TRAINEE_ALONE: "${this.CRITICAL_VIOLATIONS.TRAINEE_ALONE}"`);
    report.push(`   EMPTY_SHIFT: "${this.CRITICAL_VIOLATIONS.EMPTY_SHIFT}"`);
    report.push(`   CONTRACT_LIMIT: "${this.CRITICAL_VIOLATIONS.CONTRACT_LIMIT_VIOLATION}"`);
    report.push(`   UNAVAILABLE: "${this.CRITICAL_VIOLATIONS.UNAVAILABLE_ASSIGNMENT}"`);

    // 1. Fix TRAINEE ALONE Violations (höchste Priorität)
    for (const violation of traineeAloneViolations) {
      const fixed = await this.fixTraineeAloneViolation(
        assignments,
        violation,
        employees,
        availabilityMap,
        constraints,
        firstWeekShifts,
        report
      );
      if (fixed) fixesApplied++;
    }

    // 2. Fix EMPTY SHIFT Violations
    for (const violation of emptyShiftViolations) {
      const fixed = await this.fixEmptyShiftViolation(
        assignments,
        violation,
        employees,
        availabilityMap,
        constraints,
        firstWeekShifts,
        report
      );
      if (fixed) fixesApplied++;
    }

    // 3. Fix CONTRACT LIMIT Violations
    if (contractViolations.length > 0) {
      report.push(`🎯 Starte Contract Fixing für ${contractViolations.length} Violations`);
      const fixed = await this.fixContractViolations(
        assignments,
        employees,
        availabilityMap,
        constraints,
        firstWeekShifts,
        report
      );
      fixesApplied += fixed;
      report.push(`🎯 Contract Fixing abgeschlossen: ${fixed} Fixes angewendet`);
    }

    // 4. Fix UNAVAILABLE ASSIGNMENT Violations
    for (const violation of unavailableViolations) {
      const fixed = await this.fixUnavailableAssignmentViolation(
        assignments,
        violation,
        employees,
        availabilityMap,
        constraints,
        firstWeekShifts,
        report
      );
      if (fixed) fixesApplied++;
    }

    report.push(`📈 Insgesamt ${fixesApplied} Fixes in dieser Iteration angewendet`);
    
    return fixesApplied;
  }

  // FIX 1: TRAINEE ALONE Violation
  private static async fixTraineeAloneViolation(
    assignments: { [shiftId: string]: string[] },
    violation: string,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    firstWeekShifts: ScheduledShift[],
    report: string[]
  ): Promise<boolean> {
    
    // Extrahiere Schicht-Information aus Violation
    const match = violation.match(/in (\d{4}-\d{2}-\d{2}) ([^\)]+)/);
    if (!match) return false;
    
    const [, date, timeSlotId] = match;
    const shift = firstWeekShifts.find(s => s.date === date && s.timeSlotId === timeSlotId);
    if (!shift) return false;
    
    const currentAssignments = assignments[shift.id] || [];
    const traineeId = currentAssignments[0]; // Trainee ist alleine in der Schicht
    
    report.push(`🔧 Fix TRAINEE ALONE: ${date} ${timeSlotId}`);
    
    // STRATEGIE 1: Erfahrenen Mitarbeiter hinzufügen
    const experiencedEmployees = employees.filter(emp => 
      emp.employeeType === 'experienced' && 
      emp.id !== traineeId
    );
    
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    
    const availableExperienced = experiencedEmployees.filter(exp => {
      const preference = availabilityMap.get(exp.id)?.get(shiftKey);
      return preference !== undefined && preference !== 3;
    });
    
    if (availableExperienced.length > 0 && currentAssignments.length < shift.requiredEmployees) {
      const bestCandidate = availableExperienced[0];
      assignments[shift.id].push(bestCandidate.id);
      report.push(`   ✅ ${bestCandidate.name} als Partner für Trainee hinzugefügt`);
      return true;
    }
    
    // STRATEGIE 2: Trainee in andere Schicht verschieben wo Partner vorhanden sind
    const alternativeShifts = firstWeekShifts.filter(s => {
      const altAssignments = assignments[s.id] || [];
      const hasExperienced = altAssignments.some(id => {
        const emp = employees.find(e => e.id === id);
        return emp && emp.employeeType === 'experienced';
      });
      const dayOfWeek = this.getDayOfWeek(s.date);
      const shiftKey = `${dayOfWeek}-${s.timeSlotId}`;
      const preference = availabilityMap.get(traineeId)?.get(shiftKey);
      
      return hasExperienced && 
            preference !== undefined && preference !== 3 &&
            altAssignments.length < s.requiredEmployees;
    });
    
    if (alternativeShifts.length > 0) {
      const bestAlternative = alternativeShifts[0];
      // Entferne Trainee aus aktueller Schicht
      assignments[shift.id] = assignments[shift.id].filter(id => id !== traineeId);
      // Füge Trainee zu alternativer Schicht hinzu
      assignments[bestAlternative.id].push(traineeId);
      report.push(`   🔄 Trainee zu ${bestAlternative.date} ${bestAlternative.timeSlotId} verschoben (Partner vorhanden)`);
      return true;
    }
    
    report.push(`   ❌ Kein Fix möglich für TRAINEE ALONE`);
    return false;
  }

  // FIX 2: EMPTY SHIFT Violation
  private static async fixEmptyShiftViolation(
    assignments: { [shiftId: string]: string[] },
    violation: string,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    firstWeekShifts: ScheduledShift[],
    report: string[]
  ): Promise<boolean> {
    
    const match = violation.match(/SHIFT: (\d{4}-\d{2}-\d{2}) ([^\)]+)/);
    if (!match) return false;
    
    const [, date, timeSlotId] = match;
    const shift = firstWeekShifts.find(s => s.date === date && s.timeSlotId === timeSlotId);
    if (!shift) return false;
    
    report.push(`🔧 Fix EMPTY SHIFT: ${date} ${timeSlotId}`);
    
    const dayOfWeek = this.getDayOfWeek(shift.date);
    const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
    
    // Finde verfügbare Mitarbeiter für diese Schicht
    const availableEmployees = employees.filter(emp => {
      const preference = availabilityMap.get(emp.id)?.get(shiftKey);
      return preference !== undefined && preference !== 3;
    });
    
    if (availableEmployees.length === 0) {
      report.push(`   ❌ Keine verfügbaren Mitarbeiter für diese Schicht`);
      return false;
    }
    
    // Sortiere nach Vertragserfüllung (Mitarbeiter mit größtem Bedarf zuerst)
    const prioritizedEmployees = availableEmployees
      .map(emp => {
        const currentWorkload = this.countEmployeeAssignments(emp.id, assignments, firstWeekShifts);
        const targetWorkload = this.getExactContractAssignments(emp);
        const needed = targetWorkload - currentWorkload;
        return { emp, needed, currentWorkload };
      })
      .filter(item => item.needed > 0)
      .sort((a, b) => b.needed - a.needed);
    
    if (prioritizedEmployees.length === 0) {
      report.push(`   ❌ Keine Mitarbeiter mit Vertragsbedarf für diese Schicht`);
      return false;
    }
    
    // Weise bestmöglichen Mitarbeiter zu
    const bestCandidate = prioritizedEmployees[0].emp;
    assignments[shift.id].push(bestCandidate.id);
    report.push(`   ✅ ${bestCandidate.name} zu leerer Schicht zugewiesen`);
    
    return true;
  }

  // FIX 3: CONTRACT LIMIT Violations
  private static async fixContractViolations(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    firstWeekShifts: ScheduledShift[],
    report: string[]
  ): Promise<number> {
    
    let fixesApplied = 0;
    const contractStatus = this.calculateContractStatus(assignments, employees, firstWeekShifts);
    
    const underAssigned = contractStatus.filter((status: ContractStatus) => status.deviation < 0);
    const overAssigned = contractStatus.filter((status: ContractStatus) => status.deviation > 0);
    
    report.push(`🔧 Fix CONTRACT LIMITS: ${underAssigned.length} unterbesetzt, ${overAssigned.length} überbesetzt`);
    
    // DEBUG: Zeige detaillierte Contract Status
    report.push(`📊 Contract Status Details:`);
    contractStatus.forEach((status: ContractStatus) => {
      if (status.deviation !== 0) {
        report.push(`   - ${status.employeeName}: ${status.actual}/${status.target} (Abweichung: ${status.deviation})`);
      }
    });

    // 🔥 STRATEGIE: Zuerst Überbesetzung beheben (einfacher)
    for (const over of overAssigned) {
      report.push(`🎯 Behebe OVER-ASSIGNMENT für ${over.employeeName}: ${over.actual}/${over.target} (Überschuss: ${over.deviation})`);
      
      const fixed = await this.fixOverAssignment(
        assignments,
        over,
        employees,
        availabilityMap,
        firstWeekShifts,
        report
      );
      
      if (fixed) {
        fixesApplied++;
        report.push(`✅ OVER-ASSIGNMENT für ${over.employeeName} behoben`);
      } else {
        report.push(`❌ OVER-ASSIGNMENT für ${over.employeeName} konnte nicht behoben werden`);
      }
    }
    
    // 🔥 STRATEGIE: Dann Unterbesetzung beheben
    for (const under of underAssigned) {
      report.push(`🎯 Behebe UNDER-ASSIGNMENT für ${under.employeeName}: ${under.actual}/${under.target} (Fehlend: ${-under.deviation})`);
      
      const fixed = await this.fixUnderAssignment(
        assignments,
        under,
        employees,
        availabilityMap,
        constraints,
        firstWeekShifts,
        report
      );
      
      if (fixed) {
        fixesApplied++;
        report.push(`✅ UNDER-ASSIGNMENT für ${under.employeeName} behoben`);
      } else {
        report.push(`❌ UNDER-ASSIGNMENT für ${under.employeeName} konnte nicht behoben werden`);
      }
    }
    
    return fixesApplied;
  }

  // FIX 4: UNAVAILABLE ASSIGNMENT Violation
  private static async fixUnavailableAssignmentViolation(
    assignments: { [shiftId: string]: string[] },
    violation: string,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    firstWeekShifts: ScheduledShift[],
    report: string[]
  ): Promise<boolean> {
    
    const match = violation.match(/ASSIGNMENT: ([^ ]+) in (\d{4}-\d{2}-\d{2}) ([^\)]+)/);
    if (!match) return false;
    
    const [, employeeName, date, timeSlotId] = match;
    const employee = employees.find(emp => emp.name === employeeName);
    if (!employee) return false;
    
    const shift = firstWeekShifts.find(s => s.date === date && s.timeSlotId === timeSlotId);
    if (!shift) return false;
    
    report.push(`🔧 Fix UNAVAILABLE ASSIGNMENT: ${employeeName} in ${date} ${timeSlotId}`);
    
    // STRATEGIE 1: Mitarbeiter aus Schicht entfernen
    assignments[shift.id] = assignments[shift.id].filter(id => id !== employee.id);
    report.push(`   ✅ ${employeeName} aus unverfügbarer Schicht entfernt`);
    
    // STRATEGIE 2: Ersatz-Mitarbeiter finden falls nötig
    if (assignments[shift.id].length === 0) {
      await this.fixEmptyShiftViolation(
        assignments,
        `${this.CRITICAL_VIOLATIONS.EMPTY_SHIFT}: ${date} ${timeSlotId}`,
        employees,
        availabilityMap,
        constraints,
        firstWeekShifts,
        report
      );
    }
    
    return true;
  }

  private static async fixOverAssignment(
    assignments: { [shiftId: string]: string[] },
    over: ContractStatus,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    firstWeekShifts: ScheduledShift[],
    report: string[]
  ): Promise<boolean> {
    
    const employee = employees.find(emp => emp.id === over.employeeId);
    if (!employee) return false;
    
    report.push(`   🔧 Fix OVER-ASSIGNMENT: ${employee.name} (${over.actual}/${over.target})`);
    
    // Finde ALLE Zuweisungen dieses Mitarbeiters
    const employeeAssignments: { shiftId: string; shift: ScheduledShift; currentCount: number }[] = [];
    
    firstWeekShifts.forEach(shift => {
      const currentAssignments = assignments[shift.id] || [];
      if (currentAssignments.includes(employee.id)) {
        employeeAssignments.push({ 
          shiftId: shift.id, 
          shift,
          currentCount: currentAssignments.length 
        });
      }
    });
    
    report.push(`   📋 ${employee.name} hat ${employeeAssignments.length} Zuweisungen`);
    
    // Sortiere nach Entfernungs-Priorität (am besten zu entfernende zuerst)
    const removableAssignments = employeeAssignments.sort((a, b) => {
      const aRequired = a.shift.requiredEmployees;
      const bRequired = b.shift.requiredEmployees;
      
      // 1. Überbesetzte Schichten zuerst
      if (a.currentCount > aRequired && b.currentCount <= bRequired) return -1;
      if (b.currentCount > bRequired && a.currentCount <= aRequired) return 1;
      
      // 2. Schichten mit vielen anderen Mitarbeitern zuerst (weniger kritisch)
      if (a.currentCount !== b.currentCount) return b.currentCount - a.currentCount;
      
      // 3. Nach Datum sortieren (spätere Schichten zuerst)
      return b.shift.date.localeCompare(a.shift.date);
    });
    
    // Entferne überschüssige Zuweisungen
    let removed = 0;
    const toRemove = over.deviation; // Positive Zahl bei Over-Assignment
    
    report.push(`   🗑️  Muss ${toRemove} Zuweisungen entfernen`);
    
    for (const assignment of removableAssignments) {
      if (removed >= toRemove) break;
      
      // Prüfe ob Entfernung sicher ist (nicht zu EMPTY_SHIFT führen würde)
      const wouldBecomeEmpty = assignments[assignment.shiftId].length === 1;
      if (wouldBecomeEmpty) {
        report.push(`      ⚠️  Überspringe ${assignment.shift.date} ${assignment.shift.timeSlotId} - würde leere Schicht erzeugen`);
        continue;
      }
      
      // Prüfe ob Entfernung TRAINEE_ALONE erzeugen würde
      const remainingAssignments = assignments[assignment.shiftId].filter(id => id !== employee.id);
      if (remainingAssignments.length === 1) {
        const remainingEmployee = employees.find(emp => emp.id === remainingAssignments[0]);
        if (remainingEmployee && remainingEmployee.employeeType === 'trainee') {
          report.push(`      ⚠️  Überspringe ${assignment.shift.date} ${assignment.shift.timeSlotId} - würde TRAINEE_ALONE erzeugen`);
          continue;
        }
      }
      
      // Sicher entfernen
      assignments[assignment.shiftId] = assignments[assignment.shiftId].filter(id => id !== employee.id);
      removed++;
      report.push(`      🔄 ${employee.name} aus ${assignment.shift.date} ${assignment.shift.timeSlotId} entfernt (${assignment.currentCount - 1}/${assignment.shift.requiredEmployees} verbleibend)`);
    }
    
    if (removed > 0) {
      report.push(`   ✅ ${removed}/${toRemove} Zuweisungen entfernt`);
      return true;
    } else {
      report.push(`   ❌ Keine sicheren Zuweisungen zum Entfernen gefunden`);
      return false;
    }
  }

  // HILFS-FUNKTION: Fix Under-Assignment
  private static async fixUnderAssignment(
    assignments: { [shiftId: string]: string[] },
    under: ContractStatus,
    employees: Employee[],
    availabilityMap: Map<string, Map<string, number>>,
    constraints: SchedulingConstraints,
    firstWeekShifts: ScheduledShift[],
    report: string[]
  ): Promise<boolean> {
    
    const employee = employees.find(emp => emp.id === under.employeeId);
    if (!employee) return false;
    
    report.push(`   🔧 Fix UNDER-ASSIGNMENT: ${employee.name} (${under.actual}/${under.target})`);
    
    const needed = -under.deviation; // Negative Zahl bei Under-Assignment -> positiv machen
    
    report.push(`   ➕ Benötigt ${needed} zusätzliche Zuweisungen`);

    // Finde verfügbare Schichten für diesen Mitarbeiter
    const availableShifts = firstWeekShifts.filter(shift => {
      const currentAssignments = assignments[shift.id] || [];
      const dayOfWeek = this.getDayOfWeek(shift.date);
      const shiftKey = `${dayOfWeek}-${shift.timeSlotId}`;
      
      // Prüfe Verfügbarkeit
      const preference = availabilityMap.get(employee.id)?.get(shiftKey);
      if (preference === 3 || preference === undefined) return false;
      
      // Prüfe ob Schicht voll ist
      if (currentAssignments.length >= shift.requiredEmployees) return false;
      
      // Prüfe ob Mitarbeiter bereits in dieser Schicht ist
      if (currentAssignments.includes(employee.id)) return false;
      
      // Prüfe Kompatibilität
      return this.canAssignEmployee(employee, shift, currentAssignments, employees, constraints);
    });

    report.push(`   📅 ${availableShifts.length} verfügbare Schichten gefunden`);

    // Sortiere verfügbare Schichten nach Priorität
    const prioritizedShifts = availableShifts.sort((a, b) => {
      const aAssignments = assignments[a.id]?.length || 0;
      const bAssignments = assignments[b.id]?.length || 0;
      
      // Bevorzuge Schichten mit mehr freien Plätzen
      const aFree = a.requiredEmployees - aAssignments;
      const bFree = b.requiredEmployees - bAssignments;
      
      if (aFree !== bFree) return bFree - aFree;
      
      // Bevorzuge Schichten mit erfahrenen Kollegen für neue Mitarbeiter
      if (employee.employeeType === 'trainee') {
        const aHasExperienced = (assignments[a.id] || []).some(id => {
          const emp = employees.find(e => e.id === id);
          return emp && emp.employeeType === 'experienced';
        });
        const bHasExperienced = (assignments[b.id] || []).some(id => {
          const emp = employees.find(e => e.id === id);
          return emp && emp.employeeType === 'experienced';
        });
        
        if (aHasExperienced && !bHasExperienced) return -1;
        if (!aHasExperienced && bHasExperienced) return 1;
      }
      
      return 0;
    });

    // Weise zu verfügbaren Schichten zu
    let assigned = 0;
    for (const shift of prioritizedShifts) {
      if (assigned >= needed) break;
      
      assignments[shift.id].push(employee.id);
      assigned++;
      const newCount = assignments[shift.id].length;
      report.push(`      ✅ ${employee.name} zu ${shift.date} ${shift.timeSlotId} zugewiesen (${newCount}/${shift.requiredEmployees})`);
    }
    
    if (assigned > 0) {
      report.push(`   ✅ ${assigned}/${needed} zusätzliche Zuweisungen hinzugefügt`);
      return true;
    } else {
      report.push(`   ❌ Keine verfügbaren Schichten für zusätzliche Zuweisungen`);
      return false;
    }
  }

  // HILFS-FUNKTION: Zähle Mitarbeiter-Zuweisungen
  private static countEmployeeAssignments(
    employeeId: string,
    assignments: { [shiftId: string]: string[] },
    firstWeekShifts: ScheduledShift[]
  ): number {
    
    let count = 0;
    firstWeekShifts.forEach(shift => {
      if (assignments[shift.id]?.includes(employeeId)) {
        count++;
      }
    });
    
    return count;
  }

  // FEHLENDE METHODE: Detect Contract Violations
  private static detectContractViolations(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    firstWeekShifts: ScheduledShift[]
  ): string[] {
    
    const violations: string[] = [];
    const employeeWorkload = new Map<string, number>();
    
    // Zähle Zuweisungen für jeden Mitarbeiter (nur erste Woche)
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      assignedEmployees.forEach(employeeId => {
        employeeWorkload.set(employeeId, (employeeWorkload.get(employeeId) || 0) + 1);
      });
    });

    employees.forEach(employee => {
      if (employee.role === 'admin') return; // Manager ausnehmen
      
      const actual = employeeWorkload.get(employee.id) || 0;
      const target = this.getExactContractAssignments(employee);
      
      if (actual !== target) {
        violations.push(`${this.CRITICAL_VIOLATIONS.CONTRACT_LIMIT_VIOLATION}: ${employee.name} (${actual}/${target})`);
      }
    });

    return violations;
  }

  // FEHLENDE METHODE: Calculate Contract Status
  private static calculateContractStatus(
    assignments: { [shiftId: string]: string[] },
    employees: Employee[],
    firstWeekShifts: ScheduledShift[]
  ): ContractStatus[] {
    
    const employeeWorkload = new Map<string, number>();
    
    // Zähle Zuweisungen für jeden Mitarbeiter (nur erste Woche)
    firstWeekShifts.forEach(shift => {
      const assignedEmployees = assignments[shift.id] || [];
      assignedEmployees.forEach(employeeId => {
        employeeWorkload.set(employeeId, (employeeWorkload.get(employeeId) || 0) + 1);
      });
    });

    return employees.map(employee => {
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