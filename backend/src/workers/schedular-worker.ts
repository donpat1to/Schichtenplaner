// backend/src/workers/scheduler-worker.ts
import { parentPort, workerData } from 'worker_threads';
import { CPModel, CPSolver } from './cp-sat-wrapper.js';
import { ShiftPlan} from '../models/ShiftPlan.js';
import { Employee,  } from '../models/Employee.js';

interface WorkerData {
  shiftPlan: ShiftPlan;
  employees: Employee[];
  availabilities: any[];
  constraints: any[];
}

function buildSchedulingModel(model: CPModel, data: WorkerData): void {
  const { employees, shifts, availabilities, constraints } = data;
  
  // 1. Entscheidungsvariablen erstellen
  employees.forEach(employee => {
    shifts.forEach(shift => {
      const varName = `assign_${employee.id}_${shift.id}`;
      model.addVariable(varName, 'bool');
    });
  });
  
  // 2. Verfügbarkeits-Constraints
  employees.forEach(employee => {
    shifts.forEach(shift => {
      const availability = availabilities.find(
        a => a.employeeId === employee.id && a.shiftId === shift.id
      );
      
      if (availability?.availability === 3) {
        const varName = `assign_${employee.id}_${shift.id}`;
        model.addConstraint(`${varName} == 0`, `Availability constraint for ${employee.name}`);
      }
    });
  });
  
  // 3. Schicht-Besetzungs-Constraints
  shifts.forEach(shift => {
    const assignmentVars = employees.map(
      emp => `assign_${emp.id}_${shift.id}`
    );
    
    model.addConstraint(
      `${assignmentVars.join(' + ')} >= ${shift.minWorkers}`,
      `Min workers for shift ${shift.id}`
    );
    
    model.addConstraint(
      `${assignmentVars.join(' + ')} <= ${shift.maxWorkers}`,
      `Max workers for shift ${shift.id}`
    );
  });
  
  // 4. Keine zwei Schichten pro Tag pro Employee
  employees.forEach(employee => {
    const shiftsByDate = groupShiftsByDate(shifts);
    
    Object.entries(shiftsByDate).forEach(([date, dayShifts]) => {
      const dayAssignmentVars = dayShifts.map(
        (shift: any) => `assign_${employee.id}_${shift.id}`
      );
      
      model.addConstraint(
        `${dayAssignmentVars.join(' + ')} <= 1`,
        `Max one shift per day for ${employee.name} on ${date}`
      );
    });
  });
  
  // 5. Trainee-Überwachungs-Constraints
  const trainees = employees.filter(emp => emp.employeeType === 'trainee');
  const experienced = employees.filter(emp => emp.employeeType === 'experienced');
  
  trainees.forEach(trainee => {
    shifts.forEach(shift => {
      const traineeVar = `assign_${trainee.id}_${shift.id}`;
      const experiencedVars = experienced.map(exp => `assign_${exp.id}_${shift.id}`);
      
      model.addConstraint(
        `${traineeVar} <= ${experiencedVars.join(' + ')}`,
        `Trainee ${trainee.name} requires supervision in shift ${shift.id}`
      );
    });
  });
  
  // 6. Ziel: Verfügbarkeits-Score maximieren
  let objectiveExpression = '';
  employees.forEach(employee => {
    shifts.forEach(shift => {
      const availability = availabilities.find(
        a => a.employeeId === employee.id && a.shiftId === shift.id
      );
      
      if (availability) {
        const score = availability.availability === 1 ? 3 : 
                     availability.availability === 2 ? 1 : 0;
        
        const varName = `assign_${employee.id}_${shift.id}`;
        objectiveExpression += objectiveExpression ? ` + ${score} * ${varName}` : `${score} * ${varName}`;
      }
    });
  });
  
  model.maximize(objectiveExpression);
}

function groupShiftsByDate(shifts: any[]): Record<string, any[]> {
  return shifts.reduce((groups, shift) => {
    const date = shift.date.split('T')[0];
    if (!groups[date]) groups[date] = [];
    groups[date].push(shift);
    return groups;
  }, {});
}

async function runScheduling() {
  const data: WorkerData = workerData;
  
  try {
    console.log('Starting scheduling optimization...');
    const startTime = Date.now();
    
    const model = new CPModel();
    buildSchedulingModel(model, data);
    
    const solver = new CPSolver({
      maxTimeInSeconds: 105,
      numSearchWorkers: 8,
      logSearchProgress: true
    });
    
    const solution = await solver.solve(model);
    solution.processingTime = Date.now() - startTime;
    
    console.log(`Scheduling completed in ${solution.processingTime}ms`);
    
    parentPort?.postMessage({
      assignments: solution.assignments,
      violations: solution.violations,
      success: solution.success,
      resolutionReport: [
        `Solved in ${solution.processingTime}ms`,
        `Variables: ${solution.metadata.variablesCreated}`,
        `Constraints: ${solution.metadata.constraintsAdded}`,
        `Optimal: ${solution.metadata.optimal}`
      ],
      processingTime: solution.processingTime
    });
    
  } catch (error) {
    console.error('Scheduling worker error:', error);
    parentPort?.postMessage({
      error: error.message,
      success: false,
      assignments: [],
      violations: [],
      resolutionReport: [`Error: ${error.message}`],
      processingTime: 0
    });
  }
}

runScheduling();