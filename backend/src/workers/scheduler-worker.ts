// backend/src/workers/scheduler-worker.ts
import { parentPort, workerData } from 'worker_threads';
import { CPModel, CPSolver } from './cp-sat-wrapper.js';
import { ShiftPlan, Shift } from '../models/ShiftPlan.js';
import { Employee } from '../models/Employee.js';
import { Assignment, Availability, Constraint } from '../models/scheduling.js';

interface WorkerData {
  shiftPlan: ShiftPlan;
  employees: Employee[];
  availabilities: Availability[];
  constraints: Constraint[];
  shifts: Shift[];
}


function buildSchedulingModel(model: CPModel, data: WorkerData): void {
  const { employees, shifts, availabilities, constraints } = data;

  const schedulableEmployees = employees.filter(emp =>
    emp.isActive &&
    emp.employeeType === 'personell'
  );

  // Debug: Count constraints that will be created
  console.log('\n🔧 CONSTRAINT ANALYSIS:');
  let hardConstraints = 0;
  let availabilityConstraints = 0;

  // Count availability constraints
  schedulableEmployees.forEach((employee: Employee) => {
    shifts.forEach((shift: Shift) => {
      const availability = availabilities.find(
        (a: any) => a.employeeId === employee.id && a.shiftId === shift.id
      );

      if (!availability || availability.preferenceLevel === 3) {
        availabilityConstraints++;
      }
    });
  });

  console.log(`Availability constraints to create: ${availabilityConstraints}`);
  console.log(`Total possible assignments: ${schedulableEmployees.length * shifts.length}`);

  const trainees = schedulableEmployees.filter(emp => emp.isTrainee);
  const experienced = schedulableEmployees.filter(emp => !emp.isTrainee);

  console.log(`Building model with ${schedulableEmployees.length} schedulable employees, ${shifts.length} shifts`);
  console.log(`- Trainees: ${trainees.length}`);
  console.log(`- Experienced: ${experienced.length}`);
  console.log(`- Excluded: ${employees.filter(emp => !emp.isActive || emp.employeeType !== 'personell').length} employees (managers, apprentices, guests, inactive)`);

  // 1. Create assignment variables for all possible assignments
  schedulableEmployees.forEach((employee: Employee) => {
    shifts.forEach((shift: Shift) => {
      const varName = `assign_${employee.id}_${shift.id}`;
      model.addVariable(varName, 'bool');
    });
  });

  // 2. Availability constraints
  schedulableEmployees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const availability = availabilities.find(
        (a: any) => a.employeeId === employee.id && a.shiftId === shift.id
      );

      const varName = `assign_${employee.id}_${shift.id}`;

      if (!availability || availability.preferenceLevel === 3) {
        model.addConstraint(
          `${varName} == 0`,
          `Employee ${employee.firstname} ${employee.lastname} has not signed up for shift ${shift.id}`
        );
      }
    });
  });

  // 3. Max 1 shift per day per employee
  const shiftsByDayOfWeek = groupShiftsByDayOfWeek(shifts);
  schedulableEmployees.forEach((employee: any) => {
    Object.entries(shiftsByDayOfWeek).forEach(([dayOfWeek, dayShifts]) => {
      const dayAssignmentVars = (dayShifts as any[]).map(
        (shift: any) => `assign_${employee.id}_${shift.id}`
      );

      if (dayAssignmentVars.length > 0) {
        model.addConstraint(
          `${dayAssignmentVars.join(' + ')} <= 1`,
          `Max one shift per day for ${employee.name} on ${dayOfWeek}`
        );
      }
    });
  });

  // 4. Shift staffing constraints
  shifts.forEach((shift: any) => {
    const assignmentVars = schedulableEmployees.map(
      (emp: any) => `assign_${emp.id}_${shift.id}`
    );

    if (assignmentVars.length > 0) {
      // Minimum workers - make this a soft constraint if possible
      const minWorkers = Math.max(shift.minWorkers || 1, 1);
      model.addConstraint(
        `${assignmentVars.join(' + ')} >= ${minWorkers}`,
        `Min workers for shift ${shift.id}`
      );

      // Maximum workers
      const maxWorkers = shift.maxWorkers || 2;
      model.addConstraint(
        `${assignmentVars.join(' + ')} <= ${maxWorkers}`,
        `Max workers for shift ${shift.id}`
      );
    }
  });

  // 5. Trainee supervision constraints
  trainees.forEach((trainee: any) => {
    shifts.forEach((shift: any) => {
      const traineeVar = `assign_${trainee.id}_${shift.id}`;
      const experiencedVars = experienced.map((exp: any) =>
        `assign_${exp.id}_${shift.id}`
      );

      if (experiencedVars.length > 0) {
        // If trainee works, at least one experienced must work
        model.addConstraint(
          `${traineeVar} <= ${experiencedVars.join(' + ')}`,
          `Trainee ${trainee.name} requires supervision in shift ${shift.id}`
        );
      } else {
        // If no experienced available, trainee cannot work this shift
        model.addConstraint(
          `${traineeVar} == 0`,
          `No experienced staff for trainee ${trainee.name} in shift ${shift.id}`
        );
      }
    });
  });

  // 6. Employees who cannot work alone constraint
  const employeesWhoCantWorkAlone = schedulableEmployees.filter(emp => !emp.canWorkAlone);
  console.log(`Found ${employeesWhoCantWorkAlone.length} employees who cannot work alone`);

  employeesWhoCantWorkAlone.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const employeeVar = `assign_${employee.id}_${shift.id}`;
      const otherEmployees = schedulableEmployees.filter(emp =>
        emp.id !== employee.id && emp.isActive
      );

      if (otherEmployees.length === 0) {
        // No other employees available, this employee cannot work this shift
        model.addConstraint(
          `${employeeVar} == 0`,
          `No other employees available for ${employee.name} in shift ${shift.id}`
        );
      } else {
        const otherEmployeeVars = otherEmployees.map(emp =>
          `assign_${emp.id}_${shift.id}`
        );

        // Constraint: if this employee works, at least one other must work
        model.addConstraint(
          `${employeeVar} <= ${otherEmployeeVars.join(' + ')}`,
          `${employee.name} cannot work alone in ${shift.id}`
        );
      }
    });
  });

  // 7. Contract type constraints
  const totalShifts = shifts.length;
  console.log(`Total available shifts: ${totalShifts}`);

  schedulableEmployees.forEach((employee: any) => {
    const contractType = employee.contractType || 'large';

    // EXACT SHIFTS PER WEEK
    let exactShifts;

    if (contractType === 'small') {
      exactShifts = 1;  // Exactly 1 shift for small contract
    } else {
      exactShifts = 2;  // Exactly 2 shifts for large contract
    }

    const shiftVars = shifts.map(
      (shift: any) => `assign_${employee.id}_${shift.id}`
    );

    if (shiftVars.length > 0) {
      // Use EXACT constraint (== instead of range)
      model.addConstraint(
        `${shiftVars.join(' + ')} == ${exactShifts}`,
        `Exact shifts for ${employee.name} (${contractType} contract)`
      );

      console.log(`Employee ${employee.name}: ${exactShifts} shifts (${contractType})`);
    }
  });

  // 8. Objective: Maximize preferred assignments with soft constraints
  let objectiveExpression = '';
  let softConstraintPenalty = '';

  schedulableEmployees.forEach((employee: any) => {
    shifts.forEach((shift: any) => {
      const varName = `assign_${employee.id}_${shift.id}`;
      const availability = availabilities.find(
        (a: any) => a.employeeId === employee.id && a.shiftId === shift.id
      );

      let score = 0;
      if (availability) {
        // Only give positive scores for shifts employees actually signed up for
        if (availability.preferenceLevel === 1) {
          score = 100; // High reward for preferred shifts
        } else if (availability.preferenceLevel === 2) {
          score = 50;  // Medium reward for available shifts
        }
      }
      if (score > 0) {
        if (objectiveExpression) {
          objectiveExpression += ` + ${score} * ${varName}`;
        } else {
          objectiveExpression = `${score} * ${varName}`;
        }
      }
    });
  });

  // 9. DAY STAFFING BALANCE SOFT CONSTRAINT
  console.log('\n📅 ADDING DAY STAFFING BALANCE SOFT CONSTRAINT');

  // Group shifts by dayOfWeek
  //const shiftsByDate = groupShiftsByDate(data.shifts);
  const days = Object.keys(shiftsByDayOfWeek);

  if (days.length > 1) { // Only apply if we have multiple days
    // Count managers already assigned per day (hard constraints)
    const managers = data.employees.filter(emp =>
      emp.isActive && emp.employeeType === 'manager'
    );

    const managersPerDay: Record<string, number> = {};
    days.forEach(dayOfWeek => {
      const dayShifts = shiftsByDayOfWeek[dayOfWeek];
      let managerCount = 0;

      dayShifts.forEach(shift => {
        // Count managers who have this shift as preferred (preferenceLevel = 1)
        const managerPreferences = data.availabilities.filter(avail =>
          managers.some(m => m.id === avail.employeeId) &&
          avail.shiftId === shift.id &&
          avail.preferenceLevel === 1
        );
        managerCount += managerPreferences.length;
      });

      managersPerDay[dayOfWeek] = managerCount;
    });

    console.log(`Managers already assigned per day:`, managersPerDay);

    // Calculate ideal personnel distribution
    const totalRequiredPersonnel = data.shifts.reduce((sum, shift) =>
      sum + (shift.requiredEmployees || 1), 0
    );

    const totalManagersAssigned = Object.values(managersPerDay).reduce((a, b) => a + b, 0);
    const personnelNeeded = totalRequiredPersonnel - totalManagersAssigned;

    if (personnelNeeded > 0) {
      const idealPersonnelPerDay = personnelNeeded / days.length;
      const tolerance = idealPersonnelPerDay * 0.2; // 20% tolerance

      console.log(`Ideal personnel per day: ${idealPersonnelPerDay.toFixed(1)} ±${tolerance.toFixed(1)}`);

      // Create variables and penalties for day staffing
      days.forEach(dayOfWeek => {
        const dayShifts = shiftsByDayOfWeek[dayOfWeek];
        const managerCount = managersPerDay[dayOfWeek] || 0;

        // Create expression for total personnel on this day
        let dayPersonnelExpression = '';

        schedulableEmployees.forEach(employee => {
          dayShifts.forEach(shift => {
            const varName = `assign_${employee.id}_${shift.id}`;

            if (dayPersonnelExpression) {
              dayPersonnelExpression += ` + ${varName}`;
            } else {
              dayPersonnelExpression = varName;
            }
          });
        });

        if (dayPersonnelExpression) {
          // We want: total personnel for day ≈ (idealPersonnelPerDay * dayShifts.length)
          const targetForDay = idealPersonnelPerDay * (dayShifts.length / data.shifts.length) * days.length;

          // Create a slack variable for over-staffing
          const overSlack = `over_slack_${dayOfWeek}`;
          const underSlack = `under_slack_${dayOfWeek}`;

          model.addVariable(overSlack, 'int', { lowerBound: 0 });
          model.addVariable(underSlack, 'int', { lowerBound: 0 });

          // Constraint: dayPersonnelExpression + underSlack - overSlack = targetForDay
          model.addConstraint(
            `${dayPersonnelExpression} + ${underSlack} - ${overSlack} == ${Math.round(targetForDay)}`,
            `Day ${dayOfWeek} staffing target`
          );

          // Add penalties for over/under staffing
          // Penalize over-staffing MORE than under-staffing (since we have manager-heavy days)
          const overPenalty = 5;  // Cost per extra person beyond target
          const underPenalty = 3; // Cost per missing person

          if (softConstraintPenalty) {
            softConstraintPenalty += ` - ${overPenalty} * ${overSlack} - ${underPenalty} * ${underSlack}`;
          } else {
            softConstraintPenalty = `- ${overPenalty} * ${overSlack} - ${underPenalty} * ${underSlack}`;
          }

          console.log(`Day ${dayOfWeek}: target ${Math.round(targetForDay)} personnel, ${managerCount} managers already`);
        }
      });
    }
  } else {
    console.log('Only one day in schedule, skipping day balance constraint');
  }

  // Combine objective with soft constraint penalties
  let finalObjective = objectiveExpression;

  if (softConstraintPenalty) {
    if (finalObjective) {
      finalObjective += ` + ${softConstraintPenalty}`;
    } else {
      finalObjective = softConstraintPenalty;
    }
    console.log(`Added day balance soft penalty to objective`);
  }

  if (objectiveExpression) {
    model.maximize(objectiveExpression);
    console.log('Objective function set with strict availability enforcement');
  } else {
    console.warn('No valid objective expression could be created');
  }
}

