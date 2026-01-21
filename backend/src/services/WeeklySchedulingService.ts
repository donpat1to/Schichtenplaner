// backend/src/services/WeeklySchedulingService.ts
import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { WeeklyScheduleRequest, WeeklyScheduleResult } from '../models/WeeklyPlan.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WeeklySchedulingService {
  async generateOptimalSchedule(request: WeeklyScheduleRequest): Promise<WeeklyScheduleResult> {
    return new Promise((resolve, reject) => {
      // Try multiple possible paths for the worker
      const possibleWorkerPaths = [
        path.resolve(__dirname, '../../dist/workers/weekly-scheduler-worker.js'),
        path.resolve(__dirname, '../workers/weekly-scheduler-worker.js'),
        path.resolve(__dirname, 'workers/weekly-scheduler-worker.js'),
      ];

      let workerPath = null;
      for (const possiblePath of possibleWorkerPaths) {
        if (fs.existsSync(possiblePath)) {
          workerPath = possiblePath;
          break;
        }
      }

      if (!workerPath) {
        console.error('Weekly scheduler worker not found at any of the following paths:', possibleWorkerPaths);
        return reject(new Error('Weekly scheduler worker not found. Please ensure the worker file exists.'));
      }

      console.log('Using weekly scheduler worker at:', workerPath);

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
        console.error('Worker error:', error);
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
        + `Style: ${empReq?.assignmentStyle || 'scattered'}, `
        + `Block: ${empReq?.assignmentStyleConsecutive || 1}, `
        + `Prefs: ${pref1} preferred, ${pref2} available, ${pref3} unavailable`);
    });

    console.log('\n📅 WEEK SUMMARY:');
    weeks.forEach(week => {
      const weekPrefs = preferences.filter(p => p.weekId === week.id);
      const pref1 = weekPrefs.filter(p => p.preferenceLevel === 1).length;
      const pref2 = weekPrefs.filter(p => p.preferenceLevel === 2).length;
      const pref3 = weekPrefs.filter(p => p.preferenceLevel === 3).length;

      console.log(`  Week ${week.weekNumber}: ${pref1} preferred, ${pref2} available, ${pref3} unavailable`);
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
      employees: employees.filter(emp => emp.employeeType === 'personell' || emp.employeeType === 'manager').map(emp => ({
        id: emp.id,
        firstname: emp.firstname,
        lastname: emp.lastname,
        isTrainee: emp.isTrainee,
        employeeType: emp.employeeType,
      })),
      preferences: preferences.map(pref => ({
        employeeId: pref.employeeId,
        weekId: pref.weekId,
        preferenceLevel: pref.preferenceLevel,
      })),
      requirements: requirements.map(req => ({
        employeeId: req.employeeId,
        requiredWeeks: req.requiredWeeks,
        assignmentStyle: req.assignmentStyle || 'scattered',
        assignmentStyleConsecutive: req.assignmentStyleConsecutive || 1,
      })),
      constraints: {
        // Maximum number of employees per week (sum of maxEmployees across all weeks)
        maxEmployeesPerWeek: weeks.reduce((sum, week) => sum + week.maxEmployees, 0),
        // Total number of employee-weeks required
        totalRequiredWeeks: requirements.reduce((sum, req) => sum + req.requiredWeeks, 0),
        // Total number of available employee-weeks
        totalAvailableWeeks: preferences.filter(p => p.preferenceLevel !== 3).length,
      }
    };
  }
}