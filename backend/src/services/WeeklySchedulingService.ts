// backend/src/services/WeeklySchedulingService.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { WeeklyScheduleRequest, WeeklyScheduleResult } from '../models/WeeklyPlan.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WeeklySchedulingService {
  async generateOptimalSchedule(request: WeeklyScheduleRequest): Promise<WeeklyScheduleResult> {
    return new Promise((resolve, reject) => {
      const workerPath = path.resolve(__dirname, '../../dist/workers/weekly-scheduler-worker.js');

      console.log('Looking for weekly scheduler worker at:', workerPath);

      const worker = new Worker(workerPath, {
        workerData: this.prepareWorkerData(request)
      });

      // Timeout after 110 seconds
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Weekly scheduling timeout after 110 seconds'));
      }, 110000);

      worker.on('message', (result: WeeklyScheduleResult) => {
        clearTimeout(timeout);
        resolve(result);
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      worker.on('exit', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Weekly scheduler worker stopped with exit code ${code}`));
        }
      });
    });
  }

  private prepareWorkerData(request: WeeklyScheduleRequest): any {
    const { plan, weeks, employees, preferences, requirements } = request;

    console.log('\n🔍 ===== WEEKLY SCHEDULING DATA =====');
    console.log(`Plan: ${plan.name} (${plan.id})`);
    console.log(`Weeks: ${weeks.length}`);
    console.log(`Employees: ${employees.length}`);
    console.log(`Preferences: ${preferences.length}`);
    console.log(`Requirements: ${requirements.length}`);

    // Log employee details
    console.log('\n👤 EMPLOYEE SUMMARY:');
    employees.forEach(emp => {
      const empPrefs = preferences.filter(p => p.employeeId === emp.id);
      const empReq = requirements.find(r => r.employeeId === emp.id);
      const pref1 = empPrefs.filter(p => p.preferenceLevel === 1).length;
      const pref2 = empPrefs.filter(p => p.preferenceLevel === 2).length;
      const pref3 = empPrefs.filter(p => p.preferenceLevel === 3).length;

      console.log(`  ${emp.firstname} ${emp.lastname}${emp.isTrainee ? ' (T)' : ''}: `
        + `Wants ${empReq?.requiredWeeks || 0} weeks, `
        + `Prefs: ${pref1} preferred, ${pref2} available, ${pref3} unavailable`);
    });

    console.log('===== END WEEKLY SCHEDULING DATA =====\n');

    return {
      plan: {
        id: plan.id,
        name: plan.name,
        startDate: plan.startDate,
        endDate: plan.endDate,
        status: plan.status,
      },
      weeks: weeks.map(week => ({
        id: week.id,
        weekNumber: week.weekNumber,
        startDate: week.startDate,
        endDate: week.endDate,
        minEmployees: week.minEmployees,
        maxEmployees: week.maxEmployees,
      })),
      employees: employees.filter(emp => emp.employeeType === 'personell' || emp.employeeType === 'manager'),
      preferences: preferences.map(pref => ({
        employeeId: pref.employeeId,
        weekId: pref.weekId,
        preferenceLevel: pref.preferenceLevel,
      })),
      requirements: requirements.map(req => ({
        employeeId: req.employeeId,
        requiredWeeks: req.requiredWeeks,
      })),
    };
  }
}