function groupShiftsByDayOfWeek(shifts: Shift[]): Record<string, Shift[]> {
  return shifts.reduce((groups: Record<string, Shift[]>, shift: Shift) => {
    const day = shift.dayOfWeek;
    if (!groups[day]) groups[day] = [];
    groups[day].push(shift);
    return groups;
  }, {});
}

function extractAssignmentsFromSolution(
  solution: any,
  employees: any[],
  shifts: Shift[],
): Assignment[] {
  const assignments: Assignment[] = [];

  // Build employee map for names
  const employeeMap = new Map(employees.map(emp => [emp.id, emp]));

  shifts.forEach(shift => {
    const assignedEmployees: string[] = solution.assignments?.filter(
      (a: any) => a.shiftId === shift.id
    ).map((a: any) => a.employeeId) || [];

    // Generate one assignment per required slot
    for (let i = 0; i < (shift.requiredEmployees || 1); i++) {
      const employeeId = assignedEmployees[i] || null;

      assignments.push({
        shiftId: shift.id,
        employeeId: employeeId || '',
        assignedAt: new Date(),
      });
    }
  });

  console.log('🎯 FINAL ASSIGNMENTS:');
  assignments.forEach(a => {
    const emp = a.employeeId ? employeeMap.get(a.employeeId) : null;
    console.log(`   Shift ${a.shiftId}, Employee: ${emp ? emp.firstname + ' ' + emp.lastname : 'UNASSIGNED'}`);
  });

  return assignments;
}

function detectViolations(assignments: any, employees: any[], shifts: any[]): string[] {
  const violations: string[] = [];
  const employeeMap = new Map(employees.map((emp: any) => [emp.id, emp]));

  // Check for understaffed shifts
  shifts.forEach((shift: any) => {
    const assignedCount = assignments[shift.id]?.length || 0;
    const minRequired = shift.minWorkers || 1;

    if (assignedCount < minRequired) {
      violations.push(`UNDERSTAFFED: Shift ${shift.id} has ${assignedCount} employees but requires ${minRequired}`);
    }
  });

  // Check for trainee supervision
  shifts.forEach((shift: any) => {
    const assignedEmployees = assignments[shift.id] || [];
    const hasTrainee = assignedEmployees.some((empId: string) => {
      const emp = employeeMap.get(empId);
      return emp?.isTrainee;
    });

    const hasExperienced = assignedEmployees.some((empId: string) => {
      const emp = employeeMap.get(empId);
      return emp && !emp.isTrainee;
    });

    if (hasTrainee && !hasExperienced) {
      violations.push(`TRAINEE_UNSUPERVISED: Shift ${shift.id} has trainee but no experienced employee`);
    }
  });

  // Check for employees working alone who shouldn't
  shifts.forEach((shift: any) => {
    const assignedEmployees = assignments[shift.id] || [];

    if (assignedEmployees.length === 1) {
      const singleEmployeeId = assignedEmployees[0];
      const singleEmployee = employeeMap.get(singleEmployeeId);

      if (singleEmployee && !singleEmployee.canWorkAlone) {
        violations.push(`EMPLOYEE_ALONE: ${singleEmployee.name} is working alone in shift ${shift.id} but cannot work alone`);
      }
    }
  });

  // Check for multiple shifts per day per employee
  const shiftsByDate = groupShiftsByDayOfWeek(shifts);
  employees.forEach((employee: any) => {
    Object.entries(shiftsByDate).forEach(([dayOfWeek, dayShifts]) => {
      let shiftsAssigned = 0;
      dayShifts.forEach((shift: any) => {
        if (assignments[shift.id]?.includes(employee.id)) {
          shiftsAssigned++;
        }
      });

      if (shiftsAssigned > 1) {
        violations.push(`MULTIPLE_SHIFTS: ${employee.name} has ${shiftsAssigned} shifts on ${dayOfWeek}`);
      }
    });
  });

  return violations;
}

function assignManagersToShifts(assignments: any, managers: any[], shifts: any[], availabilities: any[]): any {
  const managersToAssign = managers.filter(emp =>
    emp.isActive &&
    emp.employeeType === 'manager'
  );

  console.log(`Assigning ${managersToAssign.length} managers to shifts based on availability=1`);
  console.log(`- Excluded ${managers.filter(emp => !emp.isActive || emp.employeeType !== 'manager').length} non-manager employees from auto-assignment`);

  managersToAssign.forEach((manager: any) => {
    shifts.forEach((shift: any) => {
      const availability = availabilities.find(
        (a: any) => a.employeeId === manager.id && a.shiftId === shift.id
      );

      // Assign manager if they have availability=1 (preferred)
      if (availability?.preferenceLevel === 1) {
        if (!assignments[shift.id]) {
          assignments[shift.id] = [];
        }

        // Check if manager is already assigned (avoid duplicates)
        if (!assignments[shift.id].includes(manager.id)) {
          assignments[shift.id].push(manager.id);
          console.log(`✅ Assigned manager ${manager.firstname} ${manager.lastname} to shift ${shift.id} (availability=1)`);
        }
      }
    });
  });

  return assignments;
}

async function runScheduling() {
  const data: WorkerData = workerData;
  const startTime = Date.now();
  try {
    console.log('Starting scheduling optimization...');

    // Validate input data
    if (!data.shifts || data.shifts.length === 0) {
      throw new Error('No shifts provided for scheduling');
    }

    if (!data.employees || data.employees.length === 0) {
      throw new Error('No employees provided for scheduling');
    }

    console.log(`Optimizing ${data.shifts.length} shifts for ${data.employees.length} employees`);

    // 🆕 COMPREHENSIVE AVAILABILITY DEBUGGING
    console.log('\n🔍 ===== AVAILABILITY ANALYSIS =====');
    console.log(`Total shifts: ${data.shifts.length}`);
    console.log(`Total availability records: ${data.availabilities.length}`);

    // Count by preference level
    const pref1Count = data.availabilities.filter(a => a.preferenceLevel === 1).length;
    const pref2Count = data.availabilities.filter(a => a.preferenceLevel === 2).length;
    const pref3Count = data.availabilities.filter(a => a.preferenceLevel === 3).length;

    console.log(`Preference Level 1 (Preferred): ${pref1Count}`);
    console.log(`Preference Level 2 (Available): ${pref2Count}`);
    console.log(`Preference Level 3 (Unavailable): ${pref3Count}`);

    // Analyze each shift
    console.log('\n📊 AVAILABILITIES PER SHIFT:');
    data.shifts.forEach((shift, index) => {
      const shiftAvailabilities = data.availabilities.filter(avail => avail.shiftId === shift.id);
      const pref1 = shiftAvailabilities.filter(a => a.preferenceLevel === 1).length;
      const pref2 = shiftAvailabilities.filter(a => a.preferenceLevel === 2).length;
      const pref3 = shiftAvailabilities.filter(a => a.preferenceLevel === 3).length;

      console.log(`Shift ${index + 1}: ${shift.id}`);
      console.log(`  📅 Day: ${shift.dayOfWeek}, TimeSlot: ${shift.timeSlotId}`);
      console.log(`  👥 Required: ${shift.requiredEmployees}`);
      console.log(`  ✅ Preferred (1): ${pref1}`);
      console.log(`  🔶 Available (2): ${pref2}`);
      console.log(`  ❌ Unavailable (3): ${pref3}`);
      console.log(`  📋 Total signed up: ${pref1 + pref2}`);

      // Show employee names for each preference level
      if (pref1 > 0) {
        const pref1Employees = shiftAvailabilities
          .filter(a => a.preferenceLevel === 1)
          .map(a => {
            const emp = data.employees.find(e => e.id === a.employeeId);
            return emp ? `${emp.firstname} ${emp.lastname}` : 'Unknown';
          });
        console.log(`    Preferred employees: ${pref1Employees.join(', ')}`);
      }

      if (pref2 > 0) {
        const pref2Employees = shiftAvailabilities
          .filter(a => a.preferenceLevel === 2)
          .map(a => {
            const emp = data.employees.find(e => e.id === a.employeeId);
            return emp ? `${emp.firstname} ${emp.lastname}` : 'Unknown';
          });
        console.log(`    Available employees: ${pref2Employees.join(', ')}`);
      }
    });

    // Employee-level analysis
    console.log('\n👤 EMPLOYEE SIGNUP SUMMARY:');
    const schedulableEmployees = data.employees.filter(emp =>
      emp.isActive && emp.employeeType === 'personell'
    );

    schedulableEmployees.forEach(employee => {
      const employeeAvailabilities = data.availabilities.filter(avail => avail.employeeId === employee.id);
      const pref1 = employeeAvailabilities.filter(a => a.preferenceLevel === 1).length;
      const pref2 = employeeAvailabilities.filter(a => a.preferenceLevel === 2).length;
      const pref3 = employeeAvailabilities.filter(a => a.preferenceLevel === 3).length;

      console.log(`${employee.firstname} ${employee.lastname} (${employee.contractType}):`);
      console.log(`  ✅ Preferred: ${pref1} shifts, 🔶 Available: ${pref2} shifts, ❌ Unavailable: ${pref3} shifts`);
    });

    // Check shift ID matching
    console.log('\n🔍 SHIFT ID MATCHING ANALYSIS:');
    const shiftsWithNoSignups = data.shifts.filter(shift => {
      const shiftAvailabilities = data.availabilities.filter(avail => avail.shiftId === shift.id);
      const signedUp = shiftAvailabilities.filter(a => a.preferenceLevel === 1 || a.preferenceLevel === 2);
      return signedUp.length === 0;
    });

    console.log(`Shifts with NO signups: ${shiftsWithNoSignups.length}/${data.shifts.length}`);
    shiftsWithNoSignups.forEach(shift => {
      console.log(`  ❌ No signups: ${shift.id} (${shift.dayOfWeek}, ${shift.timeSlotId})`);
    });

    console.log('===== END AVAILABILITY ANALYSIS =====\n');

    const nonManagerEmployees = data.employees.filter(emp => emp.isActive && emp.employeeType !== 'manager');

    // Check if we have any employees who signed up for shifts
    const employeesWithSignups = new Set(
      data.availabilities
        .filter(avail => avail.preferenceLevel === 1 || avail.preferenceLevel === 2)
        .map(avail => avail.employeeId)
    );

    if (employeesWithSignups.size === 0) {
      console.log('❌ CRITICAL: No employees have signed up for any shifts!');
      parentPort?.postMessage({
        assignments: {},
        violations: ['NO_SIGNUPS: No employees have signed up for any shifts with preference level 1 or 2'],
        success: false,
        resolutionReport: ['❌ Scheduling failed: No employees have signed up for any shifts'],
        processingTime: Date.now() - startTime
      });
      return;
    }

    const model = new CPModel();
    buildSchedulingModel(model, data);

    const solver = new CPSolver({
      maxTimeInSeconds: 105,
      numSearchWorkers: 8,
      logSearchProgress: true
    });

    const solution = await solver.solve(model);
    const processingTime = Date.now() - startTime;

    console.log(`Scheduling completed in ${processingTime}ms`);
    console.log(`Solution success: ${solution.success}`);

    let assignments: Assignment[] = [];
    let violations: string[] = [];
    let resolutionReport: string[] = [
      `Solved in ${processingTime}ms`,
      `Variables: ${solution.metadata?.variablesCreated || 'unknown'}`,
      `Constraints: ${solution.metadata?.constraintsAdded || 'unknown'}`,
      `Optimal: ${solution.metadata?.optimal || false}`,
      `Status: ${solution.success ? 'SUCCESS' : 'FAILED'}`
    ];

    if (solution.success) {
      // Extract assignments from solution (non-managers only)
      assignments = extractAssignmentsFromSolution(solution, nonManagerEmployees, data.shifts);

      assignments = assignManagersToShifts(assignments, data.employees, data.shifts, data.availabilities);

      // Only detect violations for non-manager assignments
      if (Object.keys(assignments).length > 0) {
        violations = detectViolations(assignments, nonManagerEmployees, data.shifts);
      } else {
        violations.push('NO_ASSIGNMENTS: Solver reported success but produced no assignments');
      }

      if (violations.length === 0) {
        resolutionReport.push('✅ No constraint violations detected for non-manager employees');
      } else {
        resolutionReport.push(`⚠️ Found ${violations.length} violations for non-manager employees:`);
        violations.forEach(violation => {
          resolutionReport.push(`   - ${violation}`);
        });
      }

      // Add assignment statistics (including managers)
      const totalAssignments = Object.values(assignments).reduce((sum: number, shiftAssignments: any) =>
        sum + shiftAssignments.length, 0
      );
      resolutionReport.push(`📊 Total assignments: ${totalAssignments} (including managers)`);

      // Calculate day distribution for the report
      const shiftsByDayOfWeek = groupShiftsByDayOfWeek(data.shifts);
      const dayDistribution: Record<string, number> = {};

      Object.entries(shiftsByDayOfWeek).forEach(([dayOfWeek, dayShifts]) => {
        let count = 0;
        dayShifts.forEach(shift => {
          count += assignments.length || 0;
        });
        dayDistribution[dayOfWeek] = count;
      });

      resolutionReport.push('\n📅 DAY STAFFING DISTRIBUTION:');
      Object.entries(dayDistribution).forEach(([dayOfWeek, count]) => {
        resolutionReport.push(`   ${dayOfWeek}: ${count} total assignments`);
      });

      // Check day balance
      const values = Object.values(dayDistribution);
      const max = Math.max(...values);
      const min = Math.min(...values);
      const imbalance = max - min;

      if (imbalance > 2) {
        resolutionReport.push(`⚠️ Day imbalance detected: ${imbalance} difference between heaviest/lightest days`);
      } else {
        resolutionReport.push(`✅ Good day balance: max difference of ${imbalance}`);
      }

    } else {
      violations.push('SCHEDULING_FAILED: No feasible solution found for non-manager employees');
      resolutionReport.push('❌ No feasible solution could be found for non-manager employees');
    }

    parentPort?.postMessage({
      assignments,
      violations,
      success: solution.success && violations.length === 0,
      resolutionReport,
      processingTime
    });

  } catch (error) {
    console.error('Scheduling worker error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    parentPort?.postMessage({
      error: errorMessage,
      success: false,
      assignments: {},
      violations: [`ERROR: ${errorMessage}`],
      resolutionReport: [`Error: ${errorMessage}`],
      processingTime: Date.now() - startTime
    });
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Scheduling worker received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Scheduling worker received SIGINT, shutting down...');
  process.exit(0);
});

runScheduling();